import { useEffect, useState } from 'react';
import { Switch, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Badge, Button, Card, Chip, Field, Header, Loading, Notice, Screen, Text } from '@/components/ui';
import { Capy } from '@/components/Capy';
import { AuthorTag } from '@/components/community';
import { ModerationReview } from '@/components/ModerationReview';
import { confirmDeletePost } from '@/components/postActions';
import { colors, space } from '@/constants/brand';
import { validatePostInput } from '@/data/shared';
import type { Post, PostKind } from '@/data/types';
import { CATEGORIES, KIND_LABEL, MAX_BODY } from '@/lib/categories';
import { checkContent, type ModerationResult } from '@/lib/moderation';
import { useApp } from '@/state/AppProvider';

export default function Compose() {
  const params = useLocalSearchParams<{ type?: string; category?: string; id?: string }>();
  const { repo, bump, profile } = useApp();
  const editingId = typeof params.id === 'string' ? params.id : undefined;

  const [kind, setKind] = useState<PostKind>((params.type as PostKind) || 'personal');
  const [category, setCategory] = useState<string>(
    typeof params.category === 'string' ? params.category : CATEGORIES[(params.type as PostKind) || 'personal']?.[0] ?? '',
  );
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [existing, setExisting] = useState<Post | null>(null);
  const [loading, setLoading] = useState(!!editingId);
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<Post | null>(null);
  const [showRole, setShowRole] = useState<boolean | null>(null);
  const [review, setReview] = useState<ModerationResult | null>(null);
  // Role/experience shown by default on questions and achievements, hidden on personal posts.
  const roleOn = showRole ?? kind !== 'personal';

  useEffect(() => {
    if (!editingId) return;
    (async () => {
      const p = await repo.getPost(editingId);
      if (p && !p.sample) { setExisting(p); setKind(p.kind); setCategory(p.category); setTitle(p.title); setBody(p.body); }
      setLoading(false);
    })();
  }, [editingId, repo]);

  const switchKind = (k: PostKind) => { setKind(k); setCategory(CATEGORIES[k][0]); setError(null); };

  const save = async (force = false) => {
    const problem = validatePostInput(title, body, kind);
    if (problem) { setError(problem); return; }
    if (kind === 'personal' && !body.trim() && !title.trim()) { setError('Write a few words, or go back if you would rather not save anything.'); return; }
    if (!force) {
      const res = checkContent(`${title}
${body}`);
      if (res.issues.length) { setReview(res); return; }
    }
    setBusy(true); setError(null); setReview(null);
    try {
      const post = existing
        ? await repo.updatePost(existing.id, { category, title, body })
        : await repo.createPost({ kind, category, title, body, showAuthor: roleOn });
      bump();
      setSaved(post);
    } catch { setError('Could not save on this device. Please try again.'); }
    setBusy(false);
  };

  if (loading) return <Screen><Loading /></Screen>;

  if (saved) {
    return (
      <Screen>
        <View style={{ alignItems: 'center', marginTop: space.xl }}>
          <Capy pose={saved.kind === 'personal' ? 'takecare' : 'celebrate'} size={170} motion="pop"
            label={saved.kind === 'personal' ? 'Capy sending care' : 'Capy celebrating'} />
          <Text variant="title" accessibilityRole="header" style={{ marginTop: space.lg, textAlign: 'center' }}>
            {saved.kind === 'personal' ? 'Thanks for sharing' : 'You did it!'}
          </Text>
          <Text variant="body" style={{ textAlign: 'center', marginTop: space.xs }}>
            {saved.kind === 'personal' ? 'Writing it down is a good step.' : 'Small steps make a big difference.'}
          </Text>
        </View>
        <Card tint={colors.green} style={{ marginTop: space.xl }}>
          <Text variant="h3">Your {KIND_LABEL[saved.kind].toLowerCase()} was saved.</Text>
          <Text variant="body" style={{ marginTop: space.xs }}>
            Saved on this device. This entry is not shared with other employees or support teams.
          </Text>
        </Card>
        <View style={{ gap: space.md, marginTop: space.xl }}>
          <Button label="View my posts" onPress={() => router.replace('/my-posts')} />
          <Button label="Browse resources" variant="secondary" onPress={() => router.replace('/resources')} />
          <Button label="Done" variant="ghost" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  const heading = existing ? `Edit ${KIND_LABEL[kind]}` : KIND_LABEL[kind];
  return (
    <Screen>
      <Header title={heading} back />
      {kind === 'personal' ? (
        <View style={{ marginBottom: space.lg }}>
          <Text variant="h2">Write it down, privately</Text>
          <Text variant="body">There&apos;s no right way to put it. Anything you write is saved only on this device.</Text>
        </View>
      ) : null}

      {!existing && !params.type ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.lg }}>
          {(Object.keys(KIND_LABEL) as PostKind[]).map((k) => <Chip key={k} label={KIND_LABEL[k]} selected={kind === k} onPress={() => switchKind(k)} />)}
        </View>
      ) : null}

      <Text variant="h3" style={{ marginBottom: space.sm }}>Category</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.lg }}>
        {CATEGORIES[kind].map((c) => <Chip key={c} label={c} selected={category === c} onPress={() => setCategory(c)} />)}
      </View>

      {kind !== 'personal' ? (
        <Field label={kind === 'achievement' ? 'Achievement title' : 'Question title'} value={title} onChangeText={(t) => { setTitle(t); setReview(null); }} maxLength={120}
          placeholder={kind === 'achievement' ? 'What are you proud of?' : 'e.g. How do I apply for an internal transfer?'} />
      ) : null}

      <Field
        label={kind === 'personal' ? "What's on your mind? (optional)" : 'Details'}
        value={body} onChangeText={(t) => { setBody(t); setReview(null); }} multiline maxLength={MAX_BODY}
        placeholder={kind === 'personal' ? 'Take your time…' : 'Add a little context'}
        error={error} hint={`${body.length}/${MAX_BODY}`} />

      {preview ? (
        <Card style={{ marginBottom: space.lg }}>
          <Text variant="label">PREVIEW</Text>
          <Text variant="h3" style={{ marginTop: 4 }}>{title || (kind === 'personal' ? 'Personal note' : '(no title)')}</Text>
          <View style={{ marginVertical: 6, flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            {roleOn && profile ? <AuthorTag author={{ role: profile.role, experience: profile.experience, verified: profile.verified }} /> : null}
            <Badge label="On this device only" tone="local" />
          </View>
          <Text variant="body">{body || '(nothing written)'}</Text>
        </Card>
      ) : null}

      <Notice text="Saved on this device. This entry is not shared with other employees or support teams. It is not sent to HR, IT, a counselor or a moderator." icon="lock-closed-outline" />

      {!existing ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: space.sm }}>
          <View style={{ flex: 1, paddingRight: space.md }}>
            <Text variant="h3" style={{ fontSize: 14 }}>Show my role & experience</Text>
            <Text variant="small">{kind === 'personal' ? 'Off by default for personal posts.' : 'Helps others weigh your question. Your name is never shown.'}</Text>
          </View>
          <Switch value={roleOn} onValueChange={setShowRole} accessibilityLabel="Show my role and experience"
            trackColor={{ true: colors.red, false: colors.border }} />
        </View>
      ) : null}

      {review ? <ModerationReview result={review} busy={busy} onEdit={() => setReview(null)} onPostAnyway={() => save(true)} /> : null}

      <View style={{ gap: space.md, marginTop: space.lg }}>
        <Button label={existing ? 'Save changes' : 'Save on this device'} onPress={() => save()} loading={busy && !review} disabled={!!review} />
        <Button label={preview ? 'Hide preview' : 'Preview'} variant="secondary" onPress={() => setPreview((p) => !p)} />
        {existing ? <Button label="Delete entry" variant="danger" onPress={() => confirmDeletePost(existing, repo, bump, true)} /> : null}
      </View>
    </Screen>
  );
}
