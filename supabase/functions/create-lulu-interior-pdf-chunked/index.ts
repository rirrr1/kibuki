// create-lulu-interior-pdf-chunked.ts
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

import { createClient } from "npm:@supabase/supabase-js@2.49.8";
import { PDFDocument } from "npm:pdf-lib@1.17.1";

/* ---------- image sniffers ---------- */
function isPng(bytes: Uint8Array) {
  return bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e;
}
function isJpeg(bytes: Uint8Array) {
  return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8;
}
function sniffMime(bytes: Uint8Array, hinted?: string) {
  if (isJpeg(bytes)) return "image/jpeg";
  if (isPng(bytes)) return "image/png";
  return hinted && hinted.startsWith("image/") ? hinted : "image/jpeg";
}

async function fetchImageBytes(supabase: any, imagePath: string) {
  let normalized = imagePath.trim();
  if (normalized.includes("/storage/v1/object/public/comics/"))
    normalized = normalized.split("/storage/v1/object/public/comics/")[1];
  if (normalized.includes("supabase.co/storage/v1/object/public/comics/"))
    normalized = normalized.split("supabase.co/storage/v1/object/public/comics/")[1];

  const { data, error } = await supabase.storage.from("comics").download(normalized);
  if (error) throw new Error(`Failed to download ${normalized}: ${error.message}`);

  const ab = await data.arrayBuffer();
  const bytes = new Uint8Array(ab);
  const mimeType = sniffMime(bytes, undefined);
  return { bytes, mimeType };
}

async function addFittedImagePage(doc: PDFDocument, imageBytes: Uint8Array) {
  const page = doc.addPage([477, 738]); // 168.27mm x 260.35mm
  let img;
  if (isJpeg(imageBytes)) img = await doc.embedJpg(imageBytes);
  else if (isPng(imageBytes)) img = await doc.embedPng(imageBytes);
  else img = await doc.embedJpg(imageBytes);
  page.drawImage(img, { x: 0, y: 0, width: 477, height: 738 });
}

/* ---------- locking ---------- */
async function acquireLock(supabase: any, jobId: string) {
  const lockPath = `generated/pdfs/locks/lulu_${jobId}.lock`;
  const lockData = new Uint8Array([1]);
  try {
    const { error } = await supabase.storage.from("comics").upload(lockPath, lockData, {
      contentType: "application/octet-stream",
      upsert: false
    });
    return !error;
  } catch {
    return false;
  }
}
async function releaseLock(supabase: any, jobId: string) {
  const lockPath = `generated/pdfs/locks/lulu_${jobId}.lock`;
  try { await supabase.storage.from("comics").remove([lockPath]); }
  catch (error) { console.warn(`Failed to release lock ${lockPath}:`, error); }
}
async function withLock<T>(supabase: any, jobId: string, operation: () => Promise<T>) {
  const maxRetries = 20;
  const baseBackoff = 200;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (await acquireLock(supabase, jobId)) {
      try { return await operation(); }
      finally { await releaseLock(supabase, jobId); }
    }
    const backoff = baseBackoff * attempt + Math.random() * 100;
    console.log(`Lock acquisition failed for job ${jobId}, attempt ${attempt + 1}/${maxRetries}, waiting ${Math.round(backoff)}ms`);
    await new Promise(res => setTimeout(res, backoff));
  }
  throw new Error(`Failed to acquire lock for job ${jobId} after ${maxRetries} attempts`);
}

/* ---------- manifest (dup prevention) ---------- */
async function loadManifest(supabase: any, jobId: string) {
  const manifestPath = `generated/pdfs/manifests/lulu_${jobId}.json`;
  try {
    const { data, error } = await supabase.storage.from("comics").download(manifestPath);
    if (error || !data) return {};
    const text = await data.text();
    return JSON.parse(text || "{}");
  } catch {
    return {};
  }
}
async function saveManifest(supabase: any, jobId: string, manifest: Record<string, boolean>) {
  const manifestPath = `generated/pdfs/manifests/lulu_${jobId}.json`;
  const manifestData = new TextEncoder().encode(JSON.stringify(manifest));
  await supabase.storage.from("comics").upload(manifestPath, manifestData, {
    contentType: "application/json",
    upsert: true
  });
}

/* ---------- pointer-versioning (gegen CDN/Read-after-Write) ---------- */
async function readPointer(supabase: any, jobId: string) {
  const p = `generated/pdfs/pointers/lulu_${jobId}.txt`;
  const { data } = await supabase.storage.from("comics").download(p);
  if (!data) return null;
  const txt = new TextDecoder().decode(await data.arrayBuffer());
  return txt.trim() || null;
}
async function writePointer(supabase: any, jobId: string, key: string) {
  const p = `generated/pdfs/pointers/lulu_${jobId}.txt`;
  const bytes = new TextEncoder().encode(key);
  await supabase.storage.from("comics").upload(p, bytes, {
    contentType: "text/plain",
    upsert: true
  });
}
function nextVersionKey(prevKey: string | null, jobId: string) {
  if (!prevKey) return `generated/pdfs/lulu_interior_${jobId}__v1.pdf`;
  const m = prevKey.match(/__v(\d+)\.pdf$/);
  const v = m ? (parseInt(m[1], 10) + 1) : 2;
  return `generated/pdfs/lulu_interior_${jobId}__v${v}.pdf`;
}

/* ---------- handler ---------- */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ success: false, error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  try {
    const { jobId, key, imagePath, heroName, comicTitle } = await req.json();
    console.log(`[create-lulu-interior-pdf-chunked] Starting append: jobId=${jobId}, key=${key}, imagePath=${imagePath}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(supabaseUrl, supabaseKey);

    const pdfUrl = await withLock(supabase, jobId, async () => {
      // 0) Dup check via manifest
      const manifest = await loadManifest(supabase, jobId);
      if (manifest[key]) {
        console.log(`Page ${key} already exists in manifest, skipping append`);
        const prev = await readPointer(supabase, jobId);
        const { data: u } = supabase.storage.from("comics").getPublicUrl(prev ?? nextVersionKey(null, jobId));
        return u.publicUrl;
      }

      // 1) Pointer lesen und nächste Version bestimmen
      const prevKey = await readPointer(supabase, jobId);
      const pdfPath = nextVersionKey(prevKey, jobId);

      // 2) Vorherige Version laden (falls vorhanden)
      let doc: PDFDocument;
      if (prevKey) {
        const { data: existingFile } = await supabase.storage.from("comics").download(prevKey);
        if (existingFile) {
          const existingBytes = new Uint8Array(await existingFile.arrayBuffer());
          doc = await PDFDocument.load(existingBytes);
          console.log(`Loaded existing PDF ${prevKey} with ${doc.getPageCount()} pages`);
        } else {
          doc = await PDFDocument.create();
          doc.setTitle(`${comicTitle || "Comic"} - Interior`);
          doc.setAuthor(heroName || "Hero");
          console.log("Pointer set but file missing, creating fresh PDF");
        }
      } else {
        doc = await PDFDocument.create();
        doc.setTitle(`${comicTitle || "Comic"} - Interior`);
        doc.setAuthor(heroName || "Hero");
        console.log("Created new PDF");
      }

      // 3) Bildseite anhängen
      const img = await fetchImageBytes(supabase, imagePath);
      await addFittedImagePage(doc, img.bytes);

      // 4) Neue Version speichern und hochladen (neuer Key!)
      const pdfBytes = await doc.save();
      await supabase.storage.from("comics").upload(pdfPath, pdfBytes, {
        contentType: "application/pdf",
        upsert: true
      });
      const finalPageCount = doc.getPageCount();
      console.log(`[create-lulu-interior-pdf-chunked] Append done: jobId=${jobId}, key=${key}, totalPages=${finalPageCount}, savedTo=${pdfPath}`);

      // 5) Manifest & Pointer aktualisieren
      manifest[key] = true;
      await saveManifest(supabase, jobId, manifest);
      await writePointer(supabase, jobId, pdfPath);

      const { data: urlData } = supabase.storage.from("comics").getPublicUrl(pdfPath);
      return urlData.publicUrl;
    });

    console.log(`[create-lulu-interior-pdf-chunked] Successfully appended ${key} to interior PDF for job ${jobId}. URL: ${pdfUrl}`);
    return new Response(JSON.stringify({ success: true, pdfUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (e: any) {
    console.error("Error in create-lulu-interior-pdf-chunked:", e?.message || e);
    return new Response(JSON.stringify({ success: false, error: e?.message || "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
