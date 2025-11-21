# Stripe Live Mode Configuration

## Current Status
✅ Your application is **configured for LIVE MODE** in the `.env` file.

## CRITICAL: Required Supabase Environment Variables

**YOU MUST SET THESE IN SUPABASE DASHBOARD NOW:**

Go to: https://supabase.com/dashboard/project/nsbnsmgcvktojmlgfloa/settings/functions

### 1. STRIPE_SECRET_KEY (REQUIRED)
- **Value**: Your Stripe **LIVE** secret key (starts with `sk_live_...`)
- **Get it from**: https://dashboard.stripe.com/apikeys
- **IMPORTANT**: Make sure you're viewing LIVE mode keys in Stripe dashboard (toggle in top-right)
- **Used by**: `guest-checkout`, `stripe-checkout`, `stripe-webhook` functions

### 2. STRIPE_WEBHOOK_SECRET (REQUIRED)
- **Value**: Your webhook signing secret from Stripe (starts with `whsec_...`)
- **Get it from**: https://dashboard.stripe.com/webhooks
- **Webhook URL**: `https://nsbnsmgcvktojmlgfloa.supabase.co/functions/v1/stripe-webhook`
- **Used by**: `stripe-webhook` function to verify webhook authenticity

### Auto-Configured (No Action Needed)
- `SUPABASE_URL` - Auto-populated by Supabase
- `SUPABASE_SERVICE_ROLE_KEY` - Auto-populated by Supabase

## Environment Variables

### Already Configured
- `VITE_STRIPE_MODE=live` - Set to live mode ✓
- `VITE_SUPABASE_URL` - Configured ✓
- `VITE_SUPABASE_ANON_KEY` - Configured ✓

## Stripe Products Configuration

The application uses the price IDs defined in `src/stripe-config.ts`:

### Live Mode Products (Currently Active)
- **Digital Comic Book**: `price_1SJ8oyDWkrplu45217ZQFXTs` - €8.90
- **Physical Comic Book**: `price_1SFueAD3QCAerGJNSRvLFEZm` - €39.00

### Test Mode Products (For Reference)
- **Digital Comic Book**: `price_1SFuRWD3QCAerGJN3biRd5dy` - €8.90
- **Physical Comic Book**: `price_1SFueAD3QCAerGJNSRvLFEZm` - €39.00

## Important Notes

1. **Price IDs Must Exist**: Ensure the live mode price IDs exist in your Stripe dashboard and match the configuration.

2. **Webhook Configuration**: Set up a webhook endpoint in Stripe dashboard (LIVE MODE):
   - **Dashboard URL**: https://dashboard.stripe.com/webhooks
   - **Webhook Endpoint URL**: `https://nsbnsmgcvktojmlgfloa.supabase.co/functions/v1/stripe-webhook`
   - **Events to listen for**:
     - `checkout.session.completed`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`
   - **After creating**: Copy the "Signing secret" (starts with `whsec_...`) and add it to Supabase as `STRIPE_WEBHOOK_SECRET`

3. **Test Your Integration**:
   - Use Stripe's test card numbers in test mode first
   - Then switch to live mode and test with a real (low-value) transaction
   - Monitor the Stripe dashboard for successful payments

4. **Security**:
   - Never expose your Stripe secret key in client-side code
   - All Stripe secret key operations happen in Supabase Edge Functions

## How to Switch Between Test and Live Mode

Simply update the `.env` file:
- For test mode: `VITE_STRIPE_MODE=test`
- For live mode: `VITE_STRIPE_MODE=live`

The application will automatically use the correct price IDs based on this setting.

## Verification Checklist

- [ ] STRIPE_SECRET_KEY is set to live key in Supabase Edge Functions
- [ ] Live mode price IDs exist in Stripe dashboard
- [ ] Webhook endpoint is configured in Stripe dashboard
- [ ] Test a small transaction in live mode
- [ ] Verify webhook events are being received
- [ ] Check that customer records are created correctly
