/*
  # Add Manual Credit Management Function for Admin

  ## Overview
  This migration adds a function that allows admins to manually add credits to any user account.
  This is useful for:
  - Fixing failed Stripe purchases that didn't add credits
  - Providing compensation for service issues
  - Granting promotional credits
  - Manual adjustments for support requests

  ## New Functions

  1. `manually_add_credits_admin(p_user_email text, p_credits integer, p_reason text)`
     - Takes a user email (easier than user_id for admin use)
     - Accepts the number of credits to add
     - Requires a reason/description for audit trail
     - Checks that calling user is admin (ricrieg@gmail.com)
     - Validates that user exists before adding credits
     - Uses existing add_credits() function with 'adjustment' transaction type
     - Returns detailed success/failure information with new balance

  ## Security
  - Function uses SECURITY DEFINER to bypass RLS
  - Admin check enforced using is_admin() function
  - All actions logged in credit_transactions table with full audit trail
*/

-- ============================================================================
-- Manual Credit Addition Function for Admin
-- ============================================================================

CREATE OR REPLACE FUNCTION manually_add_credits_admin(
    p_user_email text,
    p_credits integer,
    p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_user_id uuid;
    v_current_balance integer;
    v_credit_result jsonb;
    v_description text;
BEGIN
    -- Check if user is admin
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Access denied. Admin only.';
    END IF;

    -- Validate inputs
    IF p_credits IS NULL OR p_credits <= 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Credits must be a positive number'
        );
    END IF;

    IF p_reason IS NULL OR trim(p_reason) = '' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Reason is required for manual credit additions'
        );
    END IF;

    -- Find user by email
    SELECT id INTO v_user_id
    FROM auth.users
    WHERE email = p_user_email;

    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'User not found with email: ' || p_user_email
        );
    END IF;

    -- Get current balance before adding credits
    SELECT credit_balance INTO v_current_balance
    FROM user_credits
    WHERE user_id = v_user_id;

    IF v_current_balance IS NULL THEN
        v_current_balance := 0;
    END IF;

    -- Build description
    v_description := 'Manual credit addition by admin: ' || p_reason;

    -- Add credits using the existing add_credits function
    SELECT * INTO v_credit_result
    FROM add_credits(
        p_user_id := v_user_id,
        p_amount := p_credits,
        p_transaction_type := 'adjustment',
        p_description := v_description,
        p_stripe_payment_intent_id := NULL
    );

    -- Return success with details
    RETURN jsonb_build_object(
        'success', true,
        'user_id', v_user_id,
        'user_email', p_user_email,
        'credits_added', p_credits,
        'previous_balance', v_current_balance,
        'new_balance', (v_credit_result->0->>'new_balance')::integer,
        'reason', p_reason,
        'added_at', now()
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM,
            'error_detail', SQLSTATE
        );
END;
$$;

-- ============================================================================
-- Bulk Manual Credit Addition Function (for multiple users)
-- ============================================================================

CREATE OR REPLACE FUNCTION manually_add_credits_bulk_admin(
    p_operations jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_operation jsonb;
    v_result jsonb;
    v_results jsonb := '[]'::jsonb;
    v_success_count integer := 0;
    v_failure_count integer := 0;
BEGIN
    -- Check if user is admin
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Access denied. Admin only.';
    END IF;

    -- Process each operation
    FOR v_operation IN SELECT * FROM jsonb_array_elements(p_operations)
    LOOP
        v_result := manually_add_credits_admin(
            v_operation->>'email',
            (v_operation->>'credits')::integer,
            v_operation->>'reason'
        );

        IF (v_result->>'success')::boolean THEN
            v_success_count := v_success_count + 1;
        ELSE
            v_failure_count := v_failure_count + 1;
        END IF;

        v_results := v_results || jsonb_build_object(
            'email', v_operation->>'email',
            'result', v_result
        );
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'total_operations', jsonb_array_length(p_operations),
        'successful', v_success_count,
        'failed', v_failure_count,
        'results', v_results
    );
END;
$$;

-- ============================================================================
-- Get User Credit Summary (helpful for admin to check before adding credits)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_user_credit_summary_admin(p_user_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_user_id uuid;
    v_result jsonb;
BEGIN
    -- Check if user is admin
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Access denied. Admin only.';
    END IF;

    -- Find user by email
    SELECT id INTO v_user_id
    FROM auth.users
    WHERE email = p_user_email;

    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'User not found with email: ' || p_user_email
        );
    END IF;

    -- Build comprehensive summary
    SELECT jsonb_build_object(
        'success', true,
        'user_id', v_user_id,
        'user_email', p_user_email,
        'current_balance', COALESCE(uc.credit_balance, 0),
        'total_purchased', COALESCE((
            SELECT SUM(amount)
            FROM credit_transactions
            WHERE user_id = v_user_id
            AND transaction_type = 'purchase'
        ), 0),
        'total_used', COALESCE((
            SELECT SUM(ABS(amount))
            FROM credit_transactions
            WHERE user_id = v_user_id
            AND amount < 0
        ), 0),
        'total_adjustments', COALESCE((
            SELECT SUM(amount)
            FROM credit_transactions
            WHERE user_id = v_user_id
            AND transaction_type = 'adjustment'
        ), 0),
        'transaction_count', COALESCE((
            SELECT COUNT(*)
            FROM credit_transactions
            WHERE user_id = v_user_id
        ), 0),
        'last_transaction', (
            SELECT jsonb_build_object(
                'type', transaction_type,
                'amount', amount,
                'description', description,
                'created_at', created_at
            )
            FROM credit_transactions
            WHERE user_id = v_user_id
            ORDER BY created_at DESC
            LIMIT 1
        )
    ) INTO v_result
    FROM user_credits uc
    WHERE uc.user_id = v_user_id;

    RETURN v_result;
END;
$$;
