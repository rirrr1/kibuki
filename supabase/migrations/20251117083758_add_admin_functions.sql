/*
  # Add Admin Functions for ricrieg@gmail.com

  1. New Functions
    - `is_admin()`: Check if current user is admin
    - `get_all_users_admin()`: Get all registered users
    - `get_all_comics_admin()`: Get all comic generation jobs with user info
    - `get_all_orders_admin()`: Get all orders with user info

  2. Security
    - Functions use SECURITY DEFINER to bypass RLS
    - Check that calling user is ricrieg@gmail.com
    - Admin-only access enforced in functions
*/

-- Function to check if current user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_email text;
BEGIN
    SELECT email INTO v_email
    FROM auth.users
    WHERE id = auth.uid();
    
    RETURN v_email = 'ricrieg@gmail.com';
END;
$$;

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
    -- Check if user is admin
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Access denied. Admin only.';
    END IF;

    RETURN QUERY
    SELECT 
        u.id,
        u.email,
        u.created_at,
        COALESCE(uc.credit_balance, 0) as credit_balance
    FROM auth.users u
    LEFT JOIN user_credits uc ON u.id = uc.user_id
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
    credits_used integer
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
        u.email as user_email,
        cg.status,
        cg.created_at,
        cg.input_data,
        cg.output_data,
        cg.credits_used
    FROM comic_generation_jobs cg
    LEFT JOIN auth.users u ON cg.user_id = u.id
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
    -- Check if user is admin
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Access denied. Admin only.';
    END IF;

    RETURN QUERY
    SELECT 
        o.id,
        sc.user_id,
        u.email as user_email,
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
