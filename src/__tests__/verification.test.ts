import { isValidEmail } from '@/lib/verification';

describe('email shape', () => {
  it('validates before a code is requested', () => {
    expect(isValidEmail('asha@abb.com')).toBe(true);
    expect(isValidEmail(' asha@abb.com ')).toBe(true);
    expect(isValidEmail('asha@abb')).toBe(false);
    expect(isValidEmail('not an email')).toBe(false);
  });
});
