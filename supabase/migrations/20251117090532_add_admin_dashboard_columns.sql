/*
  # Add Admin Dashboard Support Columns

  1. Changes to comic_generation_jobs
    - Add `error_message` column to store failure reasons for failed jobs
    - Add `error_details` jsonb column to store structured error information
  
  2. Security
    - No RLS changes needed, admin functions already use service role
*/

-- Add error_message column if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'comic_generation_jobs' AND column_name = 'error_message'
    ) THEN
        ALTER TABLE comic_generation_jobs ADD COLUMN error_message text;
    END IF;
END $$;

-- Add error_details column if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'comic_generation_jobs' AND column_name = 'error_details'
    ) THEN
        ALTER TABLE comic_generation_jobs ADD COLUMN error_details jsonb DEFAULT '{}'::jsonb;
    END IF;
END $$;
