export const SESSION_TYPES = ["Portrait", "Family", "Engagement", "Other"] as const;

export const CONTACT_FIELD_LIMITS = {
  name: 200,
  email: 254,
  phone: 50,
  message: 5000,
} as const;
