import * as fs from 'fs';
import * as path from 'path';

const root = path.resolve(__dirname, '..');
const walk = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? (e.name === '__tests__' ? [] : walk(path.join(dir, e.name))) : [path.join(dir, e.name)]);
const sources = walk(root).filter((f) => /\.(ts|tsx)$/.test(f));

// The only code allowed to reach the network: shared community content via Supabase.
// Private data (profile, mood, notes, bookmarks) never goes through these files.
const CLOUD_FILES = ['data/cloudRepository.ts', 'data/supabaseClient.ts', 'data/auth.ts', 'state/AppProvider.tsx']
  .map((f) => path.join(root, ...f.split('/')));

describe('local-only architecture', () => {
  it('app source makes no network calls outside the cloud repository', () => {
    const banned = /\bfetch\s*\(|XMLHttpRequest|axios|WebSocket|firebase|supabase|sendBeacon/;
    const offenders = sources.filter((f) => !CLOUD_FILES.includes(f) && banned.test(fs.readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('cloud repository never touches private data tables', () => {
    const src = fs.readFileSync(path.join(root, 'data', 'cloudRepository.ts'), 'utf8');
    expect(src).not.toMatch(/from\('(mood|profile|bookmarks|settings|topic)/);
  });

  it('declares no analytics or AI dependencies (only Supabase is allowed as cloud)', () => {
    const pkg = JSON.parse(fs.readFileSync(path.resolve(root, '..', 'package.json'), 'utf8'));
    const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).join(' ');
    expect(deps).not.toMatch(/firebase|amplitude|mixpanel|segment|sentry|@anthropic|openai|google-generative|axios/);
  });

  it('parameterises SQL: no template-interpolated user values in the repository', () => {
    const src = fs.readFileSync(path.join(root, 'data', 'sqliteRepository.ts'), 'utf8');
    expect(src).not.toMatch(/(runAsync|getAllAsync|getFirstAsync)\(\s*`/);
  });
});
