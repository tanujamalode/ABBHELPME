import { Alert, Linking } from 'react-native';

/** Every link, call or email leaves the app only after explicit confirmation. */
export function confirmLeaveApp(kind: 'link' | 'phone' | 'email', target: string, label: string) {
  const url = kind === 'phone' ? `tel:${target}` : kind === 'email' ? `mailto:${target}` : target;
  const what = kind === 'phone' ? 'open your phone app' : kind === 'email' ? 'open your email app' : 'open a link in your browser';
  Alert.alert(
    'Leave ABB HELP ME?',
    `This will ${what} for “${label}”. It is outside this app, and ABB HELP ME can't see or control what happens there.`,
    [
      { text: 'Stay here', style: 'cancel' },
      { text: 'Continue', onPress: () => { Linking.openURL(url).catch(() => Alert.alert('Could not open', 'Your device could not open this.')); } },
    ],
  );
}
