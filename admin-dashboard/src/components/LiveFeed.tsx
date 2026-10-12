import React from 'react';

export default function LiveFeed({ events }: { events: any[] }) {
  const getPill = (level: string) => {
    if (level === 'HIGH_RISK') return <span className="status-pill danger">High Risk</span>;
    if (level === 'SUSPICIOUS') return <span className="status-pill warning">Suspicious</span>;
    return <span className="status-pill success">Low Risk</span>;
  };

  return (
    <div>
      <div className="card-header" style={{ marginBottom: 12 }}>
        <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="live-dot" />
          Live Scan Feed
        </h3>
        <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
          {events.length} event{events.length === 1 ? '' : 's'} buffered
        </span>
      </div>

      <div className="modern-table-container" style={{ maxHeight: 360, overflowY: 'auto' }}>
        <table className="modern-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Domain</th>
              <th>Classification</th>
              <th style={{ textAlign: 'right' }}>Fused Score</th>
              <th>Stage</th>
            </tr>
          </thead>
          <tbody>
            {events.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '24px 0' }}>
                  Awaiting browser extension navigation events...
                </td>
              </tr>
            ) : (
              events.map(e => (
                <tr key={e.scan_id || Math.random()}>
                  <td style={{ fontSize: 12, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                    {new Date(e.timestamp).toLocaleTimeString()}
                  </td>
                  <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 600 }}>
                    {e.domain}
                  </td>
                  <td>{getPill(e.risk_level)}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                    {e.fused_score !== undefined ? Number(e.fused_score).toFixed(3) : '—'}
                  </td>
                  <td>
                    <span className="status-pill neutral" style={{ fontSize: 11 }}>
                      {e.stage}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
