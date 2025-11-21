// create-customer-pdf-chunked.ts
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

import { createClient } from "npm:@supabase/supabase-js@2.49.8";
import { PDFDocument } from "npm:pdf-lib@1.17.1";

/* ---------- image sniffers ---------- */
function isPng(bytes: Uint8Array) {
  return bytes.length > 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
}
function isJpeg(bytes: Uint8Array) {
  return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 &&
         bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9;
}

/* ---------- storage helpers ---------- */
async function fetchImageBytes(supabase: any, imagePath: string) {
  let normalizedPath = (imagePath ?? "").trim();
  if (normalizedPath.includes('/storage/v1/object/public/comics/')) {
    normalizedPath = normalizedPath.split('/storage/v1/object/public/comics/')[1];
  }
  if (normalizedPath.includes('supabase.co/storage/v1/object/public/comics/')) {
    normalizedPath = normalizedPath.split('supabase.co/storage/v1/object/public/comics/')[1];
  }
  if (!normalizedPath || normalizedPath.includes('..') || normalizedPath.startsWith('/')) {
    throw new Error(`Invalid image path: ${normalizedPath}`);
  }
  const { data, error } = await supabase.storage.from("comics").download(normalizedPath);
  if (error) throw new Error(`Download failed for ${normalizedPath}: ${error.message}`);
  const ab = await data.arrayBuffer();
  const bytes = new Uint8Array(ab);
  if (bytes.length < 16) throw new Error(`Invalid image data for ${normalizedPath}`);
  return bytes;
}

async function uploadPdf(supabase: any, pdfPath: string, bytes: Uint8Array) {
  const { error } = await supabase.storage.from("comics").upload(pdfPath, bytes, {
    contentType: "application/pdf",
    upsert: true
  });
  if (error) throw new Error(`Upload failed for ${pdfPath}: ${error.message}`);
}

/* ---------- locking (keine Parallel-Schreibzugriffe) ---------- */
async function acquireLock(supabase: any, jobId: string) {
  const lockPath = `generated/pdfs/locks/customer_${jobId}.lock`;
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
  const lockPath = `generated/pdfs/locks/customer_${jobId}.lock`;
  try { await supabase.storage.from("comics").remove([lockPath]); } catch (e) {
    console.warn(`Failed to release lock ${lockPath}:`, e);
  }
}
async function withLock<T>(supabase: any, jobId: string, operation: () => Promise<T>) {
  const maxRetries = 10;
  const baseBackoff = 200;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (await acquireLock(supabase, jobId)) {
      try { return await operation(); }
      finally { await releaseLock(supabase, jobId); }
    }
    const backoff = baseBackoff * Math.pow(1.5, attempt) + Math.random() * 100;
    console.log(`Lock acquisition failed for job ${jobId}, attempt ${attempt + 1}/${maxRetries}, waiting ${Math.round(backoff)}ms`);
    await new Promise(r => setTimeout(r, backoff));
  }
  throw new Error(`Failed to acquire lock for job ${jobId} after ${maxRetries} attempts`);
}

/* ---------- Pointer-Versionierung gegen Read-after-Write/Cache ---------- */
async function readPointer(supabase: any, jobId: string) {
  const p = `generated/pdfs/pointers/customer_${jobId}.txt`;
  const { data } = await supabase.storage.from("comics").download(p);
  if (!data) return null;
  const txt = new TextDecoder().decode(await data.arrayBuffer());
  return txt.trim() || null;
}
async function writePointer(supabase: any, jobId: string, key: string) {
  const p = `generated/pdfs/pointers/customer_${jobId}.txt`;
  const bytes = new TextEncoder().encode(key);
  await supabase.storage.from("comics").upload(p, bytes, {
    contentType: "text/plain",
    upsert: true,
  });
}
function nextVersionKey(prevKey: string | null, jobId: string) {
  if (!prevKey) return `generated/pdfs/customer_${jobId}__v1.pdf`;
  const m = prevKey.match(/__v(\d+)\.pdf$/);
  const v = m ? (parseInt(m[1], 10) + 1) : 2;
  return `generated/pdfs/customer_${jobId}__v${v}.pdf`;
}

/* ---------- HTTP handler ---------- */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const { jobId, key, imagePath, heroName, comicTitle } = await req.json();
    console.log(`[create-customer-pdf-chunked] Starting append: jobId=${jobId}, key=${key}, imagePath=${imagePath}`);

    if (!jobId || !imagePath) {
      console.error('[create-customer-pdf-chunked] Missing required parameters');
      return new Response(JSON.stringify({ success: false, error: 'jobId and imagePath are required' }), {
        status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceRoleKey) throw new Error("Supabase configuration missing");
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Schreibzugriff strikt sequenziell
    const pdfUrl = await withLock(supabase, jobId, async () => {
      // 1) Letzte Version via Pointer lesen
      const prevKey = await readPointer(supabase, jobId);
      const pdfPath = nextVersionKey(prevKey, jobId); // neuer Key für diese Append-Operation

      // 2) Dokument laden (aus prevKey), sonst neu erstellen
      let doc: PDFDocument;
      if (prevKey) {
        const { data: existingFile } = await supabase.storage.from("comics").download(prevKey);
        if (existingFile) {
          const ab = await existingFile.arrayBuffer();
          doc = await PDFDocument.load(new Uint8Array(ab));
          console.log('Loaded existing PDF from', prevKey, 'with', doc.getPageCount(), 'pages');
        } else {
          doc = await PDFDocument.create();
          if (comicTitle) doc.setTitle(comicTitle);
          if (heroName) doc.setAuthor(heroName);
          console.log('Pointer set but file missing, creating new PDF');
        }
      } else {
        doc = await PDFDocument.create();
        if (comicTitle) doc.setTitle(comicTitle);
        if (heroName) doc.setAuthor(heroName);
        console.log('Created new PDF');
      }

      // 3) Seite einbetten
      const page = doc.addPage([477, 738]); // 168.27mm x 260.35mm → 477x738 pt
      const imgBytes = await fetchImageBytes(supabase, imagePath);
      if (isJpeg(imgBytes)) {
        const img = await doc.embedJpg(imgBytes);
        page.drawImage(img, { x: 0, y: 0, width: 477, height: 738 });
      } else if (isPng(imgBytes)) {
        const img = await doc.embedPng(imgBytes);
        page.drawImage(img, { x: 0, y: 0, width: 477, height: 738 });
      } else {
        try {
          const img = await doc.embedJpg(imgBytes);
          page.drawImage(img, { x: 0, y: 0, width: 477, height: 738 });
        } catch {
          const img = await doc.embedPng(imgBytes);
          page.drawImage(img, { x: 0, y: 0, width: 477, height: 738 });
        }
      }

      // 4) Neue Version speichern & hochladen (neuer Key => kein CDN-Cache)
      const out = await doc.save();
      await uploadPdf(supabase, pdfPath, out);

      // 5) Pointer auf neue Version aktualisieren
      await writePointer(supabase, jobId, pdfPath);

      const finalPageCount = doc.getPageCount();
      console.log(`[create-customer-pdf-chunked] Append done: key=${key}, totalPages=${finalPageCount}, savedTo=${pdfPath}`);

      const { data: urlData } = supabase.storage.from("comics").getPublicUrl(pdfPath);
      return urlData.publicUrl;
    });

    console.log(`[create-customer-pdf-chunked] Successfully appended ${key} to customer PDF for job ${jobId}. URL: ${pdfUrl}`);
    return new Response(JSON.stringify({ success: true, pdfUrl }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err: any) {
    console.error('[create-customer-pdf-chunked] Error:', err?.message || err);
    return new Response(JSON.stringify({
      success: false, error: err?.message || 'Unknown error'
    }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
