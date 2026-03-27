import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Switch,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import { api } from '../api/client';

const CATEGORIES = ['Mental Health', 'Career', 'Relationships', 'Safety', 'Health', 'Finance'];
const POST_TYPES = ['question', 'experience', 'help_request'] as const;
type PostType = typeof POST_TYPES[number];

const TYPE_LABELS: Record<PostType, string> = {
  question: 'Question',
  experience: 'Share Experience',
  help_request: 'Ask for Help',
};

export default function CreatePostScreen({ navigation }: any) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('');
  const [postType, setPostType] = useState<PostType>('question');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!title.trim() || !content.trim() || !category) {
      Alert.alert('Missing fields', 'Please fill in title, content, and select a category.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post('/posts', {
        title: title.trim(),
        content: content.trim(),
        type: postType,
        category,
        is_anonymous: isAnonymous,
      });

      if (res.data.post?.status === 'pending_review') {
        Alert.alert(
          'Post submitted',
          'Your post is being reviewed and will appear shortly.',
          [{ text: 'OK', onPress: () => navigation.goBack() }],
        );
      } else {
        navigation.goBack();
      }
    } catch {
      Alert.alert('Error', 'Could not submit post. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>New Post</Text>

      {/* Post type selector */}
      <View style={styles.typeRow}>
        {POST_TYPES.map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.typeChip, postType === t && styles.typeChipActive]}
            onPress={() => setPostType(t)}
            accessibilityRole="button"
            accessibilityState={{ selected: postType === t }}
          >
            <Text style={[styles.typeChipText, postType === t && styles.typeChipTextActive]}>
              {TYPE_LABELS[t]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Title */}
      <TextInput
        style={styles.input}
        placeholder="Title"
        placeholderTextColor="#b0a8c8"
        value={title}
        onChangeText={setTitle}
        maxLength={300}
        accessibilityLabel="Post title"
      />

      {/* Body */}
      <TextInput
        style={[styles.input, styles.bodyInput]}
        placeholder="Share your thoughts, question, or experience…"
        placeholderTextColor="#b0a8c8"
        value={content}
        onChangeText={setContent}
        multiline
        textAlignVertical="top"
        accessibilityLabel="Post content"
      />

      {/* Category chips */}
      <Text style={styles.label}>Category</Text>
      <View style={styles.categoryRow}>
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[styles.categoryChip, category === cat && styles.categoryChipActive]}
            onPress={() => setCategory(cat)}
            accessibilityRole="button"
            accessibilityState={{ selected: category === cat }}
          >
            <Text style={[styles.categoryChipText, category === cat && styles.categoryChipTextActive]}>
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Anonymous toggle */}
      <View style={styles.anonRow}>
        <View style={styles.anonTextBlock}>
          <Text style={styles.anonLabel}>Post as "Anonymous Sister"</Text>
          <Text style={styles.anonHint}>Your name won't be shown publicly</Text>
        </View>
        <Switch
          value={isAnonymous}
          onValueChange={setIsAnonymous}
          trackColor={{ false: '#e0d8f0', true: '#b39ddb' }}
          thumbColor={isAnonymous ? '#7c4dff' : '#f4f3f4'}
          accessibilityLabel="Toggle anonymous posting"
        />
      </View>

      {isAnonymous && (
        <View style={styles.anonBadge}>
          <Text style={styles.anonBadgeText}>🌸 You'll appear as "Anonymous Sister"</Text>
        </View>
      )}

      {/* Submit */}
      <TouchableOpacity
        style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
        onPress={handleSubmit}
        disabled={submitting}
        accessibilityRole="button"
        accessibilityLabel="Submit post"
      >
        <Text style={styles.submitBtnText}>{submitting ? 'Posting…' : 'Post'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { padding: 20, paddingBottom: 40 },
  heading: { fontSize: 22, fontWeight: '700', color: '#4a3f6b', marginBottom: 16 },

  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  typeChip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, backgroundColor: '#f3f0fb',
    borderWidth: 1, borderColor: '#e0d8f0',
    minHeight: 44, justifyContent: 'center',
  },
  typeChipActive: { backgroundColor: '#E6E0F8', borderColor: '#9c7fe0' },
  typeChipText: { color: '#7c6fa0', fontSize: 13 },
  typeChipTextActive: { color: '#4a3f6b', fontWeight: '600' },

  input: {
    backgroundColor: '#faf9ff',
    borderWidth: 1, borderColor: '#e0d8f0',
    borderRadius: 12, padding: 14,
    fontSize: 15, color: '#333',
    marginBottom: 14,
    minHeight: 44,
  },
  bodyInput: { minHeight: 120 },

  label: { fontSize: 13, color: '#7c6fa0', marginBottom: 8, fontWeight: '600' },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  categoryChip: {
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 16, backgroundColor: '#fff5f0',
    borderWidth: 1, borderColor: '#ffd6c0',
    minHeight: 44, justifyContent: 'center',
  },
  categoryChipActive: { backgroundColor: '#FFD6C0', borderColor: '#e8956d' },
  categoryChipText: { color: '#c07050', fontSize: 13 },
  categoryChipTextActive: { color: '#7a3a1e', fontWeight: '600' },

  anonRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#faf9ff',
    borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#e0d8f0',
    marginBottom: 10,
  },
  anonTextBlock: { flex: 1, marginRight: 12 },
  anonLabel: { fontSize: 15, color: '#4a3f6b', fontWeight: '600' },
  anonHint: { fontSize: 12, color: '#9c8fc0', marginTop: 2 },

  anonBadge: {
    backgroundColor: '#E6E0F8', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 8,
    marginBottom: 16, alignSelf: 'flex-start',
  },
  anonBadgeText: { color: '#4a3f6b', fontSize: 13 },

  submitBtn: {
    backgroundColor: '#9c7fe0', borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
    minHeight: 52, justifyContent: 'center',
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
