const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

import { createClient } from "npm:@supabase/supabase-js@2.49.8";

// Removed edit limit - users can regenerate unlimited times

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
    const { jobId, pageKey, userPrompt, panelNumber, panelCoordinates, newPagePath, updateOnly } = await req.json();

    // Handle simple page update (from frontend regeneration)
    if (updateOnly && newPagePath) {
      const { data: job, error: jobError } = await supabase
        .from("comic_generation_jobs")
        .select("output_data")
        .eq("id", jobId)
        .single();

      if (jobError || !job) {
        return new Response(
          JSON.stringify({ success: false, error: "Job not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const updatedPages = {
        ...(job.output_data?.generatedPages || {}),
        [pageKey]: newPagePath
      };

      const { error: updateError } = await supabase
        .from("comic_generation_jobs")
        .update({
          output_data: {
            ...job.output_data,
            generatedPages: updatedPages
          }
        })
        .eq("id", jobId);

      if (updateError) {
        return new Response(
          JSON.stringify({ success: false, error: "Failed to update job" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const pn = Number(panelNumber);
    const isFullPage = pn === 0;

    if (!jobId || !pageKey || !userPrompt) {
      return new Response(
        JSON.stringify({ success: false, error: "jobId, pageKey, and userPrompt are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!Number.isFinite(pn)) {
      return new Response(
        JSON.stringify({ success: false, error: "panelNumber is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!isFullPage && !panelCoordinates) {
      return new Response(
        JSON.stringify({ success: false, error: "panelCoordinates required unless panelNumber === 0" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate pageKey format
    const validPages = ["cover", "storyPage1", "storyPage2", "storyPage3", "storyPage4", "storyPage5", "storyPage6", "storyPage7", "storyPage8", "storyPage9", "storyPage10"];
    if (!validPages.includes(pageKey)) {
      return new Response(
        JSON.stringify({ success: false, error: `Invalid pageKey: ${pageKey}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate user prompt for dangerous keywords
    const dangerousKeywords = [
      "change format", "resize", "add panel", "remove panel",
      "change size", "change dimension", "change resolution",
      "make bigger", "make smaller", "landscape", "portrait"
    ];
    const lowerPrompt = userPrompt.toLowerCase();
    for (const keyword of dangerousKeywords) {
      if (lowerPrompt.includes(keyword)) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `Ihre Anfrage enthält '${keyword}', was nicht erlaubt ist. Bitte ändern Sie nur Text oder kleine Details, nicht das Format oder Layout.`
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Load current job
    const { data: job, error: loadErr } = await supabase
      .from("comic_generation_jobs")
      .select("id,status,input_data,output_data,page_approvals,user_id")
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

    // Deduct credits for page edit (10 credits per page regeneration)
    if (job.user_id) {
      const EDIT_CREDIT_COST = 10;
      console.log(`Deducting ${EDIT_CREDIT_COST} credits for editing page ${pageKey} for user ${job.user_id}`);

      const { data: deductResult, error: deductError } = await supabase.rpc('deduct_credits', {
        p_user_id: job.user_id,
        p_amount: EDIT_CREDIT_COST,
        p_transaction_type: 'edit',
        p_description: `Page edit: ${pageKey} (Panel ${pn})`,
        p_comic_job_id: jobId
      });

      if (deductError) {
        console.error('Credit deduction error for edit:', deductError);
        return new Response(
          JSON.stringify({
            success: false,
            error: `Insufficient credits. You need ${EDIT_CREDIT_COST} credits to edit a page.`
          }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log('Credits deducted for edit. New balance:', deductResult?.[0]?.new_balance);
    }

    // Track edit count for analytics (no limit enforced)
    const editCounts = job.output_data?.edit_counts || {};
    const currentEditCount = editCounts[pageKey] || 0;

    const generatedPages = job.output_data?.generatedPages || {};
    const currentPagePath = generatedPages[pageKey];

    if (!currentPagePath) {
      return new Response(
        JSON.stringify({ success: false, error: `Page ${pageKey} not found in generated pages` }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build edit request with safety guards
    const inputData = job.input_data || {};
    const characterRefStoragePath = job.output_data?.characterRefStoragePath;

    // Determine target type and dimensions
    let target: string | number;
    let dimensions: string;

    if (pageKey === "cover") {
      target = "cover";
      dimensions = "1351x2103 pixels (171.45mm x 266.7mm at 200 DPI)";
    } else if (pageKey.startsWith("storyPage")) {
      target = parseInt(pageKey.replace("storyPage", ""));
      dimensions = "1327x2050 pixels (168.27mm x 260.35mm at 200 DPI)";
    } else {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid page type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Load beat for this page if it's a story page (only for regenerate with panelNumber === 0)
    let pageBeat: string | undefined = undefined;
    if (pageKey.startsWith("storyPage") && isFullPage) {
      try {
        const lang = (inputData.storyLanguage || "en").trim().toLowerCase();
        const normalizedLang = (["de","de-de","de_at","de-ch","german","deutsch"].includes(lang)) ? "de" : "en";
        const jobKey = `${jobId}__${normalizedLang}`;
        const beatsPath = `generated/beats/${jobKey}/beats.json`;

        const { data: beatsData, error: beatsError } = await supabase.storage.from("comics").download(beatsPath);

        if (!beatsError && beatsData) {
          const beatsText = await beatsData.text();
          const beatsJson = JSON.parse(beatsText);
          const beats = beatsJson.pages || [];

          if (Array.isArray(beats) && beats.length === 10) {
            const pageIndex = target - 1;
            if (pageIndex >= 0 && pageIndex < 10) {
              pageBeat = beats[pageIndex];
              console.log(`Loaded beat for ${pageKey}:`, pageBeat);
            }
          }
        } else {
          console.warn(`Failed to load beats for ${pageKey}:`, beatsError?.message);
        }
      } catch (e) {
        console.warn(`Error loading beat for ${pageKey}:`, e);
      }
    }

    // Koordinatenlogik für Ganzseiten-Edit
    const effectivePanelCoordinates = isFullPage
      ? { x: 0, y: 0, width: 1, height: 1 }
      : panelCoordinates;

    const editRequest: any = {
      prompt: inputData.storyDescription,
      style: inputData.characterStyle === "custom" ? inputData.customStyle : inputData.characterStyle,
      heroName: inputData.heroName,
      characterStyle: inputData.characterStyle === "custom" ? inputData.customStyle : inputData.characterStyle,
      storyDescription: inputData.storyDescription,
      illustrationStyle: inputData.illustrationStyle,
      comicTitle: inputData.comicTitle,
      target,
      characterRefStoragePath,
      editSourcePath: currentPagePath,
      correctionPrompt: userPrompt,
      panelNumber: pn,
      panelCoordinates: effectivePanelCoordinates,
      jobId
    };

    // Include beat for story pages when regenerating (panelNumber === 0)
    if (pageBeat) {
      editRequest.pageBeat = pageBeat;
    }

    console.log(`Editing ${pageKey} panel ${pn} for job ${jobId} with user prompt:`, userPrompt);
    console.log('Panel coordinates:', effectivePanelCoordinates);

    // Call generate-comic with edit mode
    const editRes = await fetch(`${supabaseUrl}/functions/v1/generate-comic`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseServiceRoleKey}`
      },
      body: JSON.stringify(editRequest)
    });

    if (!editRes.ok) {
      const errorText = await editRes.text();
      return new Response(
        JSON.stringify({ success: false, error: `Edit failed: ${errorText}` }),
        { status: editRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await editRes.json();

    if (!result.success) {
      return new Response(
        JSON.stringify({ success: false, error: result.error || "Edit failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update job with new page and increment edit count
    const updatedPages = { ...generatedPages, [pageKey]: result.storagePath };
    const updatedEditCounts = { ...editCounts, [pageKey]: currentEditCount + 1 };

    // Reset approval for this page (user must re-approve)
    const updatedApprovals = { ...(job.page_approvals || {}), [pageKey]: false };

    await supabase
      .from("comic_generation_jobs")
      .update({
        output_data: {
          ...job.output_data,
          generatedPages: updatedPages,
          edit_counts: updatedEditCounts
        },
        page_approvals: updatedApprovals
      })
      .eq("id", jobId);

    return new Response(
      JSON.stringify({
        success: true,
        pageKey,
        newPagePath: result.storagePath,
        editCount: currentEditCount + 1,
        message: "Page successfully edited. Please review and confirm the changes."
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in edit-comic-page:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
