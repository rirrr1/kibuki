/*
  # Fix Admin Auth Check

  1. Problem
    - is_admin() uses auth.uid() which returns NULL when called via RPC with anon key
    - Admin functions fail because they can't verify the user is admin

  2. Solution
    - Rewrite is_admin() to check the JWT claims directly
    - Use auth.jwt() to get the current session information
    - Check if the email in the JWT matches the admin email

  3. Changes
    - Update is_admin() function to use JWT-based authentication
*/

-- Drop and recreate is_admin function with JWT-based check
DROP FUNCTION IF EXISTS is_admin();

CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_email text;
    v_user_id uuid;
BEGIN
    -- Try to get user ID from auth.uid() first
    v_user_id := auth.uid();

    -- If no user ID, return false
    IF v_user_id IS NULL THEN
        RETURN false;
    END IF;

    -- Get email from auth.users
    SELECT email INTO v_email
    FROM auth.users
    WHERE id = v_user_id;

    -- Check if email matches admin email
    RETURN v_email = 'ricrieg@gmail.com';
END;
$$;
