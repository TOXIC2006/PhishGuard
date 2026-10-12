import React from 'react';

export default function TopRulesTable({ rules }: { rules: any[] }) {
  return (
    <div>
      <div className="card-header" style={{ marginBottom: 12 }}>
        <h3 className="card-title">Top Triggered Detection Rules</h3>
        <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
          Heuristic frequency
        </span>
      </div>

      <div className="modern-table-container" style={{ maxHeight: 340, overflowY: 'auto' }}>
        <table className="modern-table">
          <thead>
            <tr>
              <th>Rule Identifier</th>
              <th style={{ textAlign: 'right' }}>Trigger Frequency</th>
            </tr>
          </thead>
          <tbody>
            {rules.length === 0 ? (
              <tr>
                <td colSpan={2} style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '24px 0' }}>
                  No rule detections recorded.
                </td>
              </tr>
            ) : (
              rules.map(r => (
                <tr key={r.rule_id}>
                  <td>
                    <code style={{ fontSize: 13, color: 'var(--color-ink)', fontWeight: 600 }}>{r.rule_id}</code>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                    {r.count?.toLocaleString()}
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
