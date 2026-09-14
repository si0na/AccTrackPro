export const REWARDS_RECOGNITION_TYPES = ['Continous', 'Quarterly', 'Annual'] as const;

export const REWARDS_RECOGNITION_TEAM_OR_INDIVIDUAL_OPTIONS = ['Individual', 'Team'] as const;

export const REWARDS_RECOGNITION_STATUSES = [
  'Nominated - Not Won',
  'Won',
  'Nomination Rejected',
] as const;

export const REWARDS_RECOGNITION_CATEGORIES_BY_TYPE: Record<string, string[]> = {
  Continous: [
    'Spot Award',
    'Shout-Outs',
    'Project Specific',
    'Kudos Card',
    'Rewards Point',
  ],
  Quarterly: [
    'Budding Star',
    'Reflector of the Quarter',
    'Technical Champion',
    'Emerging Leader',
    'Leadership Excellence',
    'Customer Success Champion',
    'Best Team-1',
    'Best Team-2',
    'Influencer of the Quarter',
    'Community Champion of the Quarter',
  ],
  Annual: [
    'Rookie of the Year',
    'Midfield Maestro',
    'Radiance Award',
    'Signature Award',
    'Super Squad-1',
    'Super Squad-2',
    'Influencer of the Year',
    'Community Champion of the Year',
  ],
};

export function isValidTypeCategoryPair(type: string, category: string): boolean {
  const categories = REWARDS_RECOGNITION_CATEGORIES_BY_TYPE[type];
  if (!categories) return false;
  return categories.includes(category);
}
