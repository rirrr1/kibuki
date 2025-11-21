import { supabase } from './supabase';

export interface CheckoutSessionRequest {
  price_id: string;
  success_url: string;
  cancel_url: string;
  mode: 'payment' | 'subscription';
  customer_email?: string;
}

export interface CheckoutSessionResponse {
  sessionId: string;
  url: string;
}

export async function createCheckoutSession(request: CheckoutSessionRequest): Promise<CheckoutSessionResponse> {
  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/guest-checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create checkout session');
  }

  return response.json();
}

export async function getUserSubscription() {
  const { data, error } = await supabase
    .from('stripe_user_subscriptions')
    .select('*')
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function getUserOrders() {
  const { data, error } = await supabase
    .from('stripe_user_orders')
    .select('*')
    .order('order_date', { ascending: false });

  if (error) {
    throw error;
  }

  return data || [];
}