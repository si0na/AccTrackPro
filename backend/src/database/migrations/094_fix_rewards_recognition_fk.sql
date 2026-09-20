-- Migration 094: Drop FK constraints on employee_rewards_recognition for nominated_by_id and employee_id
-- to support pending registration employees from employee_master and non-user stakeholder IDs

ALTER TABLE employee_rewards_recognition DROP CONSTRAINT IF EXISTS employee_rewards_recognition_nominated_by_id_fkey;
ALTER TABLE employee_rewards_recognition DROP CONSTRAINT IF EXISTS employee_rewards_recognition_employee_id_fkey;
