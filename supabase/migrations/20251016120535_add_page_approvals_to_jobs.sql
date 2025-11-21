/*
  # Add page approvals system to comic generation jobs

  1. Schema Changes
    - Add `pageApprovals` JSONB column to track approval status per page
    - Add index on status for efficient queries on awaiting_approval jobs

  2. Purpose
    - Enable page-by-page approval workflow
    - Track which pages user has approved (cover, storyPage1-10)
    - Support edit/re-approval cycles before PDF generation

  3. Structure
    - pageApprovals: {"cover": true, "storyPage1": true, ...}
    - Default: empty object {}
*/

-- Add pageApprovals column to existing table
ALTER TABLE comic_generation_jobs 
ADD COLUMN IF NOT EXISTS page_approvals JSONB DEFAULT '{}'::jsonb;

-- Add index for efficient status queries
CREATE INDEX IF NOT EXISTS idx_comic_jobs_awaiting_approval 
ON comic_generation_jobs (status) 
WHERE status = 'awaiting_approval';

-- Update existing completed jobs to have all pages approved (backward compatibility)
UPDATE comic_generation_jobs 
SET page_approvals = '{"cover": true, "storyPage1": true, "storyPage2": true, "storyPage3": true, "storyPage4": true, "storyPage5": true, "storyPage6": true, "storyPage7": true, "storyPage8": true, "storyPage9": true, "storyPage10": true}'::jsonb
WHERE status = 'completed' AND page_approvals = '{}'::jsonb;
