-- Migration: Add theme fields to user_profiles table
-- Date: 2024-01-07
-- Description: Add theme customization fields for user preferences

-- Add theme columns to user_profiles table
ALTER TABLE user_profiles 
ADD COLUMN theme_mode VARCHAR(10) DEFAULT 'light' CHECK (theme_mode IN ('light', 'dark')),
ADD COLUMN theme_primary_color VARCHAR(7) DEFAULT '#1976d2' CHECK (theme_primary_color ~ '^#[0-9A-Fa-f]{6}$'),
ADD COLUMN theme_background_color VARCHAR(7) DEFAULT '#f5f5f5' CHECK (theme_background_color ~ '^#[0-9A-Fa-f]{6}$');

-- Add comments for documentation
COMMENT ON COLUMN user_profiles.theme_mode IS 'User preferred theme mode: light or dark';
COMMENT ON COLUMN user_profiles.theme_primary_color IS 'User preferred primary color in hex format';
COMMENT ON COLUMN user_profiles.theme_background_color IS 'User preferred background color in hex format';

-- Update existing records with default values
UPDATE user_profiles 
SET 
  theme_mode = 'light',
  theme_primary_color = '#1976d2',
  theme_background_color = '#f5f5f5'
WHERE 
  theme_mode IS NULL 
  OR theme_primary_color IS NULL 
  OR theme_background_color IS NULL;