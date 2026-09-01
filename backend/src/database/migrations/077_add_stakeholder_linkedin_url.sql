-- Add linkedin_profile_url column to stakeholders table
ALTER TABLE stakeholders ADD COLUMN IF NOT EXISTS linkedin_profile_url TEXT;
