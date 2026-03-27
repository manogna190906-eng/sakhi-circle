import React, { useEffect, useState } from 'react';
import { ModerationQueueItem } from '../../backend/src/types';

const API = process.env.REACT_APP_API_URL ?? 'http://localhost:3000';

async function apiFetch(path: string, opts?: RequestInit) {
  const token = localStorage.getItem('authToken');
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...opts?.headers },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.status === 204 ? null : res.json();
}

type ActionType = 'approve' | 'remove' | 'warn' | 'suspend' | 'ban';

const ACTION_OPTIONS: { value: ActionType; label: string; color: string }[] = [
  { value: 'approve',  label: 'Approve',  color: '#2e7d32' },
  { value: 'remove',   label: 'Remove',   color: '#c62828' },
  { value: 'warn',     label: 'Warn',     color: '#e65100' },
  { value: 'suspend',  label: 'Suspend',  color: '#6a1b9a' },
  { value: 'ban',      label: 'Ban',      color: '#b71c1c' },
];

export default function AdminModerationPanel() {
  const [items, setItems]       = useState<ModerationQueueItem[]>([]);
  const [metrics, setMetrics]   = useState<Record<string, number>>({});
  const [terms, setTerms]       = useState<string[]>([]);
  const [newTerm, setNewTerm]   = useState('');
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState<'queue' | 'metrics' | 'filter'>('queue');

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [q, m, t] = await Promise.all([
        apiFetch('/safety/admin/queue'),
        apiFetch('/safety/admin/metrics'),
        apiFetch('/safety/admin/filter-terms'),
      ]);
      setItems(q.items);
      setMetrics(m.metrics);
      setTerms(t.terms);
    } catch {}
    setLoading(false);
  }

  async function takeAction(item: ModerationQueueItem, action: ActionType) {
    const reason = window.prompt(`Reason for "${action}" action:`);
    if (!reason) return;
    try {
      await apiFetch('/safety/admin/action', {
        method: 'PUT',
        body: JSON.stringify({ target_type: item.target_type, target_id: item.target_id, action, reason }),
      });
      loadAll();
    } catch { alert('Action failed'); }
  }

  async function addTerm() {
    if (!newTerm.trim()) return;
    await apiFetch('/safety/admin/filter-terms', {
      method: 'POST',
      body: JSON.stringify({ term: newTerm.trim() }),
    });
    setNewTerm('');
    loadAll();
  }

  async function removeTerm(term: string) {
    if (!window.confirm(`Remove "${term}" from filter?`)) return;
    await apiFetch(`/safety/admin/filter-terms/${encodeURIComponent(term)}`, { method: 'DELETE' });
    loadAll();
  }

  if (loading) return <div style={s.loading}>Loading…</div>;

  return (
    <div style={s.container}>
      <h1 style={s.heading}>🛡️ Moderation Dashboard</h1>

      {/* Tab bar */}
      <div style={s.tabs}>
        {(['queue', 'metrics', 'filter'] as const).map((t) => (
          <button key={t} style={{ ...s.tab, ...(tab === t ? s.tabActive : {}) }} onClick={() => setTab(t)}>
            {t === 'queue' ? `📋 Queue (${items.length})` : t === 'metrics' ? '📊 Metrics' : '🚫 Filter'}
          </button>
        ))}
      </div>

      {/* Moderation queue */}
      {tab === 'queue' && (
        <div>
          {items.length === 0 && <p style={s.empty}>No pending reports 🌸</p>}
          {items.map((item: ModerationQueueItem) => (
            <div key={item.report_id} style={{ ...s.card, borderLeft: `4px solid ${item.priority === 'high' ? '#c62828' : '#9c7fe0'}` }}>
              <div style={s.cardHeader}>
                {item.priority === 'high' && <span style={s.highBadge}>🔴 HIGH PRIORITY</span>}
                <span style={s.targetType}>{item.target_type.toUpperCase()}</span>
                {item.ai_risk_score != null && (
                  <span style={{ ...s.aiScore, color: item.ai_risk_score > 0.7 ? '#c62828' : '#e65100' }}>
                    AI risk: {(item.ai_risk_score * 100).toFixed(0)}%
                  </span>
                )}
              </div>
              <p style={s.preview}>{item.target_preview ?? '(no preview)'}</p>
              <p style={s.meta}>
                Reported by: {item.reporter_id.slice(0, 8)}… · Author: {item.author_name ?? 'Unknown'} ·{' '}
                {new Date(item.created_at).toLocaleString()}
              </p>
              <p style={s.reason}>Reason: {item.reason}</p>
              <div style={s.actions}>
                {ACTION_OPTIONS.map((a) => (
                  <button
                    key={a.value}
                    style={{ ...s.actionBtn, backgroundColor: a.color }}
                    onClick={() => takeAction(item, a.value)}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Metrics */}
      {tab === 'metrics' && (
        <div style={s.metricsGrid}>
          {Object.entries(metrics).map(([key, val]) => (
            <div key={key} style={s.metricCard}>
              <div style={s.metricVal}>{val}</div>
              <div style={s.metricLabel}>{key.replace(/_/g, ' ')}</div>
            </div>
          ))}
        </div>
      )}

      {/* Content filter terms */}
      {tab === 'filter' && (
        <div>
          <div style={s.addRow}>
            <input
              style={s.termInput}
              value={newTerm}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewTerm(e.target.value)}
              placeholder="Add prohibited term…"
              onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && addTerm()}
            />
            <button style={s.addBtn} onClick={addTerm}>Add</button>
          </div>
          <div style={s.termsList}>
            {terms.map((t: string) => (
              <div key={t} style={s.termChip}>
                <span>{t}</span>
                <button style={s.removeTermBtn} onClick={() => removeTerm(t)}>✕</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Inline styles (no CSS dependency) ───────────────────────────────────────
const s: Record<string, React.CSSProperties> = {
  container: { maxWidth: 900, margin: '0 auto', padding: 24, fontFamily: 'system-ui, sans-serif', backgroundColor: '#fff' },
  heading: { color: '#4a3f6b', marginBottom: 20 },
  loading: { padding: 40, textAlign: 'center', color: '#9c8fc0' },
  tabs: { display: 'flex', gap: 8, marginBottom: 24 },
  tab: { padding: '10px 20px', borderRadius: 10, border: '1px solid #e0d8f0', background: '#faf9ff', cursor: 'pointer', color: '#4a3f6b', fontWeight: 600 },
  tabActive: { background: '#E6E0F8', borderColor: '#9c7fe0' },
  empty: { textAlign: 'center', color: '#b0a8c8', marginTop: 40 },
  card: { background: '#faf9ff', borderRadius: 12, padding: 16, marginBottom: 12, border: '1px solid #e0d8f0' },
  cardHeader: { display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' },
  highBadge: { background: '#ffe0e0', color: '#c62828', padding: '2px 8px', borderRadius: 6, fontSize: 12, fontWeight: 700 },
  targetType: { background: '#E6E0F8', color: '#4a3f6b', padding: '2px 8px', borderRadius: 6, fontSize: 12, fontWeight: 700 },
  aiScore: { fontSize: 12, fontWeight: 700 },
  preview: { color: '#333', fontSize: 14, margin: '4px 0', lineHeight: 1.5 },
  meta: { color: '#9c8fc0', fontSize: 12, margin: '4px 0' },
  reason: { color: '#7c6fa0', fontSize: 13, margin: '4px 0' },
  actions: { display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 },
  actionBtn: { color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontWeight: 600, fontSize: 13 },
  metricsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 16 },
  metricCard: { background: '#E6E0F8', borderRadius: 14, padding: 20, textAlign: 'center' },
  metricVal: { fontSize: 32, fontWeight: 800, color: '#4a3f6b' },
  metricLabel: { fontSize: 12, color: '#7c6fa0', marginTop: 4, textTransform: 'capitalize' },
  addRow: { display: 'flex', gap: 8, marginBottom: 16 },
  termInput: { flex: 1, padding: '10px 14px', borderRadius: 10, border: '1px solid #e0d8f0', fontSize: 14 },
  addBtn: { background: '#9c7fe0', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', cursor: 'pointer', fontWeight: 700 },
  termsList: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  termChip: { background: '#ffe0e0', borderRadius: 20, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#c62828' },
  removeTermBtn: { background: 'none', border: 'none', cursor: 'pointer', color: '#c62828', fontWeight: 700, padding: 0 },
};
