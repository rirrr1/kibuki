/*
  # Create temporary comic data storage

  1. New Tables
    - `temp_comic_data`
      - `id` (uuid, primary key)
      - `comic_data` (jsonb) - stores the comic configuration
      - `photo_data` (text) - stores base64 photo data
      - `checkout_data` (jsonb) - stores checkout information
      - `created_at` (timestamp)
      - `expires_at` (timestamp) - auto-cleanup after 24 hours

  2. Security
    - Enable RLS on `temp_comic_data` table
    - Add policy for public access (temporary data, no auth needed)
    - Add automatic cleanup for expired records
*/

CREATE TABLE IF NOT EXISTS temp_comic_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comic_data jsonb NOT NULL,
  photo_data text NOT NULL,
  checkout_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '24 hours')
);

ALTER TABLE temp_comic_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public access to temp comic data"
  ON temp_comic_data
  FOR ALL
  TO public
  USING (expires_at > now())
  WITH CHECK (expires_at > now());

-- Create index for cleanup
CREATE INDEX IF NOT EXISTS idx_temp_comic_data_expires_at 
  ON temp_comic_data (expires_at);

-- Create function to cleanup expired records
CREATE OR REPLACE FUNCTION cleanup_expired_temp_comic_data()
RETURNS void AS $$
BEGIN
  DELETE FROM temp_comic_data WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql;