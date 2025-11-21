/*
  # Fix Welcome Credits Trigger

  ## Changes
  - Update grant_welcome_credits function to handle errors properly
  - Add explicit error handling and logging
  - Ensure the function doesn't fail silently during user signup
  
  ## Security
  - Maintains SECURITY DEFINER to allow trigger to insert credits
  - Preserves existing RLS policies
*/

-- Drop and recreate the trigger function with better error handling
CREATE OR REPLACE FUNCTION grant_welcome_credits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result record;
BEGIN
    -- Create user_credits record with welcome bonus
    INSERT INTO user_credits (user_id, credit_balance, created_at, updated_at)
    VALUES (NEW.id, 20, now(), now())
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
        20,
        20,
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

-- Recreate the trigger
DROP TRIGGER IF EXISTS trigger_grant_welcome_credits ON auth.users;
CREATE TRIGGER trigger_grant_welcome_credits
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION grant_welcome_credits();
