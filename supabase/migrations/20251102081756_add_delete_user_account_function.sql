/*
  # Add delete_user_account function

  1. Function
    - `delete_user_account()` - Allows users to delete their own account
      - Deletes all user's comic generation jobs
      - Deletes all user's credit transactions  
      - Deletes user's credit balance
      - Deletes the user from auth.users (cascades to related tables)

  2. Security
    - Function uses security definer to allow deletion from auth schema
    - Only allows users to delete their own account (auth.uid() check)
    - Wrapped in transaction for data integrity
*/

-- Create function to delete user account
CREATE OR REPLACE FUNCTION delete_user_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Get the current user's ID
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Delete user's comic generation jobs
  DELETE FROM comic_generation_jobs WHERE user_id = v_user_id;

  -- Delete user's credit transactions
  DELETE FROM credit_transactions WHERE user_id = v_user_id;

  -- Delete user's credit balance
  DELETE FROM user_credits WHERE user_id = v_user_id;

  -- Delete the user from auth.users (this will cascade to other tables)
  DELETE FROM auth.users WHERE id = v_user_id;

END;
$$;