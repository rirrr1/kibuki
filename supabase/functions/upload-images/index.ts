const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

import { createClient } from "npm:@supabase/supabase-js@2.49.8";

interface UploadImageRequest {
  imageData: string; // base64
  mimeType: string;
  storagePath: string;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        {
          status: 405,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // Initialize Supabase client with service role key (bypasses RLS)
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase configuration missing");
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse the request body
    const requestData: UploadImageRequest = await req.json();
    
    console.log("Uploading image to:", requestData.storagePath);
    
    // Convert base64 to blob
    const base64Data = requestData.imageData;
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: requestData.mimeType });
    
    // Upload to Supabase Storage using service role (bypasses RLS)
    const { data, error } = await supabase.storage
      .from('comics')
      .upload(requestData.storagePath, blob, {
        contentType: requestData.mimeType,
        upsert: true
      });
    
    if (error) {
      console.error("Upload error:", error);
      throw new Error(`Failed to upload image: ${error.message}`);
    }
    
    console.log("Upload successful:", data);
    
    // Get public URL
    const { data: urlData } = supabase.storage
      .from('comics')
      .getPublicUrl(requestData.storagePath);
    
    return new Response(
      JSON.stringify({
        success: true,
        path: requestData.storagePath,
        publicUrl: urlData.publicUrl
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );

  } catch (error) {
    console.error("Image upload error:", error);
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred" 
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});