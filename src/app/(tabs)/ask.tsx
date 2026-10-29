import { Redirect } from 'expo-router';

// Placeholder route that reserves the centre slot in the tab bar.
// The tab's button opens /assistant directly; this only handles a deep link to /ask.
export default function Ask() {
  return <Redirect href="/assistant" />;
}
