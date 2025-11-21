/*
  # Update Welcome Bonus to 100 Credits

  ## Overview
  This migration updates the welcome bonus from 20 credits to 100 credits to ensure new users
  can generate their first comic (which costs 100 credits) immediately upon signup.

  ## Changes
  1. Update grant_welcome_credits function to award 100 credits instead of 20
  2. Backfill existing users who received only 20 credits with an additional 80 credits
  3. Update credit package descriptions if needed

  ## Security
  - Maintains existing SECURITY DEFINER for trigger function
  - Preserves all RLS policies
  - Uses safe conditional logic to avoid duplicate credits
*/

-- Update the grant_welcome_credits function to award 100 credits
CREATE OR REPLACE FUNCTION grant_welcome_credits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result record;
BEGIN
    -- Create user_credits record with 100 welcome credits
    INSERT INTO user_credits (user_id, credit_balance, created_at, updated_at)
    VALUES (NEW.id, 100, now(), now())
    ON CONFLICT (user_id) DO NOTHING;
    
    -- Log the welcome bonus transaction
    INSERT INTO credit_transactions (
        user_id,
        transaction_type,
        amount,
        credit_balance_after,
        description,
        created_at
    ) VALUES (
        NEW.id,
        'welcome_bonus'::credit_transaction_type,
        100,
        100,
        'Welcome bonus - Create your first comic for free!',
        now()
    );
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log error but don't fail user creation
        RAISE WARNING 'Failed to grant welcome credits for user %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$;

-- Backfill existing users who only received 20 credits
-- This gives them an additional 80 credits to reach 100 total
DO $$
DECLARE
    v_user_record RECORD;
    v_current_balance integer;
    v_welcome_bonus_amount integer;
BEGIN
    -- Loop through users who received the old 20-credit welcome bonus
    FOR v_user_record IN
        SELECT DISTINCT 
            uc.user_id,
            uc.credit_balance
        FROM user_credits uc
        INNER JOIN credit_transactions ct 
            ON ct.user_id = uc.user_id 
            AND ct.transaction_type = 'welcome_bonus'
        WHERE ct.amount = 20  -- Old welcome bonus amount
            AND NOT EXISTS (
                -- Ensure we don't give adjustment twice
                SELECT 1 FROM credit_transactions ct2
                WHERE ct2.user_id = uc.user_id
                AND ct2.transaction_type = 'adjustment'
                AND ct2.description ILIKE '%welcome bonus upgrade%'
            )
    LOOP
        -- Add 80 credits to bring total to 100
        UPDATE user_credits
        SET 
            credit_balance = credit_balance + 80,
            updated_at = now()
        WHERE user_id = v_user_record.user_id
        RETURNING credit_balance INTO v_current_balance;
        
        -- Log the adjustment transaction
        INSERT INTO credit_transactions (
            user_id,
            transaction_type,
            amount,
            credit_balance_after,
            description,
            created_at
        ) VALUES (
            v_user_record.user_id,
            'adjustment'::credit_transaction_type,
            80,
            v_current_balance,
            'Welcome bonus upgrade - Additional credits to reach 100 total',
            now()
        );
        
        RAISE NOTICE 'Upgraded welcome bonus for user % from 20 to 100 credits', v_user_record.user_id;
    END LOOP;
END;
$$;

-- Recreate the trigger (already exists but ensures it's using the updated function)
DROP TRIGGER IF EXISTS trigger_grant_welcome_credits ON auth.users;
CREATE TRIGGER trigger_grant_welcome_credits
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION grant_welcome_credits();
