/** Badge text for where a post or answer is stored and who wrote it. */
export function originBadge(x: { sample: boolean; shared?: boolean }): { label: string; tone: 'sample' | 'local' } {
  if (x.shared) return x.sample ? { label: 'Colleague', tone: 'local' } : { label: 'Shared by you', tone: 'local' };
  return x.sample ? { label: 'Sample content', tone: 'sample' } : { label: 'On this device only', tone: 'local' };
}
