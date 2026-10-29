import { Alert } from 'react-native';

/**
 * Runs a write to the backend and tells the user if it failed, so nothing is silently lost.
 * Returns undefined on failure.
 */
export async function attempt<T>(run: () => Promise<T>, what = 'save that'): Promise<T | undefined> {
  try {
    return await run();
  } catch (e) {
    const limited = e instanceof Error && /rate limit/i.test(e.message);
    Alert.alert(`Could not ${what}`,
      limited ? 'You are doing that a lot. Please wait a little and try again.' : 'Check your internet connection and try again. Nothing was changed.');
    return undefined;
  }
}
