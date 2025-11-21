/*
  # Add Credit Transactions Admin Function

  1. New Functions
    - `get_all_credit_transactions_admin()` - Returns all credit transactions with user emails for admin dashboard
  
  2. Returns
    - id, user_id, user_email, transaction_type, amount, balance_after, description, created_at, comic_job_id, stripe_payment_intent_id
  
  3. Security
    - Function is security definer and checks admin email
*/

-- Create admin function to get all credit transactions
CREATE OR REPLACE FUNCTION get_all_credit_transactions_admin()
RETURNS TABLE (
  id bigint,
  user_id uuid,
  user_email text,
  transaction_type text,
  amount integer,
  balance_after integer,
  description text,
  created_at timestamptz,
  comic_job_id uuid,
  stripe_payment_intent_id text
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if caller is admin
  IF (SELECT auth.email()) != 'ricrieg@gmail.com' THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT 
    ct.id,
    ct.user_id,
    COALESCE(au.email, 'unknown') as user_email,
    ct.transaction_type,
    ct.amount,
    ct.balance_after,
    ct.description,
    ct.created_at,
    ct.comic_job_id,
    ct.stripe_payment_intent_id
  FROM credit_transactions ct
  LEFT JOIN auth.users au ON au.id = ct.user_id
  ORDER BY ct.created_at DESC;
END;
$$;
