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

/** "Reviewed 12 Jun 2026", or a plain note when it has never been reviewed or is more than a year old. */
export function reviewedLabel(iso: string | null, now: number = Date.now()): string {
  if (!iso) return 'Not yet reviewed';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return 'Not yet reviewed';
  const date = new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  return now - t > 365 * 86_400_000 ? `Last reviewed ${date} (over a year ago)` : `Reviewed ${date}`;
}

/** Search across the words a person might type. Every word has to appear somewhere. */
export function resourceSearch<T extends { title: string; subtitle: string; body: string }>(items: T[], query: string): T[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return items;
  return items.filter((r) => {
    const hay = `${r.title} ${r.subtitle} ${r.body}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}

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
