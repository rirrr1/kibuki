const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

import { createClient } from "npm:@supabase/supabase-js@2.49.8";

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
    const { jobId, pageKey } = await req.json();

    if (!jobId || !pageKey) {
      return new Response(
        JSON.stringify({ success: false, error: "jobId and pageKey are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const validPages = ["cover", "storyPage1", "storyPage2", "storyPage3", "storyPage4", "storyPage5", "storyPage6", "storyPage7", "storyPage8", "storyPage9", "storyPage10", "backCover"];
    if (!validPages.includes(pageKey)) {
      return new Response(
        JSON.stringify({ success: false, error: `Invalid pageKey: ${pageKey}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: job, error: loadErr } = await supabase
      .from("comic_generation_jobs")
      .select("id,status,output_data,page_approvals")
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

    const currentApprovals = job.page_approvals || {};
    const updatedApprovals = { ...currentApprovals, [pageKey]: false };

    const { error: updateErr } = await supabase
      .from("comic_generation_jobs")
      .update({ page_approvals: updatedApprovals })
      .eq("id", jobId);

    if (updateErr) {
      return new Response(
        JSON.stringify({ success: false, error: `Update failed: ${updateErr.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const approvedCount = Object.values(updatedApprovals).filter(v => v === true).length;
    const allApproved = approvedCount === 12;

    return new Response(
      JSON.stringify({
        success: true,
        pageKey,
        approved: false,
        approvedCount,
        totalRequired: 12,
        allApproved
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in unapprove-page:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
