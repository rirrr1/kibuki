/*
  # Update Credit Packages - EUR Pricing

  1. Changes
    - Updates credit packages to new EUR pricing structure
    - 100 Credits = €9.90 (Starter - 1 comic)
    - 200 Credits = €17.90 (Creator - 2 comics) 
    - 400 Credits = €29.90 (Studio - 4 comics)
    - Updates Stripe price IDs for live mode

  2. Notes
    - Credit costs: Full comic = 100 credits, Page regeneration = 10 credits
    - Currency changed from CHF to EUR
    - Package names updated to Starter/Creator/Studio
*/

-- Delete old packages first
DELETE FROM credit_packages;

-- Insert new EUR packages
INSERT INTO credit_packages (package_name, credits, price_cents, currency, stripe_price_id_test, stripe_price_id_live, display_order, is_active)
VALUES 
  ('Starter', 100, 990, 'eur', 'price_test_single_chf', 'price_1SOwgMDWkrplu452SjkeNJJI', 1, true),
  ('Creator', 200, 1790, 'eur', 'price_test_editor_chf', 'price_1SOwhZDWkrplu4522iTCqUDW', 2, true),
  ('Studio', 400, 2990, 'eur', 'price_test_fan_chf', 'price_1SOwhZDWkrplu4522iTCqUDW', 3, true);