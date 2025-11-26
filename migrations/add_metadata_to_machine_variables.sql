-- Migration: Add metadata columns to machine_variables table
-- This makes machine_variables the single source of truth for process type definitions
-- Date: 2025-11-25

-- Add new columns for UI metadata
ALTER TABLE machine_variables
ADD COLUMN IF NOT EXISTS label VARCHAR(255),
ADD COLUMN IF NOT EXISTS color VARCHAR(7),
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS updated_at BIGINT,
ADD COLUMN IF NOT EXISTS updated_by VARCHAR(255);

-- Migrate data from processTypeConfig.ts hardcoded values
-- Data process type
UPDATE machine_variables
SET label = 'Data', color = '#14B8A6', is_active = TRUE
WHERE type = 'data' AND label IS NULL;

-- HP process type
UPDATE machine_variables
SET label = 'HP', color = '#6366F1', is_active = TRUE
WHERE type = 'hp' AND label IS NULL;

-- Laser process type
UPDATE machine_variables
SET label = 'Laser', color = '#EF4444', is_active = TRUE
WHERE type = 'laser' AND label IS NULL;

-- Fold process type
UPDATE machine_variables
SET label = 'Fold', color = '#EC4899', is_active = TRUE
WHERE type = 'fold' AND label IS NULL;

-- Affix process type
UPDATE machine_variables
SET label = 'Affix with Glue', color = '#F59E0B', is_active = TRUE
WHERE type = 'affix' AND label IS NULL;

-- Insert process type
UPDATE machine_variables
SET label = 'Insert', color = '#3B82F6', is_active = TRUE
WHERE type = 'insert' AND label IS NULL;

-- Inkjet process type
UPDATE machine_variables
SET label = 'Ink Jet', color = '#8B5CF6', is_active = TRUE
WHERE type = 'inkjet' AND label IS NULL;

-- Labeling process type
UPDATE machine_variables
SET label = 'Labeling', color = '#10B981', is_active = TRUE
WHERE type = 'labeling' AND label IS NULL;

-- Set default gray color for any other process types that may exist
UPDATE machine_variables
SET color = '#6B7280', is_active = TRUE
WHERE color IS NULL;

-- Set label to capitalized type if not already set
UPDATE machine_variables
SET label = UPPER(SUBSTRING(type, 1, 1)) || SUBSTRING(type, 2)
WHERE label IS NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_machine_variables_type ON machine_variables(type);
CREATE INDEX IF NOT EXISTS idx_machine_variables_is_active ON machine_variables(is_active);
