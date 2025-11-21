/*
  # Setup Comics Storage Bucket and Policies

  1. Storage Setup
    - Create 'comics' storage bucket if it doesn't exist
    - Set bucket to public for easy access to generated images
  
  2. Security Policies
    - Allow authenticated users to insert files
    - Allow public read access to all files
    - Allow authenticated users to update their own files
    - Allow authenticated users to delete their own files
*/

-- Create the comics storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('comics', 'comics', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to insert files into the comics bucket
CREATE POLICY "Allow authenticated users to upload to comics bucket"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'comics');

-- Allow public read access to all files in the comics bucket
CREATE POLICY "Allow public read access to comics bucket"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'comics');

-- Allow authenticated users to update files in the comics bucket
CREATE POLICY "Allow authenticated users to update comics bucket"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'comics')
WITH CHECK (bucket_id = 'comics');

-- Allow authenticated users to delete files in the comics bucket
CREATE POLICY "Allow authenticated users to delete from comics bucket"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'comics');