import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { NotificationPrefs } from '@/data/types';

/**
 * Reminders are scheduled on the phone itself (local notifications): nothing is sent from a server,
 * nothing about you leaves the device, and switching a reminder off cancels it. The wording is gentle
 * and never counts or scolds.
 */
export interface PlannedReminder {
  key: string;
  title: string;
  body: string;
  /** Local time of day, and for weekly reminders the weekday (1 = Sunday … 7 = Saturday). */
  hour: number;
  minute: number;
  weekday?: number;
}

export function planReminders(prefs: NotificationPrefs): PlannedReminder[] {
  const out: PlannedReminder[] = [];
  if (prefs.dailyReminder) {
    out.push({ key: 'checkin', title: 'A moment for you', body: 'Whenever you are ready, a one-tap check-in is waiting.', hour: 16, minute: 0 });
  }
  if (prefs.microBreak) {
    out.push({ key: 'break-am', title: 'Time for a micro-break?', body: 'A minute to stretch or rest your eyes.', hour: 11, minute: 0 });
    out.push({ key: 'break-pm', title: 'Time for a micro-break?', body: 'A short reset can make the afternoon easier.', hour: 15, minute: 0 });
  }
  if (prefs.hydration) {
    for (const hour of [10, 12, 14, 16]) {
      out.push({ key: `water-${hour}`, title: 'Water break', body: 'A glass of water is a good idea.', hour, minute: 0 });
    }
  }
  if (prefs.resourceTips) {
    out.push({ key: 'tip', title: 'A resource for you', body: 'Take a look at the resources you saved.', hour: 12, minute: 30, weekday: 4 });
  }
  return out;
}

export type ReminderResult = 'scheduled' | 'none' | 'denied' | 'unsupported';

const supported = Platform.OS === 'ios' || Platform.OS === 'android';

if (supported) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
  });
}

/** Replaces everything scheduled with what the preferences ask for. Asks for permission only when something is on. */
export async function syncReminders(prefs: NotificationPrefs): Promise<ReminderResult> {
  if (!supported) return 'unsupported';
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    const plan = planReminders(prefs);
    if (!plan.length) return 'none';
    let perm = await Notifications.getPermissionsAsync();
    if (!perm.granted && perm.canAskAgain) perm = await Notifications.requestPermissionsAsync();
    if (!perm.granted) return 'denied';
    if (Platform.OS === 'android') {
      // eslint-disable-next-line import/namespace -- AndroidImportance is re-exported with `export *`, which the linter cannot follow
      await Notifications.setNotificationChannelAsync('reminders', { name: 'Gentle reminders', importance: Notifications.AndroidImportance.DEFAULT });
    }
    for (const r of plan) {
      await Notifications.scheduleNotificationAsync({
        content: { title: r.title, body: r.body },
        trigger: r.weekday
          ? { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: r.weekday, hour: r.hour, minute: r.minute, channelId: 'reminders' }
          : { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: r.hour, minute: r.minute, channelId: 'reminders' },
      });
    }
    return 'scheduled';
  } catch {
    return 'unsupported';
  }
}
