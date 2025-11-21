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
  shipping_level: 'MAIL' | 'PRIORITY_MAIL' | 'GROUND' | 'EXPEDITED' | 'EXPRESS';
}

interface LuluPrintJobResponse {
  id: number;
  external_id?: string;
  status: {
    name: string;
    message: string;
    changed: string;
  };
  costs: {
    total_cost_incl_tax: string;
    currency: string;
  };
  estimated_shipping_dates: {
    arrival_min: string;
    arrival_max: string;
  };
}

interface LuluCostCalculationRequest {
  line_items: Array<{
    pod_package_id: string;
    quantity: number;
    page_count: number;
  }>;
  shipping_address: LuluShippingAddress;
  shipping_option: 'MAIL' | 'PRIORITY_MAIL' | 'GROUND' | 'EXPEDITED' | 'EXPRESS';
}

interface LuluCostCalculationResponse {
  total_cost_incl_tax: string;
  currency: string;
  shipping_cost: {
    total_cost_incl_tax: string;
  };
  line_item_costs: Array<{
    total_cost_incl_tax: string;
  }>;
}

class LuluPrintService {
  private readonly API_BASE_URL: string;

  constructor() {
    // Use Supabase Edge Function for Lulu API calls
    this.API_BASE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/lulu-print`;
  }

  private async callEdgeFunction<T>(action: string, data: any): Promise<T> {
    const response = await fetch(this.API_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ action, ...data }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Lulu API error: ${response.status} - ${errorData.error || response.statusText}`);
    }

    return response.json();
  }

  async calculateCost(
    shippingAddress: LuluShippingAddress,
    shippingLevel: 'MAIL' = 'MAIL'
  ): Promise<LuluCostCalculationResponse> {
    return this.callEdgeFunction<LuluCostCalculationResponse>('calculate-cost', {
      line_items: [{
        pod_package_id: '0663X1025FCPRESS070CW460GIX', // 6.63"x10.25" full color press paperback
        quantity: 1,
        page_count: 24 // Minimum page count for Lulu paperback
      }],
      shipping_address: shippingAddress,
      shipping_option: shippingLevel
    });
  }

  async createPrintJob(
    interiorPdfUrl: string,
    coverPdfUrl: string,
    comicTitle: string,
    heroName: string,
    shippingAddress: LuluShippingAddress,
    contactEmail: string,
    shippingLevel: 'MAIL' = 'MAIL'
  ): Promise<LuluPrintJobResponse> {
    return this.callEdgeFunction<LuluPrintJobResponse>('create-print-job', {
      contact_email: contactEmail,
      external_id: `comic-${Date.now()}`,
      line_items: [{
        external_id: `comic-${heroName}-${Date.now()}`,
        printable_normalization: {
          pod_package_id: '0663X1025FCPRESS070CW460GIX', // 6.63"x10.25" full color press paperback
          cover: {
            source_url: coverPdfUrl
          },
          interior: {
            source_url: interiorPdfUrl
          }
        },
        quantity: 1,
        title: comicTitle
      }],
      production_delay: 120, // 2 hours delay
      shipping_address: shippingAddress,
      shipping_level: shippingLevel
    });
  }

  async getPrintJobStatus(printJobId: number): Promise<LuluPrintJobResponse> {
    return this.callEdgeFunction<LuluPrintJobResponse>('get-print-job-status', {
      printJobId
    });
  }

  async cancelPrintJob(printJobId: number): Promise<void> {
    await this.callEdgeFunction('cancel-print-job', {
      printJobId
    });
  }
}

export const luluPrintService = new LuluPrintService();