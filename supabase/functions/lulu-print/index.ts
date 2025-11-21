const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface LuluAuthResponse {
  access_token: string;
  expires_in: number;
  refresh_expires_in: number;
  refresh_token: string;
  token_type: string;
}

interface LuluShippingAddress {
  name: string;
  street1: string;
  street2?: string;
  city: string;
  state_code?: string;
  postcode: string;
  country_code: string;
  phone_number: string;
}

interface LuluLineItem {
  external_id?: string;
  printable_normalization: {
    pod_package_id: string;
    cover: {
      source_url: string;
    };
    interior: {
      source_url: string;
    };
  };
  quantity: number;
  title: string;
}

interface LuluPrintJobRequest {
  contact_email: string;
  external_id?: string;
  line_items: LuluLineItem[];
  production_delay?: number;
  shipping_address: LuluShippingAddress;
  shipping_level: 'MAIL';
}

interface LuluCostCalculationRequest {
  line_items: Array<{
    pod_package_id: string;
    quantity: number;
    page_count: number;
  }>;
  shipping_address: LuluShippingAddress;
  shipping_option: 'MAIL';
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

    // Get Lulu API credentials from environment
    const LULU_ENVIRONMENT = "production"; // FORCED TO PRODUCTION MODE

    // Enhanced debug logging for production verification
    console.log("=== LULU CONFIGURATION ===");
    console.log("LULU_ENVIRONMENT:", LULU_ENVIRONMENT);
    console.log("Is Production Mode:", LULU_ENVIRONMENT === 'production');
    console.log("LULU_PRODUCTION_CLIENT_KEY exists:", Boolean(Deno.env.get("LULU_PRODUCTION_CLIENT_KEY")));
    console.log("LULU_PRODUCTION_CLIENT_SECRET_KEY exists:", Boolean(Deno.env.get("LULU_PRODUCTION_CLIENT_SECRET_KEY")));
    console.log("LULU_SANDBOX_CLIENT_KEY exists:", Boolean(Deno.env.get("LULU_SANDBOX_CLIENT_KEY")));
    console.log("LULU_SANDBOX_CLIENT_SECRET_KEY exists:", Boolean(Deno.env.get("LULU_SANDBOX_CLIENT_SECRET_KEY")));

    // Dynamically determine which credentials to use based on environment
    const isProduction = true; // HARDCODED TO TRUE FOR PRODUCTION
    const LULU_CLIENT_KEY = isProduction 
      ? Deno.env.get("LULU_PRODUCTION_CLIENT_KEY")
      : Deno.env.get("LULU_SANDBOX_CLIENT_KEY");
    const LULU_CLIENT_SECRET = isProduction
      ? Deno.env.get("LULU_PRODUCTION_CLIENT_SECRET_KEY") 
      : Deno.env.get("LULU_SANDBOX_CLIENT_SECRET_KEY");

    console.log("Using Production Keys:", isProduction);
    console.log("LULU_CLIENT_KEY (first 10 chars):", LULU_CLIENT_KEY?.substring(0, 10) + "...");
    console.log("LULU_CLIENT_SECRET (exists):", Boolean(LULU_CLIENT_SECRET));

    if (!LULU_CLIENT_KEY || !LULU_CLIENT_SECRET) {
      const envType = isProduction ? 'PRODUCTION' : 'SANDBOX';
      console.error(`Missing ${envType} credentials!`);
      return new Response(
        JSON.stringify({ 
          error: `Lulu API credentials not configured for ${LULU_ENVIRONMENT} environment. Need LULU_${envType}_CLIENT_KEY and LULU_${envType}_CLIENT_SECRET_KEY` 
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

    // Set API URLs based on environment
    const API_BASE_URL = 'https://api.lulu.com'; // HARDCODED TO PRODUCTION
    
    const AUTH_URL = 'https://api.lulu.com/auth/realms/glasstree/protocol/openid-connect/token'; // HARDCODED TO PRODUCTION

    console.log("API_BASE_URL:", API_BASE_URL);
    console.log("AUTH_URL:", AUTH_URL);
    console.log("=== END LULU CONFIGURATION ===");

    // Validation function for Lulu requests
    function validateLuluRequest(action: string, data: any): { valid: boolean; error?: string } {
      switch (action) {
        case 'calculate-cost':
          if (!data.line_items || !Array.isArray(data.line_items)) {
            return { valid: false, error: 'line_items is required and must be an array' };
          }
          for (const item of data.line_items) {
            if (!item.pod_package_id || !item.quantity || !item.page_count) {
              return { valid: false, error: 'Each line item must have pod_package_id, quantity, and page_count' };
            }
          }
          if (!data.shipping_address || !data.shipping_option) {
            return { valid: false, error: 'shipping_address and shipping_option are required' };
          }
          // Validate required shipping address fields
          const addr = data.shipping_address;
          if (!addr.name || !addr.street1 || !addr.city || !addr.postcode || !addr.country_code || !addr.phone_number) {
            return { valid: false, error: 'shipping_address must include name, street1, city, postcode, country_code, and phone_number' };
          }
          break;
        case 'create-print-job':
          if (!data.contact_email || !data.line_items || !data.shipping_address || !data.shipping_level) {
            return { valid: false, error: 'contact_email, line_items, shipping_address, and shipping_level are required' };
          }
          // Validate required shipping address fields
          const printAddr = data.shipping_address;
          if (!printAddr.name || !printAddr.street1 || !printAddr.city || !printAddr.postcode || !printAddr.country_code || !printAddr.phone_number) {
            return { valid: false, error: 'shipping_address must include name, street1, city, postcode, country_code, and phone_number' };
          }
          break;
        case 'get-print-job-status':
          if (!data.printJobId) {
            return { valid: false, error: 'printJobId is required' };
          }
          break;
        case 'cancel-print-job':
          if (!data.printJobId) {
            return { valid: false, error: 'printJobId is required' };
          }
          break;
        default:
          return { valid: false, error: `Unknown action: ${action}` };
      }
      return { valid: true };
    }
    // Authenticate with Lulu API
    async function authenticate(): Promise<string> {
      const credentials = btoa(`${LULU_CLIENT_KEY}:${LULU_CLIENT_SECRET}`);
      
      const response = await fetch(AUTH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${credentials}`,
        },
        body: 'grant_type=client_credentials',
      });

      if (!response.ok) {
        throw new Error(`Authentication failed: ${response.status}`);
      }

      const data: LuluAuthResponse = await response.json();
      return data.access_token;
    }

    // Make authenticated request to Lulu API
    async function makeAuthenticatedRequest<T>(
      endpoint: string, 
      options: RequestInit = {}
    ): Promise<T> {
      const token = await authenticate();
      
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Lulu API Error Details:', {
          status: response.status,
          statusText: response.statusText,
          errorData: errorData,
          url: response.url
        });
        throw new Error(`Lulu API error: ${response.status} - ${errorData.message || response.statusText}`);
      }

      return response.json();
    }

    // Parse request body
    const requestData = await req.json();
    const { action } = requestData;

    // Validate request before processing
    const validation = validateLuluRequest(action, requestData);
    if (!validation.valid) {
      return new Response(
        JSON.stringify({ error: validation.error }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    let result;

    switch (action) {
      case 'calculate-cost':
        // Map line items to only include required fields for cost calculation
        const costLineItems = requestData.line_items.map((item: any) => ({
          pod_package_id: item.pod_package_id,
          quantity: item.quantity,
          page_count: item.page_count
        }));

        const costRequest: LuluCostCalculationRequest = {
          line_items: costLineItems,
          shipping_address: requestData.shipping_address,
          shipping_option: requestData.shipping_option
        };

        result = await makeAuthenticatedRequest('/print-job-cost-calculations/', {
          method: 'POST',
          body: JSON.stringify(costRequest),
        });
        break;

      case 'create-print-job':
        // Explicitly map line items to prevent double-nesting of printable_normalization
        const printJobLineItems = requestData.line_items.map((item: any) => ({
          external_id: item.external_id,
          printable_normalization: {
            pod_package_id: item.printable_normalization.pod_package_id,
            cover: {
              source_url: item.printable_normalization.cover.source_url
            },
            interior: {
              source_url: item.printable_normalization.interior.source_url
            }
          },
          quantity: item.quantity,
          title: item.title
        }));

        const printJobRequest: LuluPrintJobRequest = {
          contact_email: requestData.contact_email,
          external_id: requestData.external_id,
          line_items: printJobLineItems,
          production_delay: requestData.production_delay,
          shipping_address: requestData.shipping_address,
          shipping_level: requestData.shipping_level
        };

        result = await makeAuthenticatedRequest('/print-jobs/', {
          method: 'POST',
          body: JSON.stringify(printJobRequest),
        });
        break;

      case 'get-print-job-status':
        result = await makeAuthenticatedRequest(`/print-jobs/${requestData.printJobId}/`);
        break;

      case 'cancel-print-job':
        result = await makeAuthenticatedRequest(`/print-jobs/${requestData.printJobId}/status/`, {
          method: 'PUT',
          body: JSON.stringify({ name: 'CANCELED' }),
        });
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(
      JSON.stringify(result),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );

  } catch (error) {
    console.error("Lulu Print API error:", error);
    
    return new Response(
      JSON.stringify({ 
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