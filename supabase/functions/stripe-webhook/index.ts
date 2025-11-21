import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2.49.8';

const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY')!;
const stripeWebhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;
const stripe = new Stripe(stripeSecret, {
  appInfo: {
    name: 'Bolt Integration',
    version: '1.0.0',
  },
});

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

Deno.serve(async (req) => {
  try {
    // Handle OPTIONS request for CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204 });
    }

    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    // get the signature from the header
    const signature = req.headers.get('stripe-signature');

    if (!signature) {
      return new Response('No signature found', { status: 400 });
    }

    // get the raw body
    const body = await req.text();

    // verify the webhook signature
    let event: Stripe.Event;

    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, stripeWebhookSecret);
    } catch (error: any) {
      console.error(`Webhook signature verification failed: ${error.message}`);
      return new Response(`Webhook signature verification failed: ${error.message}`, { status: 400 });
    }

    EdgeRuntime.waitUntil(handleEvent(event));

    return Response.json({ received: true });
  } catch (error: any) {
    console.error('Error processing webhook:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function handleEvent(event: Stripe.Event) {
  const stripeData = event?.data?.object ?? {};

  if (!stripeData) {
    return;
  }

  if (!('customer' in stripeData)) {
    return;
  }

  // for one time payments, we only listen for the checkout.session.completed event
  if (event.type === 'payment_intent.succeeded' && event.data.object.invoice === null) {
    return;
  }

  const { customer: customerId } = stripeData;

  if (!customerId || typeof customerId !== 'string') {
    console.error(`No customer received on event: ${JSON.stringify(event)}`);
  } else {
    let isSubscription = true;

    if (event.type === 'checkout.session.completed') {
      const { mode } = stripeData as Stripe.Checkout.Session;

      isSubscription = mode === 'subscription';

      console.info(`Processing ${isSubscription ? 'subscription' : 'one-time payment'} checkout session`);
    }

    const { mode, payment_status } = stripeData as Stripe.Checkout.Session;

    if (isSubscription) {
      console.info(`Starting subscription sync for customer: ${customerId}`);
      await syncCustomerFromStripe(customerId);
    } else if (mode === 'payment' && payment_status === 'paid') {
      try {
        // Extract the necessary information from the session
        const {
          id: checkout_session_id,
          payment_intent,
          amount_subtotal,
          amount_total,
          currency,
          metadata,
        } = stripeData as Stripe.Checkout.Session;

        // Get the line items to determine what was purchased
        const session = await stripe.checkout.sessions.retrieve(checkout_session_id, {
          expand: ['line_items'],
        });

        const priceId = session.line_items?.data[0]?.price?.id;

        // Check if this is a credit package purchase
        const { data: creditPackage } = await supabase
          .from('credit_packages')
          .select('credits, package_name')
          .or(`stripe_price_id_test.eq.${priceId},stripe_price_id_live.eq.${priceId}`)
          .single();

        if (creditPackage) {
          // This is a credit purchase - add credits to the user
          console.info(`Credit package purchase detected: ${creditPackage.package_name} (${creditPackage.credits} credits)`);

          // Try to get user_id from Stripe customer table
          let userId: string | null = null;
          const { data: stripeCustomer } = await supabase
            .from('stripe_customers')
            .select('user_id')
            .eq('customer_id', customerId)
            .maybeSingle();

          if (stripeCustomer?.user_id) {
            userId = stripeCustomer.user_id;
            console.info(`Found user_id from stripe_customers: ${userId}`);
          } else {
            console.warn(`No stripe_customers entry found for customer: ${customerId}`);

            // Fallback 1: Check metadata for user_id
            if (metadata?.user_id) {
              userId = metadata.user_id as string;
              console.info(`Found user_id in metadata: ${userId}`);

              // Create stripe_customers entry for future
              const { error: insertError } = await supabase
                .from('stripe_customers')
                .insert({
                  user_id: userId,
                  customer_id: customerId,
                });

              if (insertError) {
                console.error('Failed to create stripe_customers entry:', insertError);
              } else {
                console.info(`Created stripe_customers entry for user ${userId}`);
              }
            } else {
              // Fallback 2: Try to find user by customer email
              const stripeCustomerData = await stripe.customers.retrieve(customerId);

              if (stripeCustomerData && 'email' in stripeCustomerData && stripeCustomerData.email) {
                const { data: authUser } = await supabase.auth.admin.listUsers();
                const matchingUser = authUser.users.find(u => u.email === stripeCustomerData.email);

                if (matchingUser) {
                  userId = matchingUser.id;
                  console.info(`Found user by email match: ${userId}`);

                  // Create stripe_customers entry
                  const { error: insertError } = await supabase
                    .from('stripe_customers')
                    .insert({
                      user_id: userId,
                      customer_id: customerId,
                    });

                  if (insertError) {
                    console.error('Failed to create stripe_customers entry:', insertError);
                  } else {
                    console.info(`Created stripe_customers entry for user ${userId}`);
                  }
                } else {
                  console.error(`No user found with email: ${stripeCustomerData.email}`);
                }
              }
            }
          }

          if (userId) {
            // Add credits using the database function
            const { data: creditResult, error: creditError } = await supabase.rpc('add_credits', {
              p_user_id: userId,
              p_amount: creditPackage.credits,
              p_transaction_type: 'purchase',
              p_description: `Purchased ${creditPackage.package_name} package (${creditPackage.credits} credits)`,
              p_stripe_payment_intent_id: typeof payment_intent === 'string' ? payment_intent : null,
            });

            if (creditError) {
              console.error('Error adding credits:', creditError);
              throw new Error(`Failed to add credits: ${creditError.message}`);
            } else {
              console.info(`Successfully added ${creditPackage.credits} credits to user ${userId}. New balance: ${creditResult[0]?.new_balance}`);
            }
          } else {
            console.error(`Could not determine user_id for customer: ${customerId}. Credits not added!`);
            throw new Error('Unable to identify user for credit purchase');
          }
        }

        // Insert the order into the stripe_orders table
        const { error: orderError } = await supabase.from('stripe_orders').insert({
          checkout_session_id,
          payment_intent_id: payment_intent,
          customer_id: customerId,
          amount_subtotal,
          amount_total,
          currency,
          payment_status,
          status: 'completed',
        });

        if (orderError) {
          console.error('Error inserting order:', orderError);
          return;
        }
        console.info(`Successfully processed one-time payment for session: ${checkout_session_id}`);
      } catch (error) {
        console.error('Error processing one-time payment:', error);
      }
    }
  }
}

// based on the excellent https://github.com/t3dotgg/stripe-recommendations
async function syncCustomerFromStripe(customerId: string) {
  try {
    // fetch latest subscription data from Stripe
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      limit: 1,
      status: 'all',
      expand: ['data.default_payment_method'],
    });

    // TODO verify if needed
    if (subscriptions.data.length === 0) {
      console.info(`No active subscriptions found for customer: ${customerId}`);
      const { error: noSubError } = await supabase.from('stripe_subscriptions').upsert(
        {
          customer_id: customerId,
          subscription_status: 'not_started',
        },
        {
          onConflict: 'customer_id',
        },
      );

      if (noSubError) {
        console.error('Error updating subscription status:', noSubError);
        throw new Error('Failed to update subscription status in database');
      }
    }

    // assumes that a customer can only have a single subscription
    const subscription = subscriptions.data[0];

    // store subscription state
    const { error: subError } = await supabase.from('stripe_subscriptions').upsert(
      {
        customer_id: customerId,
        subscription_id: subscription.id,
        price_id: subscription.items.data[0].price.id,
        current_period_start: subscription.current_period_start,
        current_period_end: subscription.current_period_end,
        cancel_at_period_end: subscription.cancel_at_period_end,
        ...(subscription.default_payment_method && typeof subscription.default_payment_method !== 'string'
          ? {
              payment_method_brand: subscription.default_payment_method.card?.brand ?? null,
              payment_method_last4: subscription.default_payment_method.card?.last4 ?? null,
            }
          : {}),
        status: subscription.status,
      },
      {
        onConflict: 'customer_id',
      },
    );

    if (subError) {
      console.error('Error syncing subscription:', subError);
      throw new Error('Failed to sync subscription in database');
    }
    console.info(`Successfully synced subscription for customer: ${customerId}`);
  } catch (error) {
    console.error(`Failed to sync subscription for customer ${customerId}:`, error);
    throw error;
  }
}