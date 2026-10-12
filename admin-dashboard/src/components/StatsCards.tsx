import React from 'react';

export default function StatsCards({ stats }: { stats: any }) {
  if (!stats) return null;

  const cards = [
    { label: 'Total Scans', value: stats.total_scans?.toLocaleString(), sub: 'All-time volume', color: 'var(--color-ink)' },
    { label: 'Today', value: stats.today_scans?.toLocaleString(), sub: 'Since 00:00 UTC', color: 'var(--color-teal)' },
    { label: 'This Week', value: stats.week_scans?.toLocaleString(), sub: 'Past 7 days', color: 'var(--color-teal)' },
    { label: 'Active Users', value: stats.active_users, sub: 'Registered analysts', color: 'var(--color-success)' },
    { label: 'Avg ML Score', value: stats.avg_ml_probability !== undefined ? stats.avg_ml_probability?.toFixed(3) : '—', sub: 'Calibrated ML prob', color: 'var(--color-text)' },
    { label: 'Avg Fused Score', value: stats.avg_fused_score !== undefined ? stats.avg_fused_score?.toFixed(3) : '—', sub: 'Hybrid risk score', color: 'var(--color-warning)' },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-4)' }}>
      {cards.map(c => (
        <div className="metric-box" key={c.label}>
          <div className="metric-label">{c.label}</div>
          <div className="metric-val" style={{ color: c.color, fontSize: 24 }}>{c.value ?? '—'}</div>
          <div className="metric-sub">{c.sub}</div>
        </div>
      ))}
    </div>
  );
}
