-- Delete duplicate Service Provider stakeholders, keeping the latest one
DELETE FROM stakeholders s1
USING stakeholders s2
WHERE s1.stakeholder_type = 'SERVICE_PROVIDER'
  AND s2.stakeholder_type = 'SERVICE_PROVIDER'
  AND s1.account_id = s2.account_id
  AND s1.user_id = s2.user_id
  AND s1.is_deleted = FALSE
  AND s2.is_deleted = FALSE
  AND s1.created_at < s2.created_at;

-- Create unique index to prevent future duplicates
CREATE UNIQUE INDEX IF NOT EXISTS uq_stk_account_user
  ON stakeholders(account_id, user_id)
  WHERE stakeholder_type = 'SERVICE_PROVIDER' AND is_deleted = FALSE;
