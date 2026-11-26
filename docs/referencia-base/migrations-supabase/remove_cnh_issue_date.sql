-- Remove the cnh_issue_date column from drivers table
-- This field should not be required as only the expiry date is needed

ALTER TABLE drivers DROP COLUMN IF EXISTS cnh_issue_date;