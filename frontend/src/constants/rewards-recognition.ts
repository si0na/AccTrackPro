/**
 * Controlled options for Employee Rewards and Recognition
 */

export const REWARDS_RECOGNITION_TYPE_OPTIONS = [
  'Annual',
  'Continous',
  'Quarterly',
] as const;

export const REWARDS_RECOGNITION_TEAM_OR_INDIVIDUAL_OPTIONS = [
  'Individual',
  'Team',
] as const;

export const REWARDS_RECOGNITION_STATUS_OPTIONS = [
  'Nominated - Not Won',
  'Nomination Rejected',
  'Won',
] as const;

export const REWARDS_RECOGNITION_CATEGORIES_BY_TYPE: Record<string, string[]> = {
  Annual: [
    'Community Champion of the Year',
    'Influencer of the Year',
    'Midfield Maestro',
    'Radiance Award',
    'Rookie of the Year',
    'Signature Award',
    'Super Squad-1',
    'Super Squad-2',
  ],
  Continous: [
    'Kudos Card',
    'Project Specific',
    'Rewards Point',
    'Shout-Outs',
    'Spot Award',
  ],
  Quarterly: [
    'Best Team-1',
    'Best Team-2',
    'Budding Star',
    'Community Champion of the Quarter',
    'Customer Success Champion',
    'Emerging Leader',
    'Influencer of the Quarter',
    'Leadership Excellence',
    'Reflector of the Quarter',
    'Technical Champion',
  ],
};

export const isValidTypeCategoryPair = (type: string, category: string): boolean => {
  const allowedCategories = REWARDS_RECOGNITION_CATEGORIES_BY_TYPE[type];
  if (!allowedCategories) return false;
  return allowedCategories.includes(category);
};
