import type { Accent } from '@/constants/brand';
import type { IconName } from '@/components/ui';
import type { ResourceGroup } from '@/data/types';

export const GROUP_META: Record<ResourceGroup, { icon: IconName; accent: Accent }> = {
  wellbeing: { icon: 'leaf-outline', accent: 'green' },
  support: { icon: 'call-outline', accent: 'rose' },
  hr: { icon: 'clipboard-outline', accent: 'blue' },
  it: { icon: 'laptop-outline', accent: 'teal' },
  workplace: { icon: 'business-outline', accent: 'violet' },
  policy: { icon: 'document-text-outline', accent: 'slate' },
  faq: { icon: 'help-circle-outline', accent: 'amber' },
};

export type ResourceFilter = 'all' | 'policies' | 'support' | 'faqs';
export const RESOURCE_FILTERS: { id: ResourceFilter; label: string }[] = [
  { id: 'all', label: 'All' }, { id: 'policies', label: 'Policies' }, { id: 'support', label: 'Support' }, { id: 'faqs', label: 'FAQs' },
];
export function resourceMatches(group: ResourceGroup, f: ResourceFilter): boolean {
  if (f === 'all') return true;
  if (f === 'policies') return ['hr', 'it', 'workplace', 'policy'].includes(group);
  if (f === 'support') return ['support', 'wellbeing'].includes(group);
  return group === 'faq';
}
