import * as fs from 'fs';
import * as path from 'path';
import { OUTLOOK_DOMAINS, isAllowedEmail } from '@/lib/emailPolicy';

describe('who may register', () => {
  it('accepts Outlook-family personal mail', () => {
    for (const d of OUTLOOK_DOMAINS) expect(isAllowedEmail(`asha@${d}`)).toBe(true);
    expect(isAllowedEmail('  Asha@Outlook.COM ')).toBe(true);
  });

  it('accepts ABB mail and its subdomains', () => {
    expect(isAllowedEmail('asha@abb.com')).toBe(true);
    expect(isAllowedEmail('asha@in.abb.com')).toBe(true);
  });

  it('rejects everything else, including look-alikes', () => {
    expect(isAllowedEmail('asha@gmail.com')).toBe(false);
    expect(isAllowedEmail('asha@notabb.com')).toBe(false);
    expect(isAllowedEmail('asha@abb.com.evil.io')).toBe(false);
    expect(isAllowedEmail('asha@outlook.co')).toBe(false);
    expect(isAllowedEmail('asha@outlook')).toBe(false);
    expect(isAllowedEmail('not an email')).toBe(false);
  });

  it('matches the server rule in supabase/setup.sql', () => {
    const sql = fs.readFileSync(path.resolve(__dirname, '..', '..', 'supabase', 'setup.sql'), 'utf8');
    for (const d of OUTLOOK_DOMAINS) expect(sql).toContain(d.replace(/\./g, '\\.'));
    expect(sql).toContain('abb\\.com');
  });
});
