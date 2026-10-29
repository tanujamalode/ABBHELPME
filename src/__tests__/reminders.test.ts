import { planReminders } from '@/lib/reminders';

jest.mock('expo-notifications', () => ({ setNotificationHandler: jest.fn() }));

const off = { dailyReminder: false, resourceTips: false, hydration: false, microBreak: false };

describe('reminder plan', () => {
  it('schedules nothing when everything is off', () => {
    expect(planReminders(off)).toEqual([]);
  });

  it('plans one check-in, two break nudges, four water reminders and a weekly tip', () => {
    expect(planReminders({ ...off, dailyReminder: true }).map((r) => r.key)).toEqual(['checkin']);
    expect(planReminders({ ...off, microBreak: true })).toHaveLength(2);
    expect(planReminders({ ...off, hydration: true }).map((r) => r.hour)).toEqual([10, 12, 14, 16]);
    const tip = planReminders({ ...off, resourceTips: true })[0];
    expect(tip.weekday).toBe(4);
  });

  it('keeps every reminder inside working hours and gently worded', () => {
    const all = planReminders({ dailyReminder: true, resourceTips: true, hydration: true, microBreak: true });
    for (const r of all) {
      expect(r.hour).toBeGreaterThanOrEqual(9);
      expect(r.hour).toBeLessThanOrEqual(17);
      expect(`${r.title} ${r.body}`).not.toMatch(/missed|streak|don't forget|haven't/i);
    }
    expect(new Set(all.map((r) => r.key)).size).toBe(all.length);
  });
});
