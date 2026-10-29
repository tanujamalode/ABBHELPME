import * as fs from 'fs';
import * as path from 'path';

const root = path.resolve(__dirname, '..');
const walk = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? (e.name === '__tests__' ? [] : walk(path.join(dir, e.name))) : [path.join(dir, e.name)]);
const sources = walk(root).filter((f) => /\.(ts|tsx)$/.test(f));

// The only code allowed to reach the network: the Supabase client and the code that wraps it.
const BACKEND_FILES = ['data/supabaseRepository.ts', 'data/supabaseClient.ts', 'data/auth.ts', 'state/AppProvider.tsx']
  .map((f) => path.join(root, ...f.split('/')));

describe('architecture', () => {
  it('app source reaches the network only through the backend files', () => {
    const banned = /\bfetch\s*\(|XMLHttpRequest|axios|WebSocket|firebase|supabase|sendBeacon/;
    const offenders = sources.filter((f) => !BACKEND_FILES.includes(f) && banned.test(fs.readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('declares no analytics or AI dependencies (only Supabase is allowed as cloud)', () => {
    const pkg = JSON.parse(fs.readFileSync(path.resolve(root, '..', 'package.json'), 'utf8'));
    const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).join(' ');
    expect(deps).not.toMatch(/firebase|amplitude|mixpanel|segment|sentry|@anthropic|openai|google-generative|axios/);
  });

  it('never ships a service-role key', () => {
    const offenders = sources.filter((f) => /service[_-]?role/i.test(fs.readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('no mock or demo content is left in the app', () => {
    const banned = /DEMO_MODE|seedDemoData|SAMPLE_|getSamplePosts|createDemoVerifier/;
    const offenders = sources.filter((f) => banned.test(fs.readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
