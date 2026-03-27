import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  Linking, StyleSheet, ActivityIndicator,
} from 'react-native';
import { api } from '../api/client';
import { HelpResource } from '../../../backend/src/types';

const CATEGORY_META: Record<string, { emoji: string; label: string; bg: string }> = {
  crisis:        { emoji: '🆘', label: 'Crisis',        bg: '#ffe0e0' },
  mental_health: { emoji: '🧠', label: 'Mental Health', bg: '#E6E0F8' },
  safety:        { emoji: '🛡️', label: 'Safety',        bg: '#FFD6C0' },
  legal:         { emoji: '⚖️', label: 'Legal Aid',     bg: '#d4f0e8' },
  medical:       { emoji: '🏥', label: 'Medical',       bg: '#e0f0ff' },
};

const CATEGORIES = Object.keys(CATEGORY_META);

export default function HelpResourcesScreen() {
  const [resources, setResources] = useState<HelpResource[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, [activeCategory]);

  async function load() {
    setLoading(true);
    try {
      const params = activeCategory ? `?category=${activeCategory}` : '';
      const res = await api.get(`/safety/help-resources${params}`);
      setResources(res.data.resources);
    } catch {}
    setLoading(false);
  }

  function callPhone(phone: string) {
    Linking.openURL(`tel:${phone}`);
  }

  function openUrl(url: string) {
    Linking.openURL(url);
  }

  return (
    <View style={styles.container}>
      {/* Emergency banner */}
      <View style={styles.emergencyBanner}>
        <Text style={styles.emergencyEmoji}>🆘</Text>
        <View style={styles.emergencyText}>
          <Text style={styles.emergencyTitle}>In immediate danger?</Text>
          <Text style={styles.emergencySubtitle}>Call 112 (Emergency) or 181 (Women Helpline)</Text>
        </View>
        <TouchableOpacity
          style={styles.callBtn}
          onPress={() => callPhone('112')}
          accessibilityRole="button"
          accessibilityLabel="Call emergency services"
        >
          <Text style={styles.callBtnText}>Call</Text>
        </TouchableOpacity>
      </View>

      {/* Category filter */}
      <FlatList
        horizontal
        data={[null, ...CATEGORIES]}
        keyExtractor={(item) => item ?? 'all'}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
        renderItem={({ item }: { item: string | null }) => {
          const meta = item ? CATEGORY_META[item] : null;
          const isActive = activeCategory === item;
          return (
            <TouchableOpacity
              style={[styles.filterChip, isActive && styles.filterChipActive]}
              onPress={() => setActiveCategory(item)}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
            >
              <Text style={styles.filterChipText}>
                {meta ? `${meta.emoji} ${meta.label}` : 'All'}
              </Text>
            </TouchableOpacity>
          );
        }}
        style={styles.filterList}
      />

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color="#9c7fe0" />
      ) : (
        <FlatList
          data={resources}
          keyExtractor={(r: HelpResource) => r.resource_id}
          contentContainerStyle={styles.list}
          renderItem={({ item }: { item: HelpResource }) => {
            const meta = CATEGORY_META[item.category];
            return (
              <View style={[styles.card, { borderLeftColor: meta?.bg ?? '#e0d8f0' }]}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardEmoji}>{meta?.emoji ?? '🌸'}</Text>
                  <View style={styles.cardTitles}>
                    <Text style={styles.cardTitle}>{item.title}</Text>
                    {item.description && (
                      <Text style={styles.cardDesc}>{item.description}</Text>
                    )}
                  </View>
                </View>
                <View style={styles.cardActions}>
                  {item.phone && (
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={() => callPhone(item.phone!)}
                      accessibilityRole="button"
                      accessibilityLabel={`Call ${item.title}`}
                    >
                      <Text style={styles.actionBtnText}>📞 {item.phone}</Text>
                    </TouchableOpacity>
                  )}
                  {item.url && (
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.actionBtnSecondary]}
                      onPress={() => openUrl(item.url!)}
                      accessibilityRole="link"
                      accessibilityLabel={`Visit ${item.title} website`}
                    >
                      <Text style={styles.actionBtnTextSecondary}>🌐 Visit</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <Text style={styles.empty}>No resources found for this category.</Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },

  emergencyBanner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#ffe0e0', margin: 16,
    borderRadius: 14, padding: 14, gap: 10,
  },
  emergencyEmoji: { fontSize: 28 },
  emergencyText: { flex: 1 },
  emergencyTitle: { fontSize: 14, fontWeight: '700', color: '#8b0000' },
  emergencySubtitle: { fontSize: 12, color: '#c0392b', marginTop: 2 },
  callBtn: {
    backgroundColor: '#c0392b', borderRadius: 10,
    paddingHorizontal: 16, paddingVertical: 10, minHeight: 44, justifyContent: 'center',
  },
  callBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  filterList: { maxHeight: 56 },
  filterRow: { paddingHorizontal: 16, gap: 8, alignItems: 'center' },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: '#faf9ff', borderRadius: 20,
    borderWidth: 1, borderColor: '#e0d8f0', minHeight: 44, justifyContent: 'center',
  },
  filterChipActive: { backgroundColor: '#E6E0F8', borderColor: '#9c7fe0' },
  filterChipText: { fontSize: 13, color: '#4a3f6b', fontWeight: '600' },

  list: { padding: 16, gap: 12 },
  card: {
    backgroundColor: '#faf9ff', borderRadius: 14,
    padding: 14, borderLeftWidth: 4, borderLeftColor: '#E6E0F8',
    borderWidth: 1, borderColor: '#e0d8f0',
  },
  cardHeader: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  cardEmoji: { fontSize: 24, marginTop: 2 },
  cardTitles: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#4a3f6b' },
  cardDesc: { fontSize: 13, color: '#7c6fa0', marginTop: 3, lineHeight: 18 },
  cardActions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  actionBtn: {
    backgroundColor: '#9c7fe0', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10, minHeight: 44, justifyContent: 'center',
  },
  actionBtnSecondary: { backgroundColor: '#f3f0fb', borderWidth: 1, borderColor: '#c5b8f0' },
  actionBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  actionBtnTextSecondary: { color: '#7c4dff', fontSize: 13, fontWeight: '600' },

  empty: { textAlign: 'center', color: '#b0a8c8', marginTop: 40, fontSize: 14 },
});
