-- Replace single sqft with sqft_min / sqft_max range
ALTER TABLE floor_plans ADD COLUMN IF NOT EXISTS sqft_min INT;
ALTER TABLE floor_plans ADD COLUMN IF NOT EXISTS sqft_max INT;

-- Migrate existing sqft values to both min and max
UPDATE floor_plans SET sqft_min = sqft, sqft_max = sqft WHERE sqft IS NOT NULL AND sqft_min IS NULL;
