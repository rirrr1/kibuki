/*
  # Update Credit Packages to CHF Pricing

  ## Changes
  - Update currency from EUR to CHF
  - Update pricing to match requirements:
    - Single: 20 credits - CHF 9.99 (999 cents)
    - Editor: 40 credits - CHF 19.90 (1990 cents)
    - Comic Fan: 100 credits - CHF 29.90 (2990 cents)
  - Update Stripe price IDs to placeholder values (to be replaced with actual Stripe test IDs)

  ## Notes
  - Prices are stored in cents (rappen for CHF)
  - Actual Stripe price IDs will need to be created in Stripe Dashboard
  - These are test mode placeholders
*/

-- Update credit packages with CHF pricing
UPDATE credit_packages 
SET 
  currency = 'chf',
  price_cents = 999,
  stripe_price_id_test = 'price_test_single_chf',
  stripe_price_id_live = 'price_live_single_chf'
WHERE package_name = 'Single';

UPDATE credit_packages 
SET 
  currency = 'chf',
  price_cents = 1990,
  stripe_price_id_test = 'price_test_editor_chf',
  stripe_price_id_live = 'price_live_editor_chf'
WHERE package_name = 'Editor';

UPDATE credit_packages 
SET 
  currency = 'chf',
  price_cents = 2990,
  stripe_price_id_test = 'price_test_fan_chf',
  stripe_price_id_live = 'price_live_fan_chf'
WHERE package_name = 'Comic Fan';
