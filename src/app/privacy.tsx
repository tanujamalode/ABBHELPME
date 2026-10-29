import { View } from 'react-native';
import { confirmDeleteAccount } from '@/components/accountActions';
import { Button, Card, Header, Notice, Screen, Text } from '@/components/ui';
import { space } from '@/constants/brand';
import { useApp } from '@/state/AppProvider';

const POINTS: { t: string; b: string }[] = [
  { t: 'Where your data lives', b: 'In your account on the ABB HELP ME database (Supabase). Your device keeps only your sign-in session, in the phone\'s secure keystore.' },
  { t: 'Your account', b: 'You sign in with an emailed code, no password. Only Outlook, Hotmail, Live, MSN and abb.com addresses are accepted. Your email is never shown to other people.' },
  { t: 'What is stored', b: 'Your name, role and experience band, the topics you chose, your posts, answers, votes, saved items, mood check-ins and their tags, and notification preferences.' },
  { t: 'What a post shows', b: 'Never your name or email. Personal posts are anonymous by default. If you switch it on for a post, only your role and experience band (for example "Engineer · 3–5 yrs at ABB") and a verified mark are shown. Colleagues cannot tell which account wrote a post.' },
  { t: 'Private to you', b: 'Mood check-ins, saved items, votes and notifications can be read only by your own account. Nobody at ABB, HR, IT or any counselor sees your mood check-ins, and they never trigger an alert.' },
  { t: 'Contribution score', b: 'Built from your activity and the votes colleagues gave your posts. It is never used in performance reviews and is not linked to your identity.' },
  { t: 'Content checks and reports', b: 'Before you post, a check on your phone looks for personal details, named colleagues, confidential information and personal attacks. Anyone can report a post; content reported by three different people is hidden from the community.' },
  { t: 'Moderation', b: 'A small team of ABB moderators can remove posts that break the rules and suspend accounts. They can find out who wrote a post only to act on abuse or a safety concern, and every time they do it is recorded. They never see your private messages.' },
  { t: 'Wellbeing insights for ABB', b: 'ABB sees only anonymous totals from mood check-ins, such as the share of low days in a role. Groups smaller than 5 people are never shown, and nobody at ABB can open your individual check-ins.' },
  { t: 'Who administers it', b: 'People who manage the database project can technically see stored data. Access should be limited to a small, named group and covered by ABB privacy and security review.' },
  { t: 'Deleting your data', b: 'Delete account and data removes your account and everything stored for it, including your posts, answers and votes. It cannot be undone.' },
];

export default function Privacy() {
  const { deleteAccount } = useApp();
  return (
    <Screen>
      <Header title="Privacy & Data" back />
      <View style={{ gap: space.md }}>
        {POINTS.map((p) => (
          <Card key={p.t}>
            <Text variant="h3">{p.t}</Text>
            <Text variant="body" style={{ marginTop: 4 }}>{p.b}</Text>
          </Card>
        ))}
      </View>
      <Notice text="This app is not monitored in real time and is not a counselling or emergency service." tone="warn" icon="alert-circle-outline" />
      <Button label="Delete account and data" variant="danger" icon="trash-outline"
        onPress={() => confirmDeleteAccount(deleteAccount)} style={{ marginTop: space.lg }} />
    </Screen>
  );
}
