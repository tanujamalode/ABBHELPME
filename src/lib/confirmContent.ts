import { Alert, type AlertButton } from 'react-native';
import { checkContent } from './moderation';

/**
 * Runs the on-device content check before something is sent. Clean text goes straight to `proceed`.
 * A "warn" finding asks first and lets the writer send anyway; a "block" finding (an email, phone number or
 * employee number) must be edited out. Nothing is sent anywhere for the check.
 */
export function confirmContent(text: string, proceed: () => void, actionLabel = 'Send anyway') {
  const issue = checkContent(text).issues.find((i) => i.severity !== 'support');
  if (!issue) { proceed(); return; }
  const buttons: AlertButton[] = [{ text: 'Edit', style: 'cancel' }];
  if (issue.severity === 'warn') buttons.push({ text: actionLabel, onPress: proceed });
  Alert.alert(issue.title, issue.detail, buttons);
}
