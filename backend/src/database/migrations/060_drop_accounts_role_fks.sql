-- Drop accounts role ownership foreign key constraints referencing users(id)
-- so that unregistered employees from employee_master can also be assigned
-- directly to these role fields before registration.
--
-- Display name retrieval is updated to coalesce registered users and employee_master.
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS fk_accounts_account_manager;
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS fk_accounts_practice_lead;
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS fk_accounts_client_partner;
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS fk_accounts_vertical_head;
