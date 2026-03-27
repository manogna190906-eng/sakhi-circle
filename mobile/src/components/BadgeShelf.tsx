import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Badge } from '../../../backend/src/types';

const BADGE_META: Record<string, { emoji: string; label: string; desc: string; bg: string }> = {
  supporter: {
    emoji: '🤝',
    label: 'Supporter',
    desc: 'Received 10+ reactions from the community',
    bg: '#E6E0F8',
  },
  mentor: {
    emoji: '🌟',
    label: 'Mentor',
    desc: 'Shared 5+ posts to help others',
    bg: '#FFD6C0',
  },
  listener: {
    emoji: '👂',
    label: 'Listener',
    desc: 'Left 20+ supportive comments',
    bg: '#d4f0e8',
  },
};

interface Props {
  badges: Badge[];
}

export default function BadgeShelf({ badges }: Props) {
  if (!badges.length) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Badges</Text>
      <View style={styles.row}>
        {badges.map((b) => {
          const meta = BADGE_META[b.type];
          if (!meta) return null;
          return (
            <View
              key={b.badge_id}
              style={[styles.badge, { backgroundColor: meta.bg }]}
              accessibilityLabel={`${meta.label} badge: ${meta.desc}`}
            >
              <Text style={styles.emoji}>{meta.emoji}</Text>
              <Text style={styles.label}>{meta.label}</Text>
              <Text style={styles.desc}>{meta.desc}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginHorizontal: 16, marginBottom: 20 },
  heading: { fontSize: 15, fontWeight: '700', color: '#4a3f6b', marginBottom: 10 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  badge: {
    width: 100, padding: 12,
    borderRadius: 14, alignItems: 'center',
  },
  emoji: { fontSize: 28, marginBottom: 4 },
  label: { fontSize: 13, fontWeight: '700', color: '#4a3f6b', textAlign: 'center' },
  desc: { fontSize: 10, color: '#7c6fa0', textAlign: 'center', marginTop: 4, lineHeight: 14 },
});
