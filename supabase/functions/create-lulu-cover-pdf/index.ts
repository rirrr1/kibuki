const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

import { createClient } from "npm:@supabase/supabase-js@2.49.8";
import { PDFDocument } from "npm:pdf-lib@1.17.1";

interface CreateLuluCoverPdfRequest {
  frontCoverPath: string;
  backCoverPath: string;
  heroName: string;
  comicTitle: string;
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
  if (normalizedPath.includes("/storage/v1/object/public/comics/")) {
    normalizedPath = normalizedPath.split("/storage/v1/object/public/comics/")[1];
  }
  if (normalizedPath.includes("supabase.co/storage/v1/object/public/comics/")) {
    normalizedPath = normalizedPath.split("supabase.co/storage/v1/object/public/comics/")[1];
  }
  console.log(`Normalized path: ${normalizedPath}`);

  // Validate path format
  if (!normalizedPath || normalizedPath.includes("..") || normalizedPath.startsWith("/")) {
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
      const hinted = response.headers.get("content-type") || undefined;
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error("Supabase config missing");
      return new Response(JSON.stringify({ error: "Supabase configuration not found" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // ---------- parse & validate ----------
    const { frontCoverPath, backCoverPath, heroName, comicTitle }: CreateLuluCoverPdfRequest = await req.json();
    if (!frontCoverPath || !backCoverPath) {
      return new Response(JSON.stringify({ error: "frontCoverPath and backCoverPath are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("create-lulu-cover-pdf inputs", {
      frontCover: frontCoverPath,
      backCover: backCoverPath,
    });

    // ---------- constants (sizes in points) ----------
    // Lulu cover dimensions with bleed: 342.9mm x 266.7mm total document size
    const COVER_W = 972; // 342.9mm in points (342.9 * 72 / 25.4 = 972)
    const PAGE_H = 756; // 266.7mm in points (266.7 * 72 / 25.4 = 756)
    const SINGLE_COVER_W = COVER_W / 2; // Each cover (front/back) is half the total width

    // Calculate minimum pixel dimensions for 200 DPI based on physical size
    const coverWidthInches = (342.9 / 2) / 25.4; // Half of total width in inches
    const coverHeightInches = 266.7 / 25.4; // Height in inches
    const minWidthPixels = Math.ceil(coverWidthInches * 200); // pixels per cover
    const minHeightPixels = Math.ceil(coverHeightInches * 200); // pixels

    // ---------- load images ----------
    const frontImgData = await fetchImageBytes(supabase, frontCoverPath);
    const backImgData = await fetchImageBytes(supabase, backCoverPath);

    console.log("Cover PDF creation - Total dimensions:", COVER_W, "x", PAGE_H);
    console.log("Single cover dimensions:", SINGLE_COVER_W, "x", PAGE_H);
    console.log("Cover physical size:", coverWidthInches.toFixed(2), "x", coverHeightInches.toFixed(2), "inches");
    console.log("Required minimum pixels for 200 DPI:", minWidthPixels, "x", minHeightPixels);

    // ---------- Lulu cover PDF (spread: back | front) ----------
    const luluCoverDoc = await PDFDocument.create();
    luluCoverDoc.setTitle(`${comicTitle || 'Comic'} — Cover`);

    // One spread page
    const spread = luluCoverDoc.addPage([COVER_W, PAGE_H]);

    // Back (left half)
    let backEmbedded: any;
    if (isJpeg(backImgData.bytes)) backEmbedded = await luluCoverDoc.embedJpg(backImgData.bytes);
    else if (isPng(backImgData.bytes)) backEmbedded = await luluCoverDoc.embedPng(backImgData.bytes);
    else {
      try { backEmbedded = await luluCoverDoc.embedPng(backImgData.bytes); }
      catch { backEmbedded = await luluCoverDoc.embedJpg(backImgData.bytes); }
    }

    const backActualDpiWidth = backEmbedded.width / coverWidthInches;
    const backActualDpiHeight = backEmbedded.height / coverHeightInches;
    const backActualDpi = Math.min(backActualDpiWidth, backActualDpiHeight);
    console.log("Back cover source dimensions:", backEmbedded.width, "x", backEmbedded.height);
    console.log("Back cover actual DPI:", Math.round(backActualDpi));
    if (backActualDpi < 200) {
      console.warn(`Back cover image DPI is low: ${Math.round(backActualDpi)} (recommended 200+)`);
    }

    spread.drawImage(backEmbedded, { x: 0, y: 0, width: SINGLE_COVER_W, height: PAGE_H });

    // Front (right half)
    let frontEmbedded: any;
    if (isJpeg(frontImgData.bytes)) frontEmbedded = await luluCoverDoc.embedJpg(frontImgData.bytes);
    else if (isPng(frontImgData.bytes)) frontEmbedded = await luluCoverDoc.embedPng(frontImgData.bytes);
    else {
      try { frontEmbedded = await luluCoverDoc.embedPng(frontImgData.bytes); }
      catch { frontEmbedded = await luluCoverDoc.embedJpg(frontImgData.bytes); }
    }

    const frontActualDpiWidth = frontEmbedded.width / coverWidthInches;
    const frontActualDpiHeight = frontEmbedded.height / coverHeightInches;
    const frontActualDpi = Math.min(frontActualDpiWidth, frontActualDpiHeight);
    console.log("Front cover source dimensions:", frontEmbedded.width, "x", frontEmbedded.height);
    console.log("Front cover actual DPI:", Math.round(frontActualDpi));
    if (frontActualDpi < 200) {
      console.warn(`Front cover image DPI is low: ${Math.round(frontActualDpi)} (recommended 200+)`);
    }

    spread.drawImage(frontEmbedded, { x: SINGLE_COVER_W, y: 0, width: SINGLE_COVER_W, height: PAGE_H });

    const luluCoverPdfBytes = await luluCoverDoc.save();

    // ---------- Upload PDF ----------
    const timestamp = Date.now();
    const sanitizedHero = (heroName || "hero").replace(/[^a-zA-Z0-9]/g, "_");
    const sanitizedTitle = (comicTitle || "comic").replace(/[^a-zA-Z0-9]/g, "_");

    const luluCoverPdfPath = `pdfs/lulu/${santitizedPath(sanitizedHero)}_${santitizedPath(sanitizedTitle)}_${timestamp}_cover.pdf`;

    const { error: uploadError } = await supabase.storage.from("comics").upload(luluCoverPdfPath, luluCoverPdfBytes, {
      contentType: "application/pdf",
      upsert: true,
    });
    if (uploadError) {
      throw new Error(`Upload failed for ${luluCoverPdfPath}: ${uploadError.message}`);
    }

    // ---------- Public URL ----------
    const { data: luluCoverUrl } = supabase.storage.from("comics").getPublicUrl(luluCoverPdfPath);

    console.log("Lulu cover PDF created & uploaded");

    return new Response(
      JSON.stringify({ success: true, coverUrl: luluCoverUrl.publicUrl }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error in create-lulu-cover-pdf:", error);
    const status = error.message.includes("Invalid") ? 422 : 500;
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function santitizedPath(s: string) {
  return s.replace(/[^a-zA-Z0-9]/g, "_");
}
