const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

import { createClient } from "npm:@supabase/supabase-js@2.49.8";
import { PDFDocument } from "npm:pdf-lib@1.17.1";

// No transcoding — embed images as-is
const PAGES_PER_FLUSH = 1;
const yieldCPU = () => new Promise((r) => setTimeout(r, 0));

// ---- Magic-byte sniffers ----
function isPng(bytes: Uint8Array) {
  return (
    bytes.length > 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 && // P
    bytes[2] === 0x4e && // N
    bytes[3] === 0x47 && // G
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  );
}
function isJpeg(bytes: Uint8Array) {
  return (
    bytes.length > 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[bytes.length - 2] === 0xff &&
    bytes[bytes.length - 1] === 0xd9
  );
}
function sniffMime(bytes: Uint8Array, hinted?: string): "image/png" | "image/jpeg" {
  if (isJpeg(bytes)) return "image/jpeg";
  if (isPng(bytes)) return "image/png";
  // fall back to hinted; default to jpeg to keep embed path simple
  return hinted && hinted.startsWith("image/") && hinted.includes("png") ? "image/png" : "image/jpeg";
}

async function fetchImageBytes(
  supabase: any,
  imagePath: string
): Promise<{ bytes: Uint8Array; mimeType: "image/png" | "image/jpeg" }> {
  console.log(`[fetchImageBytes] Starting download for: ${JSON.stringify(imagePath)}`);

  let normalizedPath = (imagePath ?? "").trim();
  if (normalizedPath.includes('/storage/v1/object/public/comics/')) {
    normalizedPath = normalizedPath.split('/storage/v1/object/public/comics/')[1];
  }
  if (normalizedPath.includes('supabase.co/storage/v1/object/public/comics/')) {
    normalizedPath = normalizedPath.split('supabase.co/storage/v1/object/public/comics/')[1];
  }
  console.log(`[fetchImageBytes] Normalized path: ${JSON.stringify(normalizedPath)}`);

  if (!normalizedPath || normalizedPath.includes('..') || normalizedPath.startsWith('/')) {
    const error = `Invalid image path format: ${JSON.stringify(normalizedPath)}`;
    console.error(`[fetchImageBytes] ${error}`);
    throw new Error(error);
  }

  const { data, error } = await supabase.storage.from("comics").download(normalizedPath);
  if (error) {
    console.log(`[fetchImageBytes] Direct download failed for ${normalizedPath}: ${error.message}, trying signed URL`);
    const { data: signedUrlData, error: signedError } =
      await supabase.storage.from("comics").createSignedUrl(normalizedPath, 60);
    if (signedError) throw new Error(`Failed to create signed URL for ${normalizedPath}: ${signedError.message}`);
    await new Promise((r)=>setTimeout(r, 200));
    const response = await fetch(signedUrlData.signedUrl);
    console.log(`[fetchImageBytes] Signed URL fetch response for ${normalizedPath}: ${response.status} ${response.statusText}`);
    if (!response.ok) throw new Error(`Failed to fetch signed URL for ${normalizedPath}: ${response.status} ${response.statusText}`);
    const ab = await response.arrayBuffer();
    const bytes = new Uint8Array(ab);
    if (bytes.length < 16) throw new Error(`Invalid image size for ${normalizedPath}: ${bytes.length} bytes`);
    const hinted = response.headers.get('content-type') || undefined;
    const mimeType = sniffMime(bytes, hinted);
    return { bytes, mimeType };
  }

  const ab = await data.arrayBuffer();
  const bytes = new Uint8Array(ab);
  if (bytes.length < 16) throw new Error(`Invalid image size for ${normalizedPath}: ${bytes.length} bytes`);
  const mimeType = sniffMime(bytes, undefined);
  return { bytes, mimeType };
}

async function addFittedImagePage(doc: PDFDocument, imageBytes: Uint8Array, mimeType: "image/png" | "image/jpeg") {
  // Fixed customer PDF page size: 168.27mm x 260.35mm
  const pageWidth = 477;  // pt
  const pageHeight = 738; // pt
  const page = doc.addPage([pageWidth, pageHeight]);

  if (mimeType === "image/jpeg") {
    const img = await doc.embedJpg(imageBytes);
    page.drawImage(img, { x: 0, y: 0, width: pageWidth, height: pageHeight });
  } else {
    const img = await doc.embedPng(imageBytes);
    page.drawImage(img, { x: 0, y: 0, width: pageWidth, height: pageHeight });
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const { imagePaths, heroName, comicTitle } = await req.json();
    console.log('[create-customer-pdf] Starting PDF creation');
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceRoleKey) throw new Error("Supabase configuration missing");
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const orderedKeys = [
      'frontCover',
      'storyPage1','storyPage2','storyPage3','storyPage4','storyPage5',
      'storyPage6','storyPage7','storyPage8','storyPage9','storyPage10',
      'backCover',
    ] as const;

    let customerDoc = await PDFDocument.create();
    customerDoc.setTitle(comicTitle || 'Comic');
    customerDoc.setAuthor(heroName || 'Hero');

    let sinceFlush = 0;
    for (const key of orderedKeys) {
      const { bytes, mimeType } = await fetchImageBytes(supabase, (imagePaths as any)[key]);
      await addFittedImagePage(customerDoc, bytes, mimeType);
      sinceFlush++;

      if (sinceFlush >= PAGES_PER_FLUSH) {
        // Save and reload to keep memory tiny; also yields between CPU slices.
        const tmp = await customerDoc.save();
        customerDoc = await PDFDocument.load(tmp);
        sinceFlush = 0;
        await yieldCPU();
      }
    }

    const customerPdfBytes = await customerDoc.save();
    const customerPdfPath = `generated/pdfs/customer_comic_${Date.now()}.pdf`;
    const { error: uploadError } = await supabase.storage.from("comics").upload(customerPdfPath, customerPdfBytes, {
      contentType: "application/pdf",
      upsert: true
    });
    if (uploadError) throw new Error(`Failed to upload customer PDF: ${uploadError.message}`);

    const { data: urlData } = supabase.storage.from("comics").getPublicUrl(customerPdfPath);
    return new Response(JSON.stringify({ success: true, pdfUrl: urlData.publicUrl }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('[create-customer-pdf] Error occurred:', error);
    const status = error.message.includes('Invalid') ? 422 : 500;
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
