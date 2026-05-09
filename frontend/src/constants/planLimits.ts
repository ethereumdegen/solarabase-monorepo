export const PLAN_QUERY_LIMITS: Record<string, number | null> = {
  free: 1000,
  pro: 5000,
  team: null,
};

export const PLAN_DOC_LIMITS: Record<string, number | null> = {
  free: 50,
  pro: null,
  team: null,
};

export const PLAN_MEMBER_LIMITS: Record<string, number | null> = {
  free: 2,
  pro: 5,
  team: null,
};

export const PLAN_API_KEY_LIMITS: Record<string, number | null> = {
  free: 3,
  pro: 10,
  team: null,
};

export const PLAN_FILE_SIZE: Record<string, string> = {
  free: '100 MB',
  pro: '500 MB',
  team: '1 GB',
};

export const PLAN_KB_LIMITS: Record<string, string> = {
  free: '1',
  pro: 'Unlimited',
  team: 'Unlimited',
};
