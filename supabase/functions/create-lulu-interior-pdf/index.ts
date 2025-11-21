const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

import { createClient } from "npm:@supabase/supabase-js@2.49.8";
import { PDFDocument } from "npm:pdf-lib@1.17.1";

interface CreateLuluInteriorPdfRequest {
  heroName: string;
  comicTitle: string;
  imagePaths: {
    storyPage1: string;
    storyPage2: string;
    storyPage3: string;
    storyPage4: string;
    storyPage5: string;
    storyPage6: string;
    storyPage7: string;
    storyPage8: string;
    storyPage9: string;
    storyPage10: string;
  };
}

// --- sniff helpers (avoid SOI errors) ---
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

function sniffMime(bytes: Uint8Array, hinted?: string): string {
  if (isJpeg(bytes)) return "image/jpeg";
  if (isPng(bytes)) return "image/png";
  return hinted && hinted.startsWith("image/") ? hinted : "image/jpeg";
}

async function fetchImageBytes(
  supabase: any,
  imagePath: string
): Promise<{ bytes: Uint8Array; mimeType: string }> {
  console.log(`Downloading image from: ${imagePath}`);

  // Normalize path: strip any URL prefixes and trim whitespace
  let normalizedPath = (imagePath ?? "").trim();
  if (normalizedPath.includes('/storage/v1/object/public/comics/')) {
    normalizedPath = normalizedPath.split('/storage/v1/object/public/comics/')[1];
  }
  if (normalizedPath.includes('supabase.co/storage/v1/object/public/comics/')) {
    normalizedPath = normalizedPath.split('supabase.co/storage/v1/object/public/comics/')[1];
  }

  console.log(`Normalized path: ${normalizedPath}`);

  // Validate path format
  if (!normalizedPath || normalizedPath.includes('..') || normalizedPath.startsWith('/')) {
    throw new Error(`Invalid image path: ${normalizedPath}`);
  }

  try {
    // Try direct download first
    const { data, error } = await supabase.storage.from("comics").download(normalizedPath);

    if (error) {
      console.log(`Direct download failed: ${error.message}, trying signed URL`);

      const { data: signedUrlData, error: signedError } =
        await supabase.storage.from("comics").createSignedUrl(normalizedPath, 60);
      if (signedError) {
        throw new Error(`Failed to create signed URL for ${normalizedPath}: ${signedError.message}`);
      }

      // small read-after-write cushion
      await new Promise((r) => setTimeout(r, 300));

      const response = await fetch(signedUrlData.signedUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch signed URL for ${normalizedPath}: ${response.status} ${response.statusText}`);
      }

      const ab = await response.arrayBuffer();
      const bytes = new Uint8Array(ab);
      if (bytes.length < 16) {
        throw new Error(`Invalid image size for ${normalizedPath}: ${bytes.length} bytes`);
      }
      const hinted = response.headers.get('content-type') || undefined;
      const mimeType = sniffMime(bytes, hinted);

      console.log(`Downloaded via signed URL: ${normalizedPath} (${bytes.length} bytes, mime=${mimeType})`);
      return { bytes, mimeType };
    }

    // Direct download succeeded
    const ab = await data.arrayBuffer();
    const bytes = new Uint8Array(ab);
    if (bytes.length < 16) {
      throw new Error(`Invalid image size for ${normalizedPath}: ${bytes.length} bytes`);
    }
    const mimeType = sniffMime(bytes, undefined);
    console.log(`Downloaded directly: ${normalizedPath} (${bytes.length} bytes, mime=${mimeType})`);
    return { bytes, mimeType };

  } catch (error) {
    console.error(`Failed to fetch image ${normalizedPath}:`, error);
    throw error;
  }
}

async function addFittedImagePage(doc: PDFDocument, imageBytes: Uint8Array, _mimeType: string) {
  // Lulu interior dimensions: 168.27mm x 260.35mm (≈ 6.625" x 10.25")
  const pageWidth = 477; // points (72 pt/in)
  const pageHeight = 738; // points
  const page = doc.addPage([pageWidth, pageHeight]);

  // Choose embedder based on actual bytes (no guessing)
  let embeddedImage: any;
  if (isJpeg(imageBytes)) {
    embeddedImage = await doc.embedJpg(imageBytes);
    console.log('[addFittedImagePage] Embedded JPEG');
  } else if (isPng(imageBytes)) {
    embeddedImage = await doc.embedPng(imageBytes);
    console.log('[addFittedImagePage] Embedded PNG');
  } else {
    // Fallback: try PNG then JPG
    console.log('[addFittedImagePage] Unknown magic, trying PNG then JPEG...');
    try {
      embeddedImage = await doc.embedPng(imageBytes);
    } catch {
      embeddedImage = await doc.embedJpg(imageBytes);
    }
  }

  // DPI diagnostics (optional logs remain)
  const pageWidthInches = 168.27 / 25.4;
  const pageHeightInches = 260.35 / 25.4;
  const imgDims = embeddedImage.scale(1);
  const actualDpiWidth = imgDims.width / pageWidthInches;
  const actualDpiHeight = imgDims.height / pageHeightInches;
  const actualDpi = Math.min(actualDpiWidth, actualDpiHeight);
  console.log(`[addFittedImagePage] Source dims: ${imgDims.width}x${imgDims.height} px; DPI when full-page: ${Math.round(actualDpi)}`);

  // Fill entire page (stretch to trim)
  page.drawImage(embeddedImage, { x: 0, y: 0, width: pageWidth, height: pageHeight });
}

Deno.serve(async (req: Request): Promise<Response> => {
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
    const { imagePaths, heroName, comicTitle }: CreateLuluInteriorPdfRequest = await req.json();
    console.log('Creating Lulu interior PDF with image paths:', imagePaths);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error("Supabase configuration missing");
    }
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const luluInteriorDoc = await PDFDocument.create();
    luluInteriorDoc.setTitle(`${comicTitle || 'Comic'} - Interior`);
    luluInteriorDoc.setAuthor(heroName || 'Hero');

    // Story pages only
    const storyPageKeys = [
      'storyPage1','storyPage2','storyPage3','storyPage4','storyPage5',
      'storyPage6','storyPage7','storyPage8','storyPage9','storyPage10'
    ];

    for (const key of storyPageKeys) {
      console.log(`Processing ${key}...`);
      const pageData = await fetchImageBytes(supabase, imagePaths[key as keyof typeof imagePaths]);
      await addFittedImagePage(luluInteriorDoc, pageData.bytes, pageData.mimeType);
    }

    console.log('Interior PDF created, uploading to storage...');
    const luluInteriorPdfBytes = await luluInteriorDoc.save();
    const timestamp = Date.now();
    const luluInteriorPdfPath = `generated/pdfs/lulu_interior_${timestamp}.pdf`;

    const { error: uploadError } = await supabase.storage
      .from("comics")
      .upload(luluInteriorPdfPath, luluInteriorPdfBytes, { contentType: "application/pdf", upsert: true });

    if (uploadError) {
      throw new Error(`Failed to upload Lulu interior PDF: ${uploadError.message}`);
    }

    const { data: urlData } = supabase.storage.from("comics").getPublicUrl(luluInteriorPdfPath);
    console.log('Interior PDF uploaded successfully');

    return new Response(JSON.stringify({
      success: true,
      interiorUrl: urlData.publicUrl
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Error in create-lulu-interior-pdf:', error);
    const status = error.message.includes('Invalid') ? 422 : 500;
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
