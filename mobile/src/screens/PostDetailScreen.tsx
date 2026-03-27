import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { api } from '../api/client';
import { PublicPost, PublicComment } from '../../../backend/src/types';

interface PostDetailData extends PublicPost {
  comments: PublicComment[];
}

export default function PostDetailScreen({ route }: any) {
  const { postId } = route.params;
  const [data, setData] = useState<PostDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [commentAnon, setCommentAnon] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchPost();
  }, [postId]);

  async function fetchPost() {
    try {
      const res = await api.get(`/posts/${postId}`);
      setData(res.data);
    } catch {
      Alert.alert('Error', 'Could not load post.');
    } finally {
      setLoading(false);
    }
  }

  async function submitComment() {
    if (!commentText.trim()) return;
    setSubmitting(true);
    try {
      await api.post(`/posts/${postId}/comments`, {
        content: commentText.trim(),
        is_anonymous: commentAnon,
      });
      setCommentText('');
      fetchPost(); // refresh
    } catch {
      Alert.alert('Error', 'Could not post comment.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <ActivityIndicator style={{ flex: 1 }} color="#9c7fe0" />;
  if (!data) return null;

  return (
    <FlatList
      style={styles.container}
      data={data.comments}
      keyExtractor={(c: PublicComment) => c.comment_id}
      ListHeaderComponent={
        <View>
          {/* Post card */}
          <View style={styles.postCard}>
            <AuthorRow name={data.author.name} isAnonymous={data.is_anonymous} />
            <Text style={styles.postTitle}>{data.title}</Text>
            <Text style={styles.postContent}>{data.content}</Text>
            <View style={styles.metaRow}>
              <Text style={styles.categoryChip}>{data.category}</Text>
              <Text style={styles.typeChip}>{data.type.replace('_', ' ')}</Text>
            </View>
            <ReactionBar counts={data.reaction_counts} postId={postId} onReact={fetchPost} />
          </View>

          <Text style={styles.commentsHeading}>
            {data.comment_count} {data.comment_count === 1 ? 'Comment' : 'Comments'}
          </Text>
        </View>
      }
      renderItem={({ item }: { item: PublicComment }) => <CommentCard comment={item} />}
      ListFooterComponent={
        <View style={styles.commentInputArea}>
          <TextInput
            style={styles.commentInput}
            placeholder="Write a supportive comment…"
            placeholderTextColor="#b0a8c8"
            value={commentText}
            onChangeText={setCommentText}
            multiline
            accessibilityLabel="Comment input"
          />
          <TouchableOpacity
            style={styles.anonToggle}
            onPress={() => setCommentAnon((v: boolean) => !v)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: commentAnon }}
          >
            <Text style={styles.anonToggleText}>
              {commentAnon ? '🌸 Posting as Anonymous Sister' : '👤 Post anonymously'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.commentBtn, submitting && { opacity: 0.6 }]}
            onPress={submitComment}
            disabled={submitting}
            accessibilityRole="button"
          >
            <Text style={styles.commentBtnText}>{submitting ? 'Posting…' : 'Comment'}</Text>
          </TouchableOpacity>
        </View>
      }
    />
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function AuthorRow({ name, isAnonymous }: { name: string; isAnonymous: boolean }) {
  return (
    <View style={styles.authorRow}>
      <View style={[styles.avatar, isAnonymous && styles.avatarAnon]}>
        <Text style={styles.avatarText}>{isAnonymous ? '🌸' : name[0]?.toUpperCase()}</Text>
      </View>
      <Text style={[styles.authorName, isAnonymous && styles.authorNameAnon]}>{name}</Text>
      {isAnonymous && <Text style={styles.anonBadge}>Anonymous</Text>}
    </View>
  );
}

function CommentCard({ comment }: { comment: PublicComment }) {
  return (
    <View style={styles.commentCard}>
      <AuthorRow name={comment.author.name} isAnonymous={comment.is_anonymous} />
      <Text style={styles.commentContent}>{comment.content}</Text>
      {comment.replies?.map((reply: PublicComment) => (
        <View key={reply.comment_id} style={styles.replyCard}>
          <AuthorRow name={reply.author.name} isAnonymous={reply.is_anonymous} />
          <Text style={styles.commentContent}>{reply.content}</Text>
        </View>
      ))}
    </View>
  );
}

function ReactionBar({
  counts,
  postId,
  onReact,
}: {
  counts: Record<string, number>;
  postId: string;
  onReact: () => void;
}) {
  const reactions = [
    { type: 'support', emoji: '🤝', label: 'Support' },
    { type: 'hug', emoji: '🤗', label: 'Hug' },
    { type: 'strong', emoji: '💪', label: 'Stay Strong' },
    { type: 'like', emoji: '💜', label: 'Like' },
  ];

  async function react(type: string) {
    try {
      await api.post(`/posts/${postId}/reactions`, { type });
      onReact();
    } catch {}
  }

  return (
    <View style={styles.reactionBar}>
      {reactions.map((r) => (
        <TouchableOpacity
          key={r.type}
          style={styles.reactionBtn}
          onPress={() => react(r.type)}
          accessibilityRole="button"
          accessibilityLabel={`${r.label}: ${counts[r.type] ?? 0}`}
        >
          <Text style={styles.reactionEmoji}>{r.emoji}</Text>
          <Text style={styles.reactionCount}>{counts[r.type] ?? 0}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },

  postCard: {
    margin: 16, padding: 18,
    backgroundColor: '#faf9ff',
    borderRadius: 16,
    borderWidth: 1, borderColor: '#e0d8f0',
  },
  postTitle: { fontSize: 18, fontWeight: '700', color: '#4a3f6b', marginBottom: 8 },
  postContent: { fontSize: 15, color: '#555', lineHeight: 22, marginBottom: 12 },
  metaRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  categoryChip: {
    backgroundColor: '#FFD6C0', color: '#7a3a1e',
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 10, fontSize: 12, fontWeight: '600',
  },
  typeChip: {
    backgroundColor: '#E6E0F8', color: '#4a3f6b',
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 10, fontSize: 12, fontWeight: '600',
    textTransform: 'capitalize',
  },

  authorRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
  avatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#E6E0F8', alignItems: 'center', justifyContent: 'center',
  },
  avatarAnon: { backgroundColor: '#FFD6C0' },
  avatarText: { fontSize: 16 },
  authorName: { fontSize: 14, fontWeight: '600', color: '#4a3f6b' },
  authorNameAnon: { color: '#9c7fe0', fontStyle: 'italic' },
  anonBadge: {
    backgroundColor: '#E6E0F8', color: '#7c4dff',
    paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 8, fontSize: 11, fontWeight: '600',
  },

  reactionBar: { flexDirection: 'row', gap: 8 },
  reactionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#f3f0fb', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 8,
    minHeight: 44,
  },
  reactionEmoji: { fontSize: 16 },
  reactionCount: { fontSize: 13, color: '#7c6fa0', fontWeight: '600' },

  commentsHeading: {
    fontSize: 15, fontWeight: '700', color: '#4a3f6b',
    marginHorizontal: 16, marginBottom: 8,
  },
  commentCard: {
    marginHorizontal: 16, marginBottom: 12,
    padding: 14, backgroundColor: '#faf9ff',
    borderRadius: 12, borderWidth: 1, borderColor: '#e0d8f0',
  },
  replyCard: {
    marginTop: 10, marginLeft: 20,
    padding: 12, backgroundColor: '#fff5f0',
    borderRadius: 10, borderWidth: 1, borderColor: '#ffd6c0',
  },
  commentContent: { fontSize: 14, color: '#555', lineHeight: 20 },

  commentInputArea: { margin: 16 },
  commentInput: {
    backgroundColor: '#faf9ff',
    borderWidth: 1, borderColor: '#e0d8f0',
    borderRadius: 12, padding: 14,
    fontSize: 14, color: '#333',
    minHeight: 80, textAlignVertical: 'top',
    marginBottom: 10,
  },
  anonToggle: {
    paddingVertical: 10, marginBottom: 10,
    minHeight: 44, justifyContent: 'center',
  },
  anonToggleText: { color: '#9c7fe0', fontSize: 13, fontWeight: '600' },
  commentBtn: {
    backgroundColor: '#9c7fe0', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
    minHeight: 48,
  },
  commentBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
