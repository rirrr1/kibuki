/*
  # Restore Date Filters to Admin Dashboard Functions

  ## Overview
  Restoring the date filters that limit admin dashboard visibility to records
  created after November 1, 2025. The purchases were made AFTER this date.

  ## Changes

  1. Restored Admin Functions
    - `get_all_users_admin()` - Filter users created after Nov 1, 2025
    - `get_all_comics_admin()` - Filter comics created after Nov 1, 2025
    - `get_all_orders_admin()` - Filter orders created after Nov 1, 2025
    - `get_all_credit_transactions_admin()` - Filter transactions created after Nov 1, 2025

  2. Date Filter
    - Added back: WHERE created_at >= '2025-11-01 00:00:00+00'
*/

-- ============================================================================
-- Drop existing functions to recreate with date filters
-- ============================================================================

DROP FUNCTION IF EXISTS get_all_users_admin();
DROP FUNCTION IF EXISTS get_all_comics_admin();
DROP FUNCTION IF EXISTS get_all_orders_admin();
DROP FUNCTION IF EXISTS get_all_credit_transactions_admin();

-- ============================================================================
-- Recreate admin functions WITH date filters
-- ============================================================================

-- Function to get all users (admin only)
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
    WHERE u.created_at >= '2025-11-01 00:00:00+00'::timestamptz
    ORDER BY u.created_at DESC;
END;
$$;

-- Function to get all comic generation jobs (admin only)
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
    WHERE cg.created_at >= '2025-11-01 00:00:00+00'::timestamptz
    ORDER BY cg.created_at DESC;
END;
$$;

-- Function to get all orders (admin only)
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
    AND o.created_at >= '2025-11-01 00:00:00+00'::timestamptz
    ORDER BY o.created_at DESC;
END;
$$;

-- Function to get all credit transactions (admin only)
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
  WHERE ct.created_at >= '2025-11-01 00:00:00+00'::timestamptz
  ORDER BY ct.created_at DESC;
END;
$$;
