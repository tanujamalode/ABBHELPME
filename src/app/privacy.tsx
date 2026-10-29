import { View } from 'react-native';
import { confirmDeleteData } from '@/components/accountActions';
import { Button, Card, Header, Notice, Screen, Text } from '@/components/ui';
import { space } from '@/constants/brand';
import { useApp } from '@/state/AppProvider';

const LOCAL_ONLY = { t: 'Where your data lives', b: 'Only on this device. There is no ABB server, cloud database, account sync or analytics in this version.' };
const WITH_CLOUD = [
  { t: 'Where your data lives', b: 'Private data (profile, mood check-ins, personal notes, saved items) stays on this device. Work questions, achievements, answers, votes and reports you share go to the community database so colleagues can see them.' },
  { t: 'Your account', b: 'You sign in with an emailed code. Your email, and the role, experience and name you set, are kept with your account so you can sign in on another device. They are never shown on posts.' },
];

const POINTS: { t: string; b: string }[] = [
  { t: 'What is stored', b: 'Your local profile name, role and experience band, the topics you chose, entries and answers you write, your votes, accepted answers, bookmarks, mood check-ins and their tags, and notification preferences.' },
  { t: 'What a post shows', b: 'Never your name or email. If you switch it on for a post, only your role and experience band (for example "Engineer · 3–5 yrs at ABB") and a verified mark.' },
  { t: 'Contribution score', b: 'Calculated on this device from your activity. It is never used in performance reviews and is not linked to your identity.' },
  { t: 'Content checks', b: 'Before you post, a check on this device looks for personal details, named colleagues, confidential information and personal attacks. Your text is not sent anywhere for this.' },
  { t: 'How it is protected', b: 'Private data is kept in an encrypted database (SQLCipher). The key is generated on this device and kept in the device keystore, as is your sign-in session. Neither is in the app code or the database.' },
  { t: 'Backups', b: 'The key is set to stay on this device only, so cloud or device backups can\'t be unlocked elsewhere. Your device\'s own backup behaviour can vary.' },
  { t: 'Who can see it', b: 'Nobody at ABB, HR, IT or any counselor receives your mood check-ins or personal notes. Nothing is sent to any AI service.' },
  { t: 'Losing it', b: 'Uninstalling the app, losing the device, or clearing its data permanently removes the private data on it. There is no recovery.' },
];

export default function Privacy() {
  const { deleteAllLocalData, persistent, cloud } = useApp();
  const points = [...(cloud ? WITH_CLOUD : [LOCAL_ONLY]), ...POINTS];
  return (
    <Screen>
      <Header title="Privacy & Storage" back />
      {!persistent ? <Notice tone="warn" text="You're in the web preview. Private data is held in memory only and isn't encrypted or saved. Use a phone build for real storage." /> : null}
      <View style={{ gap: space.md }}>
        {points.map((p) => (
          <Card key={p.t}>
            <Text variant="h3">{p.t}</Text>
            <Text variant="body" style={{ marginTop: 4 }}>{p.b}</Text>
          </Card>
        ))}
      </View>
      <Notice text="This is a prototype. It needs ABB privacy, security, legal and support-process review before any real employee use." tone="warn" icon="alert-circle-outline" />
      <Button label={cloud ? 'Delete account and data' : 'Delete local data'} variant="danger" icon="trash-outline"
        onPress={() => confirmDeleteData(cloud, deleteAllLocalData)} style={{ marginTop: space.lg }} />
    </Screen>
  );
}
