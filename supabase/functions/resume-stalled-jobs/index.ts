const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

import { createClient } from "npm:@supabase/supabase-js@2.49.8";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    console.log("Starting stalled jobs check...");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error("Supabase configuration missing");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Find stalled jobs: status='processing' & progress<100 & updated_at<now()-3min
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    
    const { data: stalledJobs, error } = await supabase
      .from('comic_generation_jobs')
      .select('*')
      .eq('status', 'processing')
      .lt('progress', 100)
      .lt('last_heartbeat_at', fiveMinutesAgo);

    if (error) {
      console.error("Error fetching stalled jobs:", error);
      throw error;
    }

    console.log(`Found ${stalledJobs?.length || 0} stalled jobs`);

    if (stalledJobs && stalledJobs.length > 0) {
      for (const job of stalledJobs) {
        console.log(`Resuming stalled job: ${job.id}`);
        
        try {
          // Call start-comic-job to resume the job
          const response = await fetch(`${supabaseUrl}/functions/v1/start-comic-job`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceRoleKey}`,
            },
            body: JSON.stringify({
              ...job.input_data,
              resumeJobId: job.id
            })
          });

          if (!response.ok) {
            const errorData = await response.json();
            console.error(`Failed to resume job ${job.id}:`, errorData);
          } else {
            console.log(`Successfully resumed job ${job.id}`);
          }
        } catch (resumeError) {
          console.error(`Error resuming job ${job.id}:`, resumeError);
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      stalledJobsFound: stalledJobs?.length || 0,
      message: "Stalled jobs check completed"
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Error in resume-stalled-jobs:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});