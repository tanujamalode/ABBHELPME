import * as fs from 'fs';
import * as path from 'path';
import { MOOD_REACTION, greeting, homeLine, outfitForRole, tierLine, topicsLine } from '@/lib/capy';
import { ROLE_OPTIONS } from '@/lib/profileOptions';
import { TIERS } from '@/lib/karma';

describe('Capy', () => {
  it('has an image file for every pose the app can ask for', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '..', 'components', 'Capy.tsx'), 'utf8');
    const entries = [...src.matchAll(/^ {2}(\w+): \{ src: require\('\.\.\/\.\.\/assets\/capy\/(\w+)\.webp'\)/gm)];
    const files = entries.map((m) => m[1]);
    expect(files.length).toBeGreaterThanOrEqual(23);
    for (const m of entries) expect(fs.existsSync(path.resolve(__dirname, '..', '..', 'assets', 'capy', `${m[2]}.webp`))).toBe(true);
    const used = [
      ...ROLE_OPTIONS.map((r) => outfitForRole(r.id)),
      ...Object.values(MOOD_REACTION).flatMap((m) => [m.pick.pose, m.saved.pose]),
      ...TIERS.map((t) => tierLine(t.id).pose),
      homeLine('', 9, null).pose, homeLine('', 15, null).pose, homeLine('', 15, 'struggling').pose,
      topicsLine(0, 3).pose, topicsLine(1, 3).pose, topicsLine(3, 3).pose,
    ];
    for (const pose of used) expect(files).toContain(pose);
  });

  it('dresses for the role', () => {
    expect(outfitForRole('hr')).toBe('outfit_hr');
    expect(outfitForRole('engineer')).toBe('outfit_tech');
    expect(outfitForRole('manager')).toBe('outfit_teamlead');
    expect(outfitForRole(null)).toBe('outfit_casual');
  });

  it('greets by time of day', () => {
    expect(greeting(8)).toBe('Good morning');
    expect(greeting(14)).toBe('Good afternoon');
    expect(greeting(20)).toBe('Good evening');
  });

  it('offers support, never guilt, on a low day', () => {
    const line = homeLine('Asha', 15, 'struggling');
    expect(line.pose).toBe('support');
    expect(line.text).toContain('Asha');
    expect(line.text.toLowerCase()).not.toMatch(/streak|missed|again\?/);
  });

  it('counts down topics, then celebrates', () => {
    expect(topicsLine(1, 3).text).toContain('2 more');
    expect(topicsLine(3, 3).pose).toBe('cheerful');
  });
});
