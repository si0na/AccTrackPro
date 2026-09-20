-- Migration 095: Drop strict FK constraints on employee_appreciation and performance_evaluations
-- to support both registered Users and pending Employee Master / Service Provider Stakeholders

ALTER TABLE employee_appreciation DROP CONSTRAINT IF EXISTS employee_appreciation_employee_id_fkey;
ALTER TABLE performance_evaluations DROP CONSTRAINT IF EXISTS performance_evaluations_employee_id_fkey;
