-- =============================================================================
-- ProPlan Studio — v7 Migration
-- Run in Supabase SQL Editor.
-- Adds: show_when (geometry visibility rules) on categories
--       is_default flag on options
-- =============================================================================

-- Conditional category visibility.
-- Array of option UUIDs — this category is only shown in the buyer configurator
-- when at least one of the listed option IDs is currently selected.
-- NULL / empty array means "always visible for this phase."
ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS show_when text[] DEFAULT NULL;

-- Per-option default flag.
-- True = this option is pre-selected for buyers when the configurator loads.
-- Only one option per category should have is_default = true.
ALTER TABLE options
  ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;

-- Index for faster look-ups when resolving defaults on page load.
CREATE INDEX IF NOT EXISTS idx_options_is_default
  ON options (category_id, is_default)
  WHERE is_default = true;
