const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

import { createClient } from "npm:@supabase/supabase-js@2.49.8";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error("Supabase configuration missing");
    }
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Parse multipart form
    const formData = await req.formData();
    const heroName = formData.get("heroName") as string | null;
    const comicTitle = formData.get("comicTitle") as string | null;
    const photo = formData.get("photo") as File | null;
    const characterStyle = formData.get("characterStyle") as string | null;
    const customStyle = formData.get("customStyle") as string | null;
    const storyDescription = formData.get("storyDescription") as string | null;
    const illustrationStyle = formData.get("illustrationStyle") as string | null;
    const storyLanguage = (formData.get("storyLanguage") as string | null) || "en";
    const customerEmail = formData.get("customerEmail") as string | null;
    const resumeJobId = formData.get("resumeJobId") as string | null;
    const userId = formData.get("userId") as string | null;

    console.log("Received job request:", {
      heroName,
      comicTitle,
      hasPhoto: !!photo,
      photoSize: photo?.size,
      characterStyle,
      customStyle,
      storyDescription,
      illustrationStyle,
      storyLanguage,
      customerEmail,
      resumeJobId
    });

    if (!resumeJobId && !photo) {
      throw new Error("Photo is required for new jobs");
    }

    let jobId: string;
    let jobData: any;

    if (resumeJobId) {
      console.log("Resuming job:", resumeJobId);
      const { data: existingJob, error: getJobError } = await supabase
        .from("comic_generation_jobs")
        .select("*")
        .eq("id", resumeJobId)
        .single();

      if (getJobError || !existingJob) {
        throw new Error(`Failed to find job ${resumeJobId}: ${getJobError?.message}`);
      }

      jobId = resumeJobId;
      jobData = existingJob;

      await supabase
        .from("comic_generation_jobs")
        .update({ last_heartbeat_at: new Date().toISOString(), status: "processing" })
        .eq("id", jobId);

      console.log("Job resumed:", jobId);
    } else {
      console.log("Creating new job...");

      // Credit deduction for new jobs
      if (!userId) {
        throw new Error("User ID is required for new comic generation");
      }

      const CREDIT_COST = 100;
      console.log(`Deducting ${CREDIT_COST} credits for user ${userId}`);

      // Deduct credits using the database function
      const { data: deductResult, error: deductError } = await supabase.rpc('deduct_credits', {
        p_user_id: userId,
        p_amount: CREDIT_COST,
        p_transaction_type: 'generation',
        p_description: `Comic generation: ${comicTitle || 'Untitled'}`,
        p_comic_job_id: null
      });

      if (deductError) {
        console.error('Credit deduction error:', deductError);
        throw new Error(`Insufficient credits or deduction failed: ${deductError.message}`);
      }

      console.log('Credits deducted successfully. New balance:', deductResult?.[0]?.new_balance);

      // Upload original photo to Storage
      const photoBuffer = await photo!.arrayBuffer();
      const photoBytes = new Uint8Array(photoBuffer);
      const photoMimeType = (photo!.type as string) || "image/jpeg";
      const photoExt = photoMimeType === "image/png" ? "png" : "jpg";

      // Use a temp path first (simple and safe)
      const photoStoragePath = `ctx/temp/uploads/original_${Date.now()}.${photoExt}`;
      const { error: uploadError } = await supabase.storage
        .from("comics")
        .upload(photoStoragePath, photoBytes, { contentType: photoMimeType, upsert: true });

      if (uploadError) {
        throw new Error(`Failed to upload photo: ${uploadError.message}`);
      }

      console.log("Photo uploaded to storage:", photoStoragePath);

      // Create new job with input_data carrying the storage path + mime
      const inputData = {
        heroName,
        comicTitle,
        photoStoragePath,
        mimeType: photoMimeType,
        characterStyle,
        customStyle,
        storyDescription,
        illustrationStyle,
        storyLanguage,
        customerEmail
      };

      console.log("Creating job with input data:", inputData);

      const { data: newJob, error: createJobError } = await supabase
        .from("comic_generation_jobs")
        .insert({
          status: "processing",
          progress: 0,
          input_data: inputData,
          output_data: {},
          current_page: 0,
          last_heartbeat_at: new Date().toISOString(),
          user_id: userId,
          credits_used: CREDIT_COST
        })
        .select()
        .single();

      if (createJobError || !newJob) {
        throw new Error(`Failed to create job: ${createJobError?.message}`);
      }

      jobId = newJob.id;
      jobData = newJob;

      console.log("New job created:", jobId);
    }

    // Kick off the orchestrator (server-side)
    console.log("Starting orchestration for job:", jobId);
    const orchestratorPromise = fetch(`${supabaseUrl}/functions/v1/orchestrate-comic-generation`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseServiceRoleKey}`
      },
      body: JSON.stringify({
        jobId: jobId,
        inputData: jobData.input_data
      })
    });

    // Keep running in background if EdgeRuntime supports waitUntil
    // (Safe no-op if unavailable)
    // @ts-ignore
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(orchestratorPromise);
    }

    console.log("Orchestrator started in background for job:", jobId);

    return new Response(JSON.stringify({
      success: true,
      jobId,
      message: "Comic generation job started in background"
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Error in start-comic-job:", error);

    // Refund credits if the job failed after deduction
    // Note: This will only trigger if error happens after credit deduction but before job starts
    // For job failures during generation, refunds are handled in orchestrate-comic-generation

    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
