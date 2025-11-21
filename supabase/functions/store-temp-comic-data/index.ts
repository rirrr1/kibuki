const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

import { createClient } from "npm:@supabase/supabase-js@2.49.8";

interface StoreTempComicDataRequest {
  comicData: any;
  photoData: string;
  checkoutData: any;
}

interface RetrieveTempComicDataRequest {
  sessionId: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error("Supabase configuration missing");
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    if (req.method === "POST") {
      const { action, ...data } = await req.json();
      
      if (action === "store") {
        const { comicData, photoData, checkoutData }: StoreTempComicDataRequest = data;
        
        // Store temporary comic data
        const { data: result, error } = await supabase
          .from('temp_comic_data')
          .insert({
            comic_data: comicData,
            photo_data: photoData,
            checkout_data: checkoutData
          })
          .select('id')
          .single();
        
        if (error) {
          throw new Error(`Failed to store temp data: ${error.message}`);
        }
        
        return new Response(
          JSON.stringify({ success: true, sessionId: result.id }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (action === "retrieve") {
        const { sessionId }: RetrieveTempComicDataRequest = data;
        
        // Retrieve and delete temporary comic data
        const { data: result, error } = await supabase
          .from('temp_comic_data')
          .select('*')
          .eq('id', sessionId)
          .gt('expires_at', new Date().toISOString())
          .single();
        
        if (error || !result) {
          throw new Error('Temporary data not found or expired');
        }
        
        // Delete the temporary data after retrieval
        await supabase
          .from('temp_comic_data')
          .delete()
          .eq('id', sessionId);
        
        return new Response(
          JSON.stringify({
            success: true,
            comicData: result.comic_data,
            photoData: result.photo_data,
            checkoutData: result.checkout_data
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error('Invalid action');
    }
    
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Temp comic data error:", error);
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});