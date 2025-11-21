/*
  # Fix Security and Performance Issues

  ## Overview
  This migration addresses critical security and performance issues identified by Supabase security scan.

  ## 1. Index Improvements
  
  ### Add Missing Foreign Key Index
  - Add index on `credit_transactions.comic_job_id` to improve foreign key query performance
  
  ### Remove Unused Indexes
  - Drop `idx_credit_transactions_created_at` (unused)
  - Drop `idx_comic_generation_jobs_created_at` (unused)
  - Drop `idx_comic_jobs_awaiting_approval` (unused)

  ## 2. RLS Policy Optimizations
  
  ### Optimize auth.uid() Calls
  All RLS policies updated to use `(SELECT auth.uid())` instead of `auth.uid()` to prevent
  re-evaluation for each row, significantly improving query performance at scale.
  
  Affected tables:
  - stripe_customers
  - stripe_subscriptions
  - stripe_orders
  - user_credits
  - credit_transactions
  - comic_generation_jobs

  ## 3. Multiple Permissive Policies Fix
  
  ### comic_generation_jobs
  - Remove duplicate permissive policies for SELECT
  - Keep only the user-scoped policy for authenticated users

  ## 4. Function Security Improvements
  
  ### Set Stable Search Path
  Add explicit `SET search_path = public, auth` to security definer functions:
  - add_credits
  - deduct_credits
  - cleanup_expired_temp_comic_data

  ## 5. Security Notes
  
  - Leaked Password Protection: Must be enabled manually in Supabase Auth settings
    (cannot be set via migration)
*/

-- ============================================================================
-- 1. INDEX IMPROVEMENTS
-- ============================================================================

-- Add missing foreign key index for credit_transactions.comic_job_id
CREATE INDEX IF NOT EXISTS idx_credit_transactions_comic_job_id 
ON credit_transactions(comic_job_id);

-- Drop unused indexes
DROP INDEX IF EXISTS idx_credit_transactions_created_at;
DROP INDEX IF EXISTS idx_comic_generation_jobs_created_at;
DROP INDEX IF EXISTS idx_comic_jobs_awaiting_approval;

-- ============================================================================
-- 2. OPTIMIZE RLS POLICIES - Use (SELECT auth.uid())
-- ============================================================================

-- stripe_customers
DROP POLICY IF EXISTS "Users can view their own customer data" ON stripe_customers;
CREATE POLICY "Users can view their own customer data"
    ON stripe_customers
    FOR SELECT
    TO authenticated
    USING (user_id = (SELECT auth.uid()) AND deleted_at IS NULL);

-- stripe_subscriptions
DROP POLICY IF EXISTS "Users can view their own subscription data" ON stripe_subscriptions;
CREATE POLICY "Users can view their own subscription data"
    ON stripe_subscriptions
    FOR SELECT
    TO authenticated
    USING (
        customer_id IN (
            SELECT customer_id
            FROM stripe_customers
            WHERE user_id = (SELECT auth.uid()) AND deleted_at IS NULL
        )
        AND deleted_at IS NULL
    );

-- stripe_orders
DROP POLICY IF EXISTS "Users can view their own order data" ON stripe_orders;
CREATE POLICY "Users can view their own order data"
    ON stripe_orders
    FOR SELECT
    TO authenticated
    USING (
        customer_id IN (
            SELECT customer_id
            FROM stripe_customers
            WHERE user_id = (SELECT auth.uid()) AND deleted_at IS NULL
        )
        AND deleted_at IS NULL
    );

-- user_credits
DROP POLICY IF EXISTS "Users can view their own credits" ON user_credits;
CREATE POLICY "Users can view their own credits"
    ON user_credits
    FOR SELECT
    TO authenticated
    USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can update their own credits" ON user_credits;
CREATE POLICY "Users can update their own credits"
    ON user_credits
    FOR UPDATE
    TO authenticated
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));

-- credit_transactions
DROP POLICY IF EXISTS "Users can view their own transactions" ON credit_transactions;
CREATE POLICY "Users can view their own transactions"
    ON credit_transactions
    FOR SELECT
    TO authenticated
    USING (user_id = (SELECT auth.uid()));

-- comic_generation_jobs - Fix multiple permissive policies issue
DROP POLICY IF EXISTS "Allow public access to comic generation jobs" ON comic_generation_jobs;
DROP POLICY IF EXISTS "Users can view their own jobs" ON comic_generation_jobs;

-- Create single optimized policy for comic_generation_jobs
CREATE POLICY "Users can view their own jobs"
    ON comic_generation_jobs
    FOR SELECT
    TO authenticated
    USING (user_id = (SELECT auth.uid()));

-- ============================================================================
-- 3. FIX FUNCTION SEARCH PATHS (Security Definer Functions)
-- ============================================================================

-- Recreate add_credits with stable search_path
CREATE OR REPLACE FUNCTION add_credits(
    p_user_id uuid,
    p_amount integer,
    p_transaction_type credit_transaction_type,
    p_description text DEFAULT NULL,
    p_stripe_payment_intent_id text DEFAULT NULL
)
RETURNS TABLE(success boolean, new_balance integer, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_new_balance integer;
BEGIN
    -- Validate amount is positive
    IF p_amount <= 0 THEN
        RETURN QUERY SELECT false, 0, 'Amount must be positive';
        RETURN;
    END IF;

    -- Insert user_credits record if it doesn't exist
    INSERT INTO user_credits (user_id, credit_balance)
    VALUES (p_user_id, 0)
    ON CONFLICT (user_id) DO NOTHING;

    -- Update credit balance
    UPDATE user_credits
    SET 
        credit_balance = credit_balance + p_amount,
        updated_at = now()
    WHERE user_id = p_user_id
    RETURNING credit_balance INTO v_new_balance;

    -- Log transaction
    INSERT INTO credit_transactions (
        user_id,
        transaction_type,
        amount,
        credit_balance_after,
        description,
        stripe_payment_intent_id
    ) VALUES (
        p_user_id,
        p_transaction_type,
        p_amount,
        v_new_balance,
        p_description,
        p_stripe_payment_intent_id
    );

    RETURN QUERY SELECT true, v_new_balance, 'Credits added successfully';
END;
$$;

-- Recreate deduct_credits with stable search_path
CREATE OR REPLACE FUNCTION deduct_credits(
    p_user_id uuid,
    p_amount integer,
    p_transaction_type credit_transaction_type,
    p_description text DEFAULT NULL,
    p_comic_job_id uuid DEFAULT NULL
)
RETURNS TABLE(success boolean, new_balance integer, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_current_balance integer;
    v_new_balance integer;
BEGIN
    -- Validate amount is positive
    IF p_amount <= 0 THEN
        RETURN QUERY SELECT false, 0, 'Amount must be positive';
        RETURN;
    END IF;

    -- Get current balance
    SELECT credit_balance INTO v_current_balance
    FROM user_credits
    WHERE user_id = p_user_id
    FOR UPDATE;

    -- Check if user has credit record
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 0, 'User credit account not found';
        RETURN;
    END IF;

    -- Check if sufficient credits
    IF v_current_balance < p_amount THEN
        RETURN QUERY SELECT false, v_current_balance, 'Insufficient credits';
        RETURN;
    END IF;

    -- Deduct credits
    UPDATE user_credits
    SET 
        credit_balance = credit_balance - p_amount,
        updated_at = now()
    WHERE user_id = p_user_id
    RETURNING credit_balance INTO v_new_balance;

    -- Log transaction (amount is negative for deductions)
    INSERT INTO credit_transactions (
        user_id,
        transaction_type,
        amount,
        credit_balance_after,
        description,
        comic_job_id
    ) VALUES (
        p_user_id,
        p_transaction_type,
        -p_amount,
        v_new_balance,
        p_description,
        p_comic_job_id
    );

    RETURN QUERY SELECT true, v_new_balance, 'Credits deducted successfully';
END;
$$;

-- Recreate cleanup_expired_temp_comic_data with stable search_path (if exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_proc WHERE proname = 'cleanup_expired_temp_comic_data'
    ) THEN
        CREATE OR REPLACE FUNCTION cleanup_expired_temp_comic_data()
        RETURNS void
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path = public, auth
        AS $func$
        BEGIN
            -- Delete temp comic data older than 24 hours
            DELETE FROM temp_comic_data
            WHERE created_at < NOW() - INTERVAL '24 hours';
        END;
        $func$;
    END IF;
END $$;
