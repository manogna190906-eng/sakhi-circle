import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, Modal,
  StyleSheet, Alert, ScrollView,
} from 'react-native';
import { api } from '../api/client';

const REASONS = [
  'Harassment or bullying',
  'Hate speech or discrimination',
  'Harmful or dangerous content',
  'Misinformation',
  'Spam',
  'Sexual content',
  'Threats or violence',
  'Other',
];

interface Props {
  visible: boolean;
  onClose: () => void;
  targetType: 'post' | 'comment' | 'user' | 'message';
  targetId: string;
}

export default function ReportSheet({ visible, onClose, targetType, targetId }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!selected) return;
    setSubmitting(true);
    try {
      const payload: Record<string, string> = { reason: selected };
      if (targetType === 'post')    payload.post_id    = targetId;
      if (targetType === 'comment') payload.comment_id = targetId;
      if (targetType === 'user')    payload.reported_user_id = targetId;
      if (targetType === 'message') payload.message_id = targetId;

      await api.post('/safety/reports', payload);
      onClose();
      Alert.alert('Report submitted', 'Thank you. Our team will review this shortly.');
    } catch {
      Alert.alert('Error', 'Could not submit report. Please try again.');
    } finally {
      setSubmitting(false);
      setSelected(null);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.heading}>Report {targetType}</Text>
        <Text style={styles.subheading}>Why are you reporting this?</Text>
        <ScrollView>
          {REASONS.map((r) => (
            <TouchableOpacity
              key={r}
              style={[styles.option, selected === r && styles.optionSelected]}
              onPress={() => setSelected(r)}
              accessibilityRole="radio"
              accessibilityState={{ selected: selected === r }}
            >
              <View style={[styles.radio, selected === r && styles.radioSelected]} />
              <Text style={styles.optionText}>{r}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <TouchableOpacity
          style={[styles.submitBtn, (!selected || submitting) && styles.submitBtnDisabled]}
          onPress={submit}
          disabled={!selected || submitting}
          accessibilityRole="button"
        >
          <Text style={styles.submitBtnText}>{submitting ? 'Submitting…' : 'Submit Report'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelBtn} onPress={onClose} accessibilityRole="button">
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  sheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 36, maxHeight: '80%',
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: '#e0d8f0', alignSelf: 'center', marginBottom: 16,
  },
  heading: { fontSize: 18, fontWeight: '700', color: '#4a3f6b', marginBottom: 4 },
  subheading: { fontSize: 13, color: '#9c8fc0', marginBottom: 16 },
  option: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14, paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: '#f0ecff',
    minHeight: 48,
  },
  optionSelected: { backgroundColor: '#f8f5ff' },
  radio: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: '#c5b8f0',
  },
  radioSelected: { borderColor: '#9c7fe0', backgroundColor: '#9c7fe0' },
  optionText: { fontSize: 14, color: '#4a3f6b', flex: 1 },
  submitBtn: {
    backgroundColor: '#9c7fe0', borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', marginTop: 16, minHeight: 52,
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  cancelBtn: { paddingVertical: 14, alignItems: 'center', minHeight: 48 },
  cancelBtnText: { color: '#9c8fc0', fontSize: 14 },
});
