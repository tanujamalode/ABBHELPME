import { resourceSearch, reviewedLabel } from '@/lib/resourceMeta';

describe('resource review dates', () => {
  const now = Date.parse('2026-06-15T12:00:00Z');

  it('shows when a resource was reviewed, and flags old or missing reviews', () => {
    expect(reviewedLabel('2026-05-12', now)).toBe('Reviewed 12 May 2026');
    expect(reviewedLabel('2024-01-03', now)).toBe('Last reviewed 3 Jan 2024 (over a year ago)');
    expect(reviewedLabel(null, now)).toBe('Not yet reviewed');
    expect(reviewedLabel('not a date', now)).toBe('Not yet reviewed');
  });
});

describe('resource search', () => {
  const items = [
    { title: 'IT Support', subtitle: 'Tech help, system access, VPN', body: 'Raise a ticket through your service portal.' },
    { title: 'HR Policies', subtitle: 'Leave, benefits', body: 'Ask your HR contact.' },
  ];

  it('matches any field and needs every word', () => {
    expect(resourceSearch(items, 'vpn')).toEqual([items[0]]);
    expect(resourceSearch(items, 'ticket portal')).toEqual([items[0]]);
    expect(resourceSearch(items, 'leave vpn')).toEqual([]);
    expect(resourceSearch(items, '  ')).toEqual(items);
  });
});
