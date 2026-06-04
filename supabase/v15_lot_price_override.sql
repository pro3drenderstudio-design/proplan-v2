-- Lot-level price override: when set, replaces floor_plan.base_price + price_modifier entirely
-- Stored in dollars (same unit as price_modifier), nullable = not set
ALTER TABLE lots ADD COLUMN IF NOT EXISTS lot_price INTEGER;
