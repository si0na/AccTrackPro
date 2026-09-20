-- Migration 093: Add team_members and team_member_ids to employee_rewards_recognition
ALTER TABLE employee_rewards_recognition
  ADD COLUMN IF NOT EXISTS team_members TEXT,
  ADD COLUMN IF NOT EXISTS team_member_ids TEXT[];
