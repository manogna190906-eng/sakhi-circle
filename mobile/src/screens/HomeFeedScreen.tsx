import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { api } from '../api/client';
import {
  EncouragementQuote,
  TrendingPost,
  SuggestedCategory,
  EngagementNotification,
} from '../../../backend/src/types';
import { PublicPost } from '../../../backend/src/types';

const BADGE_META: Record<string, { emoji: string; label: string; color: string }> = {
  supporter: { emoji: '🤝', label: 'Supporter', color: '#E6E0F8' },
  mentor:    { emoji: '🌟', label: 'Mentor',    color: '#FFD6C0' },
  listener:  { emoji: '👂', label: 'Listener',  color: '#d4f0e8' },
};

export default function HomeFeedScreen({ navigation }: any) {
  const [quote, setQuote]             = useState<EncouragementQuote | null>(null);
  const [trending, setTrending]       = useState<TrendingPost[]>([]);
  const [suggested, setSuggested]     = useState<SuggestedCategory[]>([]);
  const [posts, setPosts]             = useState<PublicPost[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [cursor, setCursor]           = useState<string | null>(null);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    await Promise.all([loadQuote(), loadTrending(), loadSuggested(), loadFeed(true), loadUnread()]);
    setLoading(false);
  }

  async function loadQuote() {
    try {
      const res = await api.get('/engagement/quote');
      setQuote(res.data.quote);
    } catch {}
  }

  async function loadTrending() {
    try {
      const res = await api.get('/engagement/trending?limit=5');
      setTrending(res.data.posts);
    } catch {}
  }

  async function loadSuggested() {
    try {
      const res = await api.get('/engagement/suggested');
      setSuggested(res.data.categories);
    } catch {}
  }

  async function loadFeed(reset = false) {
    try {
      const params = reset ? '' : `?cursor=${cursor}`;
      const res = await api.get(`/feed${params}`);
      setPosts((prev: PublicPost[]) => (reset ? res.data.posts : [...prev, ...res.data.posts]));
      setCursor(res.data.nextCursor);
    } catch {}
  }

  async function loadUnread() {
    try {
      const res = await api.get('/engagement/notifications?limit=1');
      const all: EngagementNotification[] = res.data.notifications;
      setUnreadCount(all.filter((n) => !n.is_read).length);
    } catch {}
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  }, []);

  if (loading) return <ActivityIndicator style={{ flex: 1 }} color="#9c7fe0" />;

  return (
    <FlatList
      style={styles.container}
      data={posts}
      keyExtractor={(p: PublicPost) => p.post_id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#9c7fe0" />}
      onEndReached={() => cursor && loadFeed()}
      onEndReachedThreshold={0.4}
      ListHeaderComponent={
        <View>
          {/* Header row */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Sakhi Circle 🌸</Text>
            <TouchableOpacity
              style={styles.notifBtn}
              onPress={() => navigation.navigate('Notifications')}
              accessibilityRole="button"
              accessibilityLabel={`Notifications, ${unreadCount} unread`}
            >
              <Text style={styles.notifIcon}>🔔</Text>
              {unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Daily quote */}
          {quote && (
            <View style={styles.quoteCard}>
              <Text style={styles.quoteEmoji}>✨</Text>
              <Text style={styles.quoteText}>"{quote.text}"</Text>
              {quote.author && <Text style={styles.quoteAuthor}>— {quote.author}</Text>}
            </View>
          )}

          {/* Suggested communities */}
          {suggested.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>For You</Text>
              <View style={styles.suggestedRow}>
                {suggested.map((s: SuggestedCategory) => (
                  <TouchableOpacity
                    key={s.category}
                    style={[styles.suggestedChip, s.match_score > 0 && styles.suggestedChipMatch]}
                    onPress={() => navigation.navigate('Category', { category: s.category })}
                    accessibilityRole="button"
                  >
                    <Text style={styles.suggestedChipText}>{s.category}</Text>
                    <Text style={styles.suggestedChipCount}>{s.post_count} posts</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Trending discussions */}
          {trending.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Trending 🔥</Text>
              {trending.map((t: TrendingPost) => (
                <TouchableOpacity
                  key={t.post_id}
                  style={styles.trendingCard}
                  onPress={() => navigation.navigate('PostDetail', { postId: t.post_id })}
                  accessibilityRole="button"
                >
                  <Text style={styles.trendingTitle} numberOfLines={2}>{t.title}</Text>
                  <View style={styles.trendingMeta}>
                    <Text style={styles.trendingCategory}>{t.category}</Text>
                    <Text style={styles.trendingStat}>💜 {t.reaction_total}  💬 {t.comment_count}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <Text style={styles.feedHeading}>Community Feed</Text>
        </View>
      }
      renderItem={({ item }: { item: PublicPost }) => (
        <TouchableOpacity
          style={styles.postCard}
          onPress={() => navigation.navigate('PostDetail', { postId: item.post_id })}
          accessibilityRole="button"
        >
          <View style={styles.postMeta}>
            <Text style={styles.postCategory}>{item.category}</Text>
            {item.is_anonymous && <Text style={styles.anonBadge}>🌸 Anonymous</Text>}
          </View>
          <Text style={styles.postTitle} numberOfLines={2}>{item.title}</Text>
          <Text style={styles.postAuthor}>
            {item.author.name} · {new Date(item.created_at).toLocaleDateString()}
          </Text>
          <View style={styles.postReactions}>
            {Object.entries(item.reaction_counts).map(([type, count]) =>
              count > 0 ? (
                <Text key={type} style={styles.reactionPill}>
                  {type === 'support' ? '🤝' : type === 'hug' ? '🤗' : type === 'strong' ? '💪' : '💜'} {count}
                </Text>
              ) : null,
            )}
            <Text style={styles.commentCount}>💬 {item.comment_count}</Text>
          </View>
        </TouchableOpacity>
      )}
      ListEmptyComponent={
        <Text style={styles.emptyText}>No posts yet. Be the first to share! 🌸</Text>
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },

  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#4a3f6b' },
  notifBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  notifIcon: { fontSize: 22 },
  badge: {
    position: 'absolute', top: 4, right: 4,
    backgroundColor: '#e8956d', borderRadius: 8,
    minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },

  quoteCard: {
    margin: 16, padding: 18,
    backgroundColor: '#E6E0F8', borderRadius: 16,
    alignItems: 'center',
  },
  quoteEmoji: { fontSize: 24, marginBottom: 8 },
  quoteText: { fontSize: 15, color: '#4a3f6b', textAlign: 'center', fontStyle: 'italic', lineHeight: 22 },
  quoteAuthor: { fontSize: 12, color: '#7c6fa0', marginTop: 8 },

  section: { marginBottom: 8 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#4a3f6b', marginHorizontal: 16, marginBottom: 10 },
  feedHeading: { marginTop: 8 },

  suggestedRow: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 8 },
  suggestedChip: {
    paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: '#faf9ff', borderRadius: 14,
    borderWidth: 1, borderColor: '#e0d8f0',
    minHeight: 44, justifyContent: 'center',
  },
  suggestedChipMatch: { backgroundColor: '#FFD6C0', borderColor: '#e8956d' },
  suggestedChipText: { fontSize: 13, fontWeight: '600', color: '#4a3f6b' },
  suggestedChipCount: { fontSize: 11, color: '#9c8fc0', marginTop: 2 },

  trendingCard: {
    marginHorizontal: 16, marginBottom: 8,
    padding: 14, backgroundColor: '#fff9f5',
    borderRadius: 12, borderWidth: 1, borderColor: '#ffd6c0',
  },
  trendingTitle: { fontSize: 14, fontWeight: '600', color: '#4a3f6b', marginBottom: 6 },
  trendingMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  trendingCategory: {
    fontSize: 11, color: '#c07050', fontWeight: '600',
    backgroundColor: '#FFD6C0', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8,
  },
  trendingStat: { fontSize: 12, color: '#9c8fc0' },

  postCard: {
    marginHorizontal: 16, marginBottom: 12,
    padding: 16, backgroundColor: '#faf9ff',
    borderRadius: 14, borderWidth: 1, borderColor: '#e0d8f0',
  },
  postMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  postCategory: {
    fontSize: 11, color: '#c07050', fontWeight: '600',
    backgroundColor: '#FFD6C0', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8,
  },
  anonBadge: { fontSize: 11, color: '#7c4dff', fontWeight: '600' },
  postTitle: { fontSize: 15, fontWeight: '700', color: '#4a3f6b', marginBottom: 4 },
  postAuthor: { fontSize: 12, color: '#9c8fc0', marginBottom: 8 },
  postReactions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  reactionPill: {
    fontSize: 12, color: '#7c6fa0',
    backgroundColor: '#f3f0fb', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10,
  },
  commentCount: { fontSize: 12, color: '#9c8fc0' },

  emptyText: { textAlign: 'center', color: '#b0a8c8', marginTop: 40, fontSize: 15 },
});
