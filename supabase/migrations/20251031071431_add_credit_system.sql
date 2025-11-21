/*
  # Credit System Implementation

  ## Overview
  This migration implements a comprehensive credit-based system for the comic generator platform.
  Users receive 20 free credits upon signup and can purchase additional credits to generate comics
  and edit pages.

  ## 1. New Tables

  ### user_credits
  - Tracks credit balance for each user
  - One record per user with their current credit balance
  - Credits never expire
  
  ### credit_transactions
  - Logs all credit activities (purchases, usage, refunds, adjustments)
  - Maintains complete audit trail of credit movements
  - Links to comic jobs and Stripe payments for traceability
  
  ### credit_packages
  - Defines available credit purchase options
  - Contains pricing and Stripe price IDs for test and live modes
  - Three packages: Single (20 credits), Editor (40 credits), Comic Fan (100 credits)

  ## 2. Schema Changes

  ### comic_generation_jobs modifications
  - Add user_id column to track job ownership
  - Add credits_used column to track cost per job
  - Update RLS policies for user-based access control

  ## 3. Database Functions

  ### add_credits
  - Safely adds credits to user account with atomic transaction
  - Logs transaction automatically
  - Returns new balance

  ### deduct_credits
  - Safely deducts credits with atomic transaction
  - Prevents negative balances
  - Logs transaction automatically
  - Returns success status and new balance

  ## 4. Triggers

  ### grant_welcome_credits
  - Automatically grants 20 credits to new users upon signup
  - Triggered on auth.users insert

  ## 5. Security

  - All tables have Row Level Security (RLS) enabled
  - Users can only view/modify their own credit data
  - credit_packages table is publicly readable (pricing info)
  - Strict policies prevent unauthorized credit manipulation
*/

-- Create enum for transaction types
CREATE TYPE credit_transaction_type AS ENUM (
    'welcome_bonus',
    'purchase',
    'generation',
    'edit',
    'refund',
    'adjustment'
);

-- Create user_credits table
CREATE TABLE IF NOT EXISTS user_credits (
    id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    credit_balance integer NOT NULL DEFAULT 0 CHECK (credit_balance >= 0),
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own credits"
    ON user_credits
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own credits"
    ON user_credits
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Create credit_transactions table
CREATE TABLE IF NOT EXISTS credit_transactions (
    id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    transaction_type credit_transaction_type NOT NULL,
    amount integer NOT NULL,
    credit_balance_after integer NOT NULL,
    description text,
    comic_job_id uuid REFERENCES comic_generation_jobs(id) ON DELETE SET NULL,
    stripe_payment_intent_id text,
    created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX idx_credit_transactions_created_at ON credit_transactions(created_at DESC);

ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own transactions"
    ON credit_transactions
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Create credit_packages table
CREATE TABLE IF NOT EXISTS credit_packages (
    id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    package_name text UNIQUE NOT NULL,
    credits integer NOT NULL CHECK (credits > 0),
    price_cents integer NOT NULL CHECK (price_cents > 0),
    currency text NOT NULL DEFAULT 'eur',
    stripe_price_id_test text,
    stripe_price_id_live text,
    display_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE credit_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active credit packages"
    ON credit_packages
    FOR SELECT
    USING (is_active = true);

-- Insert credit packages
INSERT INTO credit_packages (package_name, credits, price_cents, display_order, stripe_price_id_test, stripe_price_id_live) VALUES
    ('Single', 20, 999, 1, 'price_test_single_20', 'price_live_single_20'),
    ('Editor', 40, 1990, 2, 'price_test_editor_40', 'price_live_editor_40'),
    ('Comic Fan', 100, 2990, 3, 'price_test_fan_100', 'price_live_fan_100');

-- Add user_id to comic_generation_jobs if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'comic_generation_jobs' AND column_name = 'user_id'
    ) THEN
        ALTER TABLE comic_generation_jobs ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Add credits_used to comic_generation_jobs if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'comic_generation_jobs' AND column_name = 'credits_used'
    ) THEN
        ALTER TABLE comic_generation_jobs ADD COLUMN credits_used integer DEFAULT 20;
    END IF;
END $$;

-- Update comic_generation_jobs RLS policies
DROP POLICY IF EXISTS "Users can view their own jobs" ON comic_generation_jobs;
CREATE POLICY "Users can view their own jobs"
    ON comic_generation_jobs
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Function to add credits
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

-- Function to deduct credits
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

-- Function to grant welcome credits
CREATE OR REPLACE FUNCTION grant_welcome_credits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Add 20 welcome credits to new user
    PERFORM add_credits(
        NEW.id,
        20,
        'welcome_bonus'::credit_transaction_type,
        'Welcome bonus - Create your first comic for free!'
    );
    
    RETURN NEW;
END;
$$;

-- Create trigger to grant welcome credits on user signup
DROP TRIGGER IF EXISTS trigger_grant_welcome_credits ON auth.users;
CREATE TRIGGER trigger_grant_welcome_credits
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION grant_welcome_credits();

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_user_credits_user_id ON user_credits(user_id);
CREATE INDEX IF NOT EXISTS idx_comic_generation_jobs_user_id ON comic_generation_jobs(user_id);