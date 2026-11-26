-- Add action_item_type column to action_items table
ALTER TABLE action_items ADD COLUMN IF NOT EXISTS action_item_type TEXT;

-- Add check constraint for action_item_type
ALTER TABLE action_items DROP CONSTRAINT IF EXISTS chk_action_item_type;
ALTER TABLE action_items ADD CONSTRAINT chk_action_item_type
  CHECK (action_item_type IS NULL OR action_item_type IN (
    'Account mining',
    'Approval',
    'Board Meeting',
    'CEO Connect',
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
