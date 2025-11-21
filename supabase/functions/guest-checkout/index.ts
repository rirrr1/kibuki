import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2.49.8';

const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY')!;
const stripe = new Stripe(stripeSecret, {
  appInfo: {
    name: 'Bolt Integration',
    version: '1.0.0',
  },
});

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

// Helper function to create responses with CORS headers
function corsResponse(body: string | object | null, status = 200) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': '*',
  };

  // For 204 No Content, don't include Content-Type or body
  if (status === 204) {
    return new Response(null, { status, headers });
  }

  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
  });
}

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return corsResponse({}, 204);
    }

    if (req.method !== 'POST') {
      return corsResponse({ error: 'Method not allowed' }, 405);
    }

    const { price_id, success_url, cancel_url, mode, customer_email } = await req.json();

    // Validate required parameters
    if (!price_id || !success_url || !cancel_url || !mode) {
      return corsResponse({ error: 'Missing required parameters' }, 400);
    }

    if (!['payment', 'subscription'].includes(mode)) {
      return corsResponse({ error: 'Invalid mode. Must be payment or subscription' }, 400);
    }

    // Get authorization header to identify user
    const authHeader = req.headers.get('Authorization');
    let userId: string | null = null;

    if (authHeader) {
      try {
        const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
        userId = user?.id || null;
        console.log(`Authenticated user detected: ${userId}`);
      } catch (error) {
        console.log('No authenticated user found, proceeding as guest');
      }
    }

    // Try to find or create Stripe customer
    let customerId: string | null = null;

    if (userId) {
      // Check if user already has a Stripe customer
      const { data: existingCustomer } = await supabase
        .from('stripe_customers')
        .select('customer_id')
        .eq('user_id', userId)
        .maybeSingle();

      if (existingCustomer) {
        customerId = existingCustomer.customer_id;
        console.log(`Using existing Stripe customer: ${customerId}`);
      }
    }

    // Create Stripe checkout session
    const sessionParams: any = {
      payment_method_types: ['card'],
      line_items: [
        {
          price: price_id,
          quantity: 1,
        },
      ],
      mode,
      success_url,
      cancel_url,
    };

    // Add customer or email
    if (customerId) {
      sessionParams.customer = customerId;
    } else if (customer_email) {
      sessionParams.customer_email = customer_email;
    }

    // Store user_id in metadata for webhook processing
    if (userId) {
      sessionParams.metadata = {
        user_id: userId,
      };
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    console.log(`Created checkout session ${session.id} for ${userId ? 'authenticated user' : 'guest'}`);

    return corsResponse({ sessionId: session.id, url: session.url });
  } catch (error: any) {
    console.error(`Guest checkout error: ${error.message}`);
    return corsResponse({ error: error.message }, 500);
  }
});