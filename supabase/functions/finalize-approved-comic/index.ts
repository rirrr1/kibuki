const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

import { createClient } from "npm:@supabase/supabase-js@2.49.8";

const customerIndexMap: Record<string, number> = {
  frontCover: 0,
  storyPage1: 1, storyPage2: 2, storyPage3: 3, storyPage4: 4, storyPage5: 5,
  storyPage6: 6, storyPage7: 7, storyPage8: 8, storyPage9: 9, storyPage10: 10,
  backCover: 11
};

const interiorIndexMap: Record<string, number> = {
  storyPage1: 0, storyPage2: 1, storyPage3: 2, storyPage4: 3, storyPage5: 4,
  storyPage6: 5, storyPage7: 6, storyPage8: 7, storyPage9: 8, storyPage10: 9
};

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
      throw new Error("Supabase configuration missing");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    const { jobId } = await req.json();

    if (!jobId) {
      return new Response(
        JSON.stringify({ success: false, error: "jobId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Load job
    const { data: job, error: loadErr } = await supabase
      .from("comic_generation_jobs")
      .select("id,status,input_data,output_data,page_approvals")
      .eq("id", jobId)
      .single();

    if (loadErr || !job) {
      return new Response(
        JSON.stringify({ success: false, error: `Job not found: ${loadErr?.message}` }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (job.status !== "awaiting_approval") {
      return new Response(
        JSON.stringify({ success: false, error: `Job status is ${job.status}, expected awaiting_approval` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify all 11 pages are approved (cover + 10 story pages, backCover is auto-approved)
    const pageApprovals = job.page_approvals || {};
    const requiredPages = ["cover", "storyPage1", "storyPage2", "storyPage3", "storyPage4", "storyPage5", "storyPage6", "storyPage7", "storyPage8", "storyPage9", "storyPage10"];

    const missingApprovals = requiredPages.filter(page => !pageApprovals[page]);
    if (missingApprovals.length > 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Not all pages approved. Missing: ${missingApprovals.join(", ")}`,
          missingApprovals
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const generatedPages = job.output_data?.generatedPages || {};
    const inputData = job.input_data || {};

    // Validate all required pages exist
    const requiredPageKeys = ["cover", "storyPage1", "storyPage2", "storyPage3", "storyPage4", "storyPage5", "storyPage6", "storyPage7", "storyPage8", "storyPage9", "storyPage10", "backCover"];
    const missingPages = requiredPageKeys.filter(key => !generatedPages[key]);

    if (missingPages.length > 0) {
      console.error(`Cannot generate PDFs: Missing pages: ${missingPages.join(", ")}`);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Cannot generate PDFs. Missing pages: ${missingPages.join(", ")}`,
          missingPages
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`All ${requiredPageKeys.length} required pages present. Starting PDF generation for job ${jobId}`);

    // Set status to processing for PDF generation
    await supabase.from("comic_generation_jobs").update({
      status: "processing",
      progress: 85
    }).eq("id", jobId);

    console.log(`Starting PDF generation for job ${jobId}`);

    // CUSTOMER PDF (chunked)
    const ordered = [
      ["frontCover", generatedPages.cover],
      ["storyPage1", generatedPages.storyPage1],
      ["storyPage2", generatedPages.storyPage2],
      ["storyPage3", generatedPages.storyPage3],
      ["storyPage4", generatedPages.storyPage4],
      ["storyPage5", generatedPages.storyPage5],
      ["storyPage6", generatedPages.storyPage6],
      ["storyPage7", generatedPages.storyPage7],
      ["storyPage8", generatedPages.storyPage8],
      ["storyPage9", generatedPages.storyPage9],
      ["storyPage10", generatedPages.storyPage10],
      ["backCover", generatedPages.backCover]
    ];

    console.log(`Customer PDF: Processing ${ordered.length} pages for job ${jobId}`);
    console.log(`Pages to process:`, ordered.map(([k, p]) => `${k}: ${p ? 'OK' : 'MISSING'}`).join(', '));

    let lastPdfUrl = "";
    let processedCount = 0;
    for (const [key, imagePath] of ordered) {
      if (!imagePath) {
        await supabase.from("comic_generation_jobs").update({
          status: "failed",
          error_message: `Missing ${key}`
        }).eq("id", jobId);

        return new Response(
          JSON.stringify({ success: false, error: `Missing ${key}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const pageIndex = customerIndexMap[key];
      const resp = await fetch(`${supabaseUrl}/functions/v1/create-customer-pdf-chunked`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseServiceRoleKey}`
        },
        body: JSON.stringify({
          jobId,
          key,
          pageIndex,
          imagePath,
          heroName: inputData.heroName,
          comicTitle: inputData.comicTitle
        })
      });

      const j = await resp.json().catch(() => ({ success: false, error: "Bad JSON" }));
      if (!j.success) {
        console.error(`Customer PDF chunk FAILED at ${key} (${processedCount + 1}/${ordered.length}): ${j.error}`);
        await supabase.from("comic_generation_jobs").update({
          status: "failed",
          error_message: `Customer PDF chunk failed at ${key}: ${j.error}`
        }).eq("id", jobId);

        return new Response(
          JSON.stringify({ success: false, error: `Customer PDF chunk failed at ${key}: ${j.error}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      processedCount++;
      lastPdfUrl = j.pdfUrl;
      console.log(`Customer PDF: Successfully added ${key} (${processedCount}/${ordered.length}). PDF URL: ${lastPdfUrl}`);
      await delay(10);
    }

    console.log(`Customer PDF completed: ${processedCount}/${ordered.length} pages processed. Final URL: ${lastPdfUrl}`);
    await supabase.from("comic_generation_jobs").update({ progress: 90 }).eq("id", jobId);

    // LULU INTERIOR (chunked)
    const storyKeys = [
      ["storyPage1", generatedPages.storyPage1],
      ["storyPage2", generatedPages.storyPage2],
      ["storyPage3", generatedPages.storyPage3],
      ["storyPage4", generatedPages.storyPage4],
      ["storyPage5", generatedPages.storyPage5],
      ["storyPage6", generatedPages.storyPage6],
      ["storyPage7", generatedPages.storyPage7],
      ["storyPage8", generatedPages.storyPage8],
      ["storyPage9", generatedPages.storyPage9],
      ["storyPage10", generatedPages.storyPage10]
    ];

    console.log(`Lulu Interior PDF: Processing ${storyKeys.length} pages for job ${jobId}`);

    let lastInteriorUrl = "";
    let interiorProcessedCount = 0;
    for (const [key, imagePath] of storyKeys) {
      if (!imagePath) {
        await supabase.from("comic_generation_jobs").update({
          status: "failed",
          error_message: `Missing ${key} for interior`
        }).eq("id", jobId);

        return new Response(
          JSON.stringify({ success: false, error: `Missing ${key} for interior` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const pageIndex = interiorIndexMap[key];
      const resp = await fetch(`${supabaseUrl}/functions/v1/create-lulu-interior-pdf-chunked`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseServiceRoleKey}`
        },
        body: JSON.stringify({
          jobId,
          key,
          pageIndex,
          imagePath,
          heroName: inputData.heroName,
          comicTitle: inputData.comicTitle
        })
      });

      const j = await resp.json().catch(() => ({ success: false, error: "Bad JSON" }));
      if (!j.success) {
        console.error(`Lulu interior chunk FAILED at ${key} (${interiorProcessedCount + 1}/${storyKeys.length}): ${j.error}`);
        await supabase.from("comic_generation_jobs").update({
          status: "failed",
          error_message: `Lulu interior chunk failed at ${key}: ${j.error}`
        }).eq("id", jobId);

        return new Response(
          JSON.stringify({ success: false, error: `Lulu interior chunk failed at ${key}: ${j.error}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      interiorProcessedCount++;
      lastInteriorUrl = j.pdfUrl;
      console.log(`Lulu Interior PDF: Successfully added ${key} (${interiorProcessedCount}/${storyKeys.length}). PDF URL: ${lastInteriorUrl}`);
      await delay(10);
    }

    console.log(`Lulu Interior PDF completed: ${interiorProcessedCount}/${storyKeys.length} pages processed. Final URL: ${lastInteriorUrl}`);
    await supabase.from("comic_generation_jobs").update({ progress: 95 }).eq("id", jobId);

    // LULU COVER
    const coverPdfResponse = await fetch(`${supabaseUrl}/functions/v1/create-lulu-cover-pdf`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseServiceRoleKey}`
      },
      body: JSON.stringify({
        frontCoverPath: generatedPages.cover,
        backCoverPath: generatedPages.backCover,
        heroName: inputData.heroName,
        comicTitle: inputData.comicTitle
      })
    });

    const coverPdfResult = await coverPdfResponse.json().catch(() => ({ success: false, error: "Bad JSON" }));
    if (!coverPdfResult.success) {
      await supabase.from("comic_generation_jobs").update({
        status: "failed",
        error_message: `Cover PDF failed: ${coverPdfResult.error}`
      }).eq("id", jobId);

      return new Response(
        JSON.stringify({ success: false, error: `Cover PDF failed: ${coverPdfResult.error}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark as completed
    console.log(`Finalizing job ${jobId} with comicUrl: ${lastPdfUrl}`);
    await supabase.from("comic_generation_jobs").update({
      status: "completed",
      progress: 100,
      output_data: {
        ...job.output_data,
        comicUrl: lastPdfUrl,
        coverUrl: coverPdfResult.coverUrl,
        interiorUrl: lastInteriorUrl,
        generatedPages
      }
    }).eq("id", jobId);
    console.log(`Job ${jobId} completed successfully. Customer PDF: ${processedCount} pages, Interior PDF: ${interiorProcessedCount} pages`);

    // Send confirmation email if email provided
    if (inputData?.customerEmail) {
      await fetch(`${supabaseUrl}/functions/v1/send-confirmation-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseServiceRoleKey}`
        },
        body: JSON.stringify({
          email: inputData.customerEmail,
          heroName: inputData.heroName,
          comicTitle: inputData.comicTitle,
          comicUrl: lastPdfUrl,
          emailType: "digital"
        })
      }).catch(() => {});
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Comic finalized successfully",
        comicUrl: lastPdfUrl,
        coverUrl: coverPdfResult.coverUrl,
        interiorUrl: lastInteriorUrl
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in finalize-approved-comic:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});