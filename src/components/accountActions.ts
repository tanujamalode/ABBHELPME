import { Alert } from 'react-native';

/** Sign-out confirmation. Cloud sign-out ends the session; the next sign-in needs a new email code. */
export function confirmSignOut(cloud: boolean, signOut: () => Promise<void>) {
  Alert.alert('Sign out?',
    cloud
      ? 'You will need a new email code to sign in again. Your private data stays on this device, tied to your account.'
      : 'Your data stays on this device. You can unlock it again later.',
    [{ text: 'Cancel', style: 'cancel' }, { text: 'Sign out', onPress: () => { void signOut(); } }]);
}

/** Delete confirmation. Signed in to the cloud, this also deletes the account and its shared posts. */
export function confirmDeleteData(deletesAccount: boolean, deleteAll: () => Promise<void>) {
  Alert.alert(
    deletesAccount ? 'Delete your account?' : 'Delete local data?',
    deletesAccount
      ? 'This permanently deletes your account, your shared posts, answers and votes, and everything saved on this device (profile, mood check-ins, notes, saved items). It cannot be undone.'
      : 'This permanently removes your profile and everything saved by this app on this device. It cannot be undone.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete everything', style: 'destructive', onPress: async () => {
          try { await deleteAll(); } catch {
            Alert.alert('Not deleted', 'Your account could not be deleted. Check your connection and try again. Nothing was removed.');
          }
        },
      },
    ]);
}
