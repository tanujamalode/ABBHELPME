import type { Resource } from './types';

/**
 * Optional, project-provided overrides keyed by resource id.
 * Add REAL, approved contact data here (url / phone / email) and set
 * verified:true. Leave empty until ABB supplies approved details.
 */
export const RESOURCE_OVERRIDES: Record<string, Partial<Resource>> = {
  // 'r-eap': { phone: '...', verified: true },
};
