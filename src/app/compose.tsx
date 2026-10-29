import { useEffect, useState } from 'react';
import { Pressable, Switch, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { Badge, Button, Card, Chip, Field, Header, Loading, Notice, Screen, Text } from '@/components/ui';
import { Capy } from '@/components/Capy';
import { AuthorTag } from '@/components/community';
import { ModerationReview } from '@/components/ModerationReview';
import { confirmDeletePost } from '@/components/postActions';
import { colors, radius, space } from '@/constants/brand';
import { validatePostInput } from '@/data/shared';
import type { Community, Post, PostKind } from '@/data/types';
import { CATEGORIES, KIND_LABEL, MAX_ATTACHMENTS, MAX_BODY } from '@/lib/categories';
import { checkContent, type ModerationResult } from '@/lib/moderation';
import { useApp } from '@/state/AppProvider';

const KINDS = Object.keys(KIND_LABEL) as PostKind[];
const MAX_POLL_OPTIONS = 6;

export default function Compose() {
  const params = useLocalSearchParams<{ type?: string; category?: string; id?: string; community?: string }>();
  const { repo, bump, profile } = useApp();
  const editingId = typeof params.id === 'string' ? params.id : undefined;
  const startKind: PostKind = KINDS.includes(params.type as PostKind) ? (params.type as PostKind) : 'personal';

  const [kind, setKind] = useState<PostKind>(startKind);
  const [category, setCategory] = useState<string>(typeof params.category === 'string' ? params.category : CATEGORIES[startKind][0]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [images, setImages] = useState<string[]>([]);
  const [communityId, setCommunityId] = useState<string | null>(typeof params.community === 'string' ? params.community : null);
  const [communities, setCommunities] = useState<Community[]>([]);
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
      try {
        const p = await repo.getPost(editingId);
        if (p?.mine) { setExisting(p); setKind(p.kind); setCategory(p.category); setTitle(p.title); setBody(p.body); }
      } catch { /* shown as "not found" below */ }
      setLoading(false);
    })();
  }, [editingId, repo]);

  useEffect(() => {
    if (editingId) return;
    repo.listCommunities().then(setCommunities).catch(() => { /* optional: posting works without a community */ });
  }, [editingId, repo]);

  const switchKind = (k: PostKind) => { setKind(k); setCategory(CATEGORIES[k][0]); setError(null); };
  const cleanOptions = options.map((o) => o.trim()).filter(Boolean);

  const pickImages = async () => {
    const room = MAX_ATTACHMENTS - images.length;
    if (room <= 0) return;
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: room, quality: 1 });
    if (!res.canceled) setImages((cur) => [...cur, ...res.assets.map((a) => a.uri)].slice(0, MAX_ATTACHMENTS));
  };

  const save = async (force = false) => {
    const problem = validatePostInput(title, body, kind);
    if (problem) { setError(problem); return; }
    if (kind === 'personal' && !body.trim() && !title.trim()) { setError('Write a few words, or go back if you would rather not save anything.'); return; }
    if (kind === 'poll' && !existing && (cleanOptions.length < 2 || new Set(cleanOptions.map((o) => o.toLowerCase())).size !== cleanOptions.length)) {
      setError('A poll needs at least two different options.'); return;
    }
    if (!force) {
      const res = checkContent(`${title}\n${body}\n${cleanOptions.join('\n')}`);
      if (res.issues.length) { setReview(res); return; }
    }
    setBusy(true); setError(null); setReview(null);
    try {
      let post: Post | null;
      if (existing) {
        post = await repo.updatePost(existing.id, { category, title, body });
      } else {
        const attachments: string[] = [];
        for (const uri of images) attachments.push(await repo.uploadImage(uri));
        post = await repo.createPost({
          kind, category, title, showAuthor: roleOn, communityId, attachments,
          body: kind === 'poll' && !body.trim() ? 'Choose an option below.' : body,
          pollOptions: kind === 'poll' ? cleanOptions : undefined,
        });
      }
      bump();
      setSaved(post);
    } catch (e) {
      setError(e instanceof Error && /rate limit/i.test(e.message)
        ? 'You are posting a lot. Please wait a little and try again.'
        : 'Could not save. Check your internet connection and try again.');
    }
    setBusy(false);
  };

  if (loading) return <Screen><Loading /></Screen>;

  if (saved) {
    return (
      <Screen>
        <View style={{ alignItems: 'center', marginTop: space.xl }}>
          <Capy pose={saved.kind === 'personal' ? 'takecare' : 'celebrate'} size={170} motion="pop"
            label={saved.kind === 'personal' ? 'Cappy sending care' : 'Cappy celebrating'} />
          <Text variant="title" accessibilityRole="header" style={{ marginTop: space.lg, textAlign: 'center' }}>
            {saved.kind === 'personal' ? 'Thanks for sharing' : 'You did it!'}
          </Text>
          <Text variant="body" style={{ textAlign: 'center', marginTop: space.xs }}>
            {saved.kind === 'personal' ? 'Writing it down is a good step.' : 'Small steps make a big difference.'}
          </Text>
        </View>
        <Card tint={colors.green} style={{ marginTop: space.xl }}>
          <Text variant="h3">Your {KIND_LABEL[saved.kind].toLowerCase()} was {existing ? 'updated' : 'posted'}.</Text>
          <Text variant="body" style={{ marginTop: space.xs }}>
            Colleagues can see it and reply. Your name and email are never shown. It is not sent to HR, IT or a counselor.
          </Text>
        </Card>
        <View style={{ gap: space.md, marginTop: space.xl }}>
          <Button label="View my post" onPress={() => router.replace({ pathname: '/post/[id]', params: { id: saved.id } })} />
          <Button label="Browse resources" variant="secondary" onPress={() => router.replace('/resources')} />
          <Button label="Done" variant="ghost" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  const heading = existing ? `Edit ${KIND_LABEL[kind]}` : KIND_LABEL[kind];
  const titleLabel = kind === 'achievement' ? 'Achievement title' : kind === 'poll' ? 'Your question' : kind === 'idea' ? 'Your idea' : kind === 'discussion' ? 'Topic' : 'Question title';
  const titlePlaceholder = kind === 'achievement' ? 'What are you proud of?' : kind === 'poll' ? 'e.g. Which day works best for team lunch?'
    : kind === 'idea' ? 'e.g. Quiet rooms on every floor' : kind === 'discussion' ? 'What would you like to talk about?' : 'e.g. How do I apply for an internal transfer?';

  return (
    <Screen>
      <Header title={heading} back />
      {kind === 'personal' ? (
        <View style={{ marginBottom: space.lg }}>
          <Text variant="h2">Share it, anonymously</Text>
          <Text variant="body">There&apos;s no right way to put it. Colleagues can read it and reply with support. Your name and email are never shown.</Text>
        </View>
      ) : null}

      {!existing && !params.type ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.lg }}>
          {KINDS.map((k) => <Chip key={k} label={KIND_LABEL[k]} selected={kind === k} onPress={() => switchKind(k)} />)}
        </View>
      ) : null}

      <Text variant="h3" style={{ marginBottom: space.sm }}>Category</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.lg }}>
        {CATEGORIES[kind].map((c) => <Chip key={c} label={c} selected={category === c} onPress={() => setCategory(c)} />)}
      </View>

      {!existing && communities.length ? (
        <>
          <Text variant="h3" style={{ marginBottom: space.sm }}>Community (optional)</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.lg }}>
            <Chip label="None" selected={!communityId} onPress={() => setCommunityId(null)} />
            {communities.map((c) => <Chip key={c.id} label={c.name} selected={communityId === c.id} onPress={() => setCommunityId(c.id)} />)}
          </View>
        </>
      ) : null}

      {kind !== 'personal' ? (
        <Field label={titleLabel} value={title} onChangeText={(t) => { setTitle(t); setReview(null); }} maxLength={120} placeholder={titlePlaceholder} />
      ) : null}

      <Field
        label={kind === 'personal' ? "What's on your mind?" : kind === 'poll' ? 'More detail (optional)' : 'Details'}
        value={body} onChangeText={(t) => { setBody(t); setReview(null); }} multiline maxLength={MAX_BODY}
        placeholder={kind === 'personal' ? 'Take your time…' : 'Add a little context'}
        error={error} hint={`${body.length}/${MAX_BODY}`} />

      {kind === 'poll' && !existing ? (
        <View style={{ marginBottom: space.md }}>
          <Text variant="h3" style={{ marginBottom: space.sm }}>Options</Text>
          {options.map((o, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.sm }}>
              <View style={{ flex: 1 }}>
                <Field label={`Option ${i + 1}`} value={o} maxLength={80} placeholder={i < 2 ? 'Required' : 'Optional'}
                  onChangeText={(t) => { setOptions((cur) => cur.map((x, j) => (j === i ? t : x))); setReview(null); }} />
              </View>
              {options.length > 2 ? (
                <Pressable accessibilityRole="button" accessibilityLabel={`Remove option ${i + 1}`} hitSlop={8}
                  onPress={() => setOptions((cur) => cur.filter((_, j) => j !== i))} style={{ marginTop: 28, padding: 6 }}>
                  <Ionicons name="close-circle" size={22} color={colors.muted} />
                </Pressable>
              ) : null}
            </View>
          ))}
          {options.length < MAX_POLL_OPTIONS ? (
            <Button label="Add an option" icon="add" variant="secondary" onPress={() => setOptions((cur) => [...cur, ''])} />
          ) : null}
          <Text variant="small" style={{ marginTop: space.sm }}>Results are shown to people once they have voted.</Text>
        </View>
      ) : null}

      {!existing ? (
        <View style={{ marginBottom: space.md }}>
          <Text variant="h3" style={{ marginBottom: space.sm }}>Photos (optional)</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {images.map((uri) => (
              <View key={uri} style={{ width: 84, height: 84 }}>
                <Image source={{ uri }} style={{ width: 84, height: 84, borderRadius: radius.md }} contentFit="cover" accessibilityLabel="Attached photo" />
                <Pressable accessibilityRole="button" accessibilityLabel="Remove photo" hitSlop={8}
                  onPress={() => setImages((cur) => cur.filter((u) => u !== uri))} style={{ position: 'absolute', top: -6, right: -6 }}>
                  <Ionicons name="close-circle" size={24} color={colors.red} />
                </Pressable>
              </View>
            ))}
            {images.length < MAX_ATTACHMENTS ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Add a photo" onPress={pickImages}
                style={{ width: 84, height: 84, borderRadius: radius.md, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.border,
                  alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="image-outline" size={26} color={colors.muted} />
              </Pressable>
            ) : null}
          </View>
          <Text variant="small" style={{ marginTop: space.sm }}>
            Up to {MAX_ATTACHMENTS} photos, resized and re-saved on your phone, which normally drops location details. Avoid photos that show your face or badge if you want to stay anonymous.
          </Text>
        </View>
      ) : null}

      {preview ? (
        <Card style={{ marginBottom: space.lg }}>
          <Text variant="label">PREVIEW</Text>
          <Text variant="h3" style={{ marginTop: 4 }}>{title || (kind === 'personal' ? 'Personal post' : '(no title)')}</Text>
          <View style={{ marginVertical: 6, flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            {roleOn && profile ? <AuthorTag author={{ role: profile.role, experience: profile.experience, verified: profile.verified }} /> : null}
            <Badge label="Shared by you" tone="local" />
          </View>
          <Text variant="body">{body || '(nothing written)'}</Text>
          {kind === 'poll' ? cleanOptions.map((o) => <Text key={o} variant="body" style={{ marginTop: 4 }}>◯ {o}</Text>) : null}
        </Card>
      ) : null}

      <Notice text={kind === 'personal'
        ? 'Visible to colleagues without your name. This app is not monitored: if you or someone else is in danger, contact your local emergency services.'
        : 'Visible to colleagues who sign in with a verified email. Your name and email are never shown. Please do not include confidential information.'}
      icon="eye-off-outline" />

      {!existing ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: space.sm }}>
          <View style={{ flex: 1, paddingRight: space.md }}>
            <Text variant="h3" style={{ fontSize: 14 }}>Show my role & experience</Text>
            <Text variant="small">{kind === 'personal' ? 'Off by default for personal posts.' : 'Helps others weigh your post. Your name is never shown.'}</Text>
          </View>
          <Switch value={roleOn} onValueChange={setShowRole} accessibilityLabel="Show my role and experience"
            trackColor={{ true: colors.red, false: colors.border }} />
        </View>
      ) : null}

      {review ? <ModerationReview result={review} busy={busy} onEdit={() => setReview(null)} onPostAnyway={() => save(true)} /> : null}

      <View style={{ gap: space.md, marginTop: space.lg }}>
        <Button label={existing ? 'Save changes' : 'Post'} onPress={() => save()} loading={busy && !review} disabled={!!review} />
        <Button label={preview ? 'Hide preview' : 'Preview'} variant="secondary" onPress={() => setPreview((p) => !p)} />
        {existing ? <Button label="Delete post" variant="danger" onPress={() => confirmDeletePost(existing, repo, bump, true)} /> : null}
      </View>
    </Screen>
  );
}

