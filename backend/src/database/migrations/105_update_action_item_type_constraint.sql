-- Migration 105: Update action_item_type check constraint to include new action item types
ALTER TABLE action_items DROP CONSTRAINT IF EXISTS chk_action_item_type;
ALTER TABLE action_items ADD CONSTRAINT chk_action_item_type
  CHECK (action_item_type IS NULL OR action_item_type IN (
    'Account mining',
    'Approval',
    'Board Meeting',
    'Communication',
    'Customer Request',
    'Decision',
    'Dependency',
    'Documentation',
    'Escalation',
    'Follow-up',
    'Issue Resolution',
    'Meeting Action',
    'Opportunity / Growth',
    'Other',
    'Proposals',
    'Review',
    'Risk Mitigation',
    'Stakeholder connect',
    'Task'
  ));
