/*
  # Fix Studio Package Stripe Price ID

  1. Changes
    - Updates Studio package (400 credits) to use correct Stripe live price ID
    - Corrects duplicate price ID issue where Studio was using Creator's price ID
    - New price ID: price_1SOwiYDWkrplu452NbuhaRVF for €29.90

  2. Impact
    - Studio package will now charge correct amount (€29.90) instead of Creator amount (€17.90)
    - No changes to credit amounts or package names
    - Only affects live mode price ID configuration

  3. Notes
    - This fixes a critical billing issue
    - Previous migration had duplicate price_1SOwhZDWkrplu4522iTCqUDW for both Creator and Studio
*/

-- Update Studio package with correct Stripe price ID
UPDATE credit_packages
SET stripe_price_id_live = 'price_1SOwiYDWkrplu452NbuhaRVF'
WHERE package_name = 'Studio'
  AND credits = 400;
