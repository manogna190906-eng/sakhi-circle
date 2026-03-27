import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { api } from '../api/client';
import { EngagementNotification } from '../../../backend/src/types';

const NOTIF_META: Record<string, { emoji: string; label: string }> = {
  comment:       { emoji: '💬', label: 'commented on your post' },
  reply:         { emoji: '↩️', label: 'replied to your comment' },
  reaction:      { emoji: '💜', label: 'reacted to your post' },
  chat:          { emoji: '✉️', label: 'sent you a message' },
  moderation:    { emoji: '🛡️', label: 'Moderation update' },
  badge_awarded: { emoji: '🏅', label: 'You earned a badge' },
};

export default function NotificationsScreen({ navigation }: any) {
  const [notifications, setNotifications] = useState<EngagementNotification[]>([]);
  const [cursor, setCursor]               = useState<string | null>(null);
  const [loading, setLoading]             = useState(true);

  useEffect(() => { load(); }, []);

  async function load(reset = true) {
    try {
      const params = !reset && cursor ? `?cursor=${cursor}` : '';
      const res = await api.get(`/engagement/notifications${params}`);
      const incoming: EngagementNotification[] = res.data.notifications;
      setNotifications((prev: EngagementNotification[]) => (reset ? incoming : [...prev, ...incoming]));
      setCursor(res.data.nextCursor);

      // Mark all unread as read
      const unreadIds = incoming.filter((n) => !n.is_read).map((n) => n.notification_id);
      if (unreadIds.length) await api.post('/engagement/notifications/read', { ids: unreadIds });
    } catch {}
    setLoading(false);
  }

  function handleTap(n: EngagementNotification) {
    if (n.type === 'chat') navigation.navigate('Chat');
    else if (n.type === 'badge_awarded') navigation.navigate('Profile');
    else navigation.navigate('PostDetail', { postId: n.reference_id });
  }

  if (loading) return <ActivityIndicator style={{ flex: 1 }} color="#9c7fe0" />;

  return (
    <FlatList
      style={styles.container}
      data={notifications}
      keyExtractor={(n: EngagementNotification) => n.notification_id}
      onEndReached={() => cursor && load(false)}
      onEndReachedThreshold={0.4}
      ListHeaderComponent={<Text style={styles.heading}>Notifications</Text>}
      renderItem={({ item }: { item: EngagementNotification }) => {
        const meta = NOTIF_META[item.type] ?? { emoji: '🔔', label: '' };
        return (
          <TouchableOpacity
            style={[styles.card, !item.is_read && styles.cardUnread]}
            onPress={() => handleTap(item)}
            accessibilityRole="button"
            accessibilityLabel={`${meta.label}${item.preview ? ': ' + item.preview : ''}`}
          >
            <Text style={styles.emoji}>{meta.emoji}</Text>
            <View style={styles.body}>
              {item.actor_name && (
                <Text style={styles.actor}>{item.actor_name}</Text>
              )}
              <Text style={styles.label}>{meta.label}</Text>
              {item.preview && (
                <Text style={styles.preview} numberOfLines={2}>{item.preview}</Text>
              )}
              <Text style={styles.time}>
                {new Date(item.created_at).toLocaleString()}
              </Text>
            </View>
            {!item.is_read && <View style={styles.dot} />}
          </TouchableOpacity>
        );
      }}
      ListEmptyComponent={
        <Text style={styles.empty}>You're all caught up 🌸</Text>
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  heading: { fontSize: 20, fontWeight: '700', color: '#4a3f6b', margin: 16 },

  card: {
    flexDirection: 'row', alignItems: 'flex-start',
    marginHorizontal: 16, marginBottom: 10,
    padding: 14, backgroundColor: '#faf9ff',
    borderRadius: 14, borderWidth: 1, borderColor: '#e0d8f0',
    gap: 12,
  },
  cardUnread: { backgroundColor: '#f0ecff', borderColor: '#c5b8f0' },
  emoji: { fontSize: 22, marginTop: 2 },
  body: { flex: 1 },
  actor: { fontSize: 14, fontWeight: '700', color: '#4a3f6b' },
  label: { fontSize: 13, color: '#7c6fa0', marginTop: 1 },
  preview: { fontSize: 13, color: '#555', marginTop: 4, lineHeight: 18 },
  time: { fontSize: 11, color: '#b0a8c8', marginTop: 6 },
  dot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#9c7fe0', marginTop: 6,
  },
  empty: { textAlign: 'center', color: '#b0a8c8', marginTop: 60, fontSize: 15 },
});
