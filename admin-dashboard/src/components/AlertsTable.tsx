import React from 'react';

export default function AlertsTable({ alerts }: { alerts: any[] }) {
  const getPill = (level: string) => {
    if (level === 'HIGH_RISK') return <span className="status-pill danger">High Risk</span>;
    return <span className="status-pill warning">Suspicious</span>;
  };

  return (
    <div>
      <div className="card-header" style={{ marginBottom: 12 }}>
        <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>⚠️</span> Recent Security Alerts
        </h3>
        <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
          {alerts.length} threats logged
        </span>
      </div>

      <div className="modern-table-container" style={{ maxHeight: 340, overflowY: 'auto' }}>
        <table className="modern-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Target URL</th>
              <th>Risk Level</th>
              <th style={{ textAlign: 'right' }}>Score</th>
              <th style={{ textAlign: 'right' }}>Rules</th>
            </tr>
          </thead>
          <tbody>
            {alerts.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '24px 0' }}>
                  No high-risk security alerts recorded.
                </td>
              </tr>
            ) : (
              alerts.map(a => (
                <tr key={a.scan_id || Math.random()}>
                  <td style={{ fontSize: 12, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                    {a.timestamp ? new Date(a.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                  </td>
                  <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: 'var(--font-mono)', fontSize: 12.5 }}>
                    {a.url}
                  </td>
                  <td>{getPill(a.risk_level)}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                    {a.fused_score !== undefined ? Number(a.fused_score).toFixed(2) : '—'}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <span className="status-pill neutral" style={{ fontSize: 11 }}>
                      {a.triggered_rules?.length || 0}
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
