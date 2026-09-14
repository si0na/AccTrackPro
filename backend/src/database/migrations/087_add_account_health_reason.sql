-- Migration 087: Add health_reason column to accounts table

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS health_reason TEXT;
