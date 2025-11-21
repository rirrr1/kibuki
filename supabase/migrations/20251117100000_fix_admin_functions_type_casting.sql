/*
  # Fix Admin Functions Type Casting

  1. Problem
    - Admin functions have type mismatch errors
    - auth.users.email is varchar(255) but functions expect text
    - Enum fields need explicit casting to text

  2. Solution
    - Add explicit ::text casting for all varchar and enum fields
    - Add missing fields (progress, current_page, last_heartbeat_at, error_message)
    - Ensure all functions return correct data types

  3. Updated Functions
    - get_all_users_admin() - Fixed email type casting
    - get_all_comics_admin() - Fixed email, status, added missing fields
    - get_all_orders_admin() - Fixed email and status casting
    - get_all_credit_transactions_admin() - Fixed email and transaction_type casting
*/

-- Drop existing functions first to avoid type conflicts
DROP FUNCTION IF EXISTS get_all_users_admin();
DROP FUNCTION IF EXISTS get_all_comics_admin();
DROP FUNCTION IF EXISTS get_all_orders_admin();
DROP FUNCTION IF EXISTS get_all_credit_transactions_admin();

-- Function to get all users (admin only) - FIXED
CREATE OR REPLACE FUNCTION get_all_users_admin()
RETURNS TABLE(
    id uuid,
    email text,
    created_at timestamptz,
    credit_balance integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    -- Check if user is admin
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Access denied. Admin only.';
    END IF;

    RETURN QUERY
    SELECT
        u.id,
        u.email::text,
        u.created_at,
        COALESCE(uc.credit_balance, 0) as credit_balance
    FROM auth.users u
    LEFT JOIN user_credits uc ON u.id = uc.user_id
    ORDER BY u.created_at DESC;
END;
$$;

-- Function to get all comic generation jobs (admin only) - FIXED
CREATE OR REPLACE FUNCTION get_all_comics_admin()
RETURNS TABLE(
    id uuid,
    user_id uuid,
    user_email text,
    status text,
    created_at timestamptz,
    input_data jsonb,
    output_data jsonb,
    credits_used integer,
    progress integer,
    current_page integer,
    error_message text,
    last_heartbeat_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    -- Check if user is admin
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Access denied. Admin only.';
    END IF;

    RETURN QUERY
    SELECT
        cg.id,
        cg.user_id,
        u.email::text as user_email,
        cg.status::text,
        cg.created_at,
        cg.input_data,
        cg.output_data,
        cg.credits_used,
        cg.progress,
        cg.current_page,
        cg.error_message,
        cg.last_heartbeat_at
    FROM comic_generation_jobs cg
    LEFT JOIN auth.users u ON cg.user_id = u.id
    ORDER BY cg.created_at DESC;
END;
$$;

-- Function to get all orders (admin only) - FIXED
CREATE OR REPLACE FUNCTION get_all_orders_admin()
RETURNS TABLE(
    id bigint,
    user_id uuid,
    user_email text,
    checkout_session_id text,
    payment_intent_id text,
    amount_total bigint,
    currency text,
    payment_status text,
    status text,
    created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    -- Check if user is admin
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Access denied. Admin only.';
    END IF;

    RETURN QUERY
    SELECT
        o.id,
        sc.user_id,
        u.email::text as user_email,
        o.checkout_session_id,
        o.payment_intent_id,
        o.amount_total,
        o.currency,
        o.payment_status,
        o.status::text,
        o.created_at
    FROM stripe_orders o
    LEFT JOIN stripe_customers sc ON o.customer_id = sc.customer_id
    LEFT JOIN auth.users u ON sc.user_id = u.id
    WHERE o.deleted_at IS NULL
    ORDER BY o.created_at DESC;
END;
$$;

-- Function to get all credit transactions (admin only) - FIXED
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
SET search_path = public, auth
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if caller is admin
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied. Admin only.';
  END IF;

  RETURN QUERY
  SELECT
    ct.id,
    ct.user_id,
    COALESCE(au.email::text, 'unknown') as user_email,
    ct.transaction_type::text,
    ct.amount,
    ct.credit_balance_after as balance_after,
    ct.description,
    ct.created_at,
    ct.comic_job_id,
    ct.stripe_payment_intent_id
  FROM credit_transactions ct
  LEFT JOIN auth.users au ON au.id = ct.user_id
  ORDER BY ct.created_at DESC;
END;
$$;
