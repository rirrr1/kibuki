# Production Deployment Checklist

## ✅ COMPLETED - Ready for Production

### Security Fixes Applied
All database security and performance issues have been resolved:

- ✅ Added missing foreign key index on `credit_transactions.comic_job_id`
- ✅ Optimized all RLS policies to use `(SELECT auth.uid())` for better performance
- ✅ Removed unused database indexes
- ✅ Fixed multiple permissive policies on `comic_generation_jobs`
- ✅ Added stable search paths to all security definer functions
- ✅ Build completes successfully

### Features Implemented
- ✅ User authentication (Email/Password + Google OAuth)
- ✅ Credit system with 3 packages (Starter/Creator/Studio)
- ✅ Automatic 100 welcome credits on signup
- ✅ Stripe integration (live mode configured)
- ✅ Comic generation with Gemini AI
- ✅ Physical book printing with Lulu
- ✅ Row Level Security on all tables
- ✅ Database migrations applied

---

## ⚠️ MANUAL CONFIGURATION REQUIRED

### 1. Stripe Dashboard - Verify Price IDs

**Action Required:** Go to [Stripe Dashboard → Products](https://dashboard.stripe.com/products)

Verify these 3 Price IDs exist (LIVE MODE):

| Package | Credits | Price | Stripe Price ID |
|---------|---------|-------|----------------|
| Starter | 100 | €9.90 | `price_1SOwgMDWkrplu452SjkeNJJI` |
| Creator | 200 | €17.90 | `price_1SOwhZDWkrplu4522iTCqUDW` |
| Studio | 400 | €29.90 | `price_1SOwiYDWkrplu452NbuhaRVF` |

**If they don't exist:**
- Create them in Stripe Dashboard
- OR update the database with your actual Price IDs

**To update Price IDs in database:**
```sql
UPDATE credit_packages SET stripe_price_id_live = 'your_actual_price_id' WHERE package_name = 'Starter';
UPDATE credit_packages SET stripe_price_id_live = 'your_actual_price_id' WHERE package_name = 'Creator';
UPDATE credit_packages SET stripe_price_id_live = 'your_actual_price_id' WHERE package_name = 'Studio';
```

---

### 2. Supabase Environment Variables

**Action Required:** Go to [Supabase Dashboard → Edge Functions Settings](https://supabase.com/dashboard/project/nsbnsmgcvktojmlgfloa/settings/functions)

Set these environment variables:

#### Required for Comic Generation
- `GEMINI_API_KEY` = Your Google Gemini API key
  - Get from: https://aistudio.google.com/apikey
  - **CRITICAL:** Without this, comic generation will fail

#### Required for Physical Book Printing
- `LULU_PRODUCTION_CLIENT_KEY` = Your Lulu production API key
- `LULU_PRODUCTION_CLIENT_SECRET_KEY` = Your Lulu production secret

**Already Configured (Verify Only):**
- ✅ `STRIPE_SECRET_KEY` (should already be set)
- ✅ `STRIPE_WEBHOOK_SECRET` (should already be set)
- ✅ `SUPABASE_URL` (auto-configured)
- ✅ `SUPABASE_SERVICE_ROLE_KEY` (auto-configured)

---

### 3. Enable Leaked Password Protection (Optional but Recommended)

**Action Required:** Go to [Supabase Dashboard → Authentication → Providers → Email](https://supabase.com/dashboard/project/nsbnsmgcvktojmlgfloa/auth/providers)

**Enable:** "Leaked Password Protection"
- This checks passwords against HaveIBeenPwned.org
- Prevents users from using compromised passwords
- **Note:** This cannot be enabled via migration, must be done manually

---

## 📋 Pre-Launch Testing Checklist

Before going live, test these workflows:

### User Registration & Credits
- [ ] New user can register with email/password
- [ ] New user receives 100 welcome credits automatically
- [ ] User can sign in with Google OAuth
- [ ] Credits display correctly in dashboard

### Credit Purchase Flow
- [ ] User can select a credit package
- [ ] Stripe checkout opens correctly
- [ ] After payment, credits are added to user account
- [ ] Transaction appears in user's credit history

### Comic Generation
- [ ] User can create a new comic
- [ ] 100 credits are deducted for full comic generation
- [ ] Comic pages generate successfully
- [ ] User can download PDF

### Physical Book Order
- [ ] User can order physical book
- [ ] Lulu API creates print job successfully
- [ ] Order tracking works

---

## 🚀 Deployment Steps

1. **Verify Stripe Price IDs** (see section 1 above)
2. **Set Supabase Environment Variables** (see section 2 above)
3. **Enable Leaked Password Protection** (optional, see section 3)
4. **Run test transaction** with small amount
5. **Monitor Stripe webhook events** in Stripe Dashboard
6. **Deploy frontend** to production hosting
7. **Test complete user journey** end-to-end

---

## 📊 Monitoring

After launch, monitor:

- **Supabase Dashboard:** Database activity, Edge Function logs
- **Stripe Dashboard:** Payments, webhooks, disputes
- **Error Logs:** Check for any API failures or webhook issues

---

## 🆘 Troubleshooting

### Credits not added after purchase
- Check Stripe webhook is receiving events
- Verify `STRIPE_WEBHOOK_SECRET` matches webhook signing secret
- Check Edge Function logs for `stripe-webhook` errors

### Comic generation fails
- Verify `GEMINI_API_KEY` is set correctly
- Check Edge Function logs for `generate-comic` errors
- Verify user has sufficient credits

### Physical book order fails
- Verify Lulu production API keys are set
- Check Edge Function logs for `lulu-print` errors
- Verify PDF URLs are accessible

---

## Current Status: 🟡 NEEDS CONFIGURATION

**Before going live:**
1. ✅ Code is production-ready
2. ⚠️ Verify Stripe Price IDs
3. ⚠️ Set GEMINI_API_KEY
4. ⚠️ Set Lulu production API keys (if offering physical books)

**Estimated Time to Launch:** 15-30 minutes (just configuration)
