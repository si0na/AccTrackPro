-- Migration 102: Allow 'risk' and 'issue' in comments target_type check constraint

ALTER TABLE comments DROP CONSTRAINT IF EXISTS comments_target_type_check;
ALTER TABLE comments ADD CONSTRAINT comments_target_type_check
  CHECK (target_type IN ('account', 'opportunity', 'actionItem', 'risk', 'issue'));
