import { Alert } from 'react-native';

/** Sign-out confirmation. The next sign-in needs a new email code; nothing is deleted. */
export function confirmSignOut(signOut: () => Promise<void>) {
  Alert.alert('Sign out?', 'You will need a new email code to sign in again. Your posts, check-ins and saved items stay in your account.',
    [{ text: 'Cancel', style: 'cancel' }, { text: 'Sign out', onPress: () => { void signOut(); } }]);
}

/** Delete confirmation: removes the account and everything stored for it. */
export function confirmDeleteAccount(deleteAccount: () => Promise<void>) {
  Alert.alert(
    'Delete your account?',
    'This permanently deletes your account and everything stored for it: your posts, answers, votes, mood check-ins, saved items and profile. It cannot be undone.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete everything', style: 'destructive', onPress: async () => {
          try { await deleteAccount(); } catch {
            Alert.alert('Not deleted', 'Your account could not be deleted. Check your connection and try again. Nothing was removed.');
          }
        },
      },
    ]);
}
