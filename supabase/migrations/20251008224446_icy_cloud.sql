/*
  # Add heartbeat system to comic generation jobs

  1. Schema Changes
    - Add `current_page` column to track progress
    - Add `last_heartbeat_at` column to detect stalled jobs
    - Add index for efficient cron queries

  2. Purpose
    - Prevent job interruption when user closes window
    - Enable job resumption from last known state
    - Ensure users always receive confirmation emails
*/

-- Add heartbeat columns to existing table
ALTER TABLE comic_generation_jobs 
ADD COLUMN IF NOT EXISTS current_page integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_heartbeat_at timestamptz DEFAULT now();

-- Add index for efficient cron job queries
CREATE INDEX IF NOT EXISTS idx_comic_jobs_heartbeat 
ON comic_generation_jobs (status, last_heartbeat_at) 
WHERE status = 'processing';

-- Update existing processing jobs to have heartbeat
UPDATE comic_generation_jobs 
SET last_heartbeat_at = now() 
WHERE status = 'processing' AND last_heartbeat_at IS NULL;