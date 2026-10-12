import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const RISK_COLORS: Record<string, string> = {
  LOW_RISK: '#16794B',
  SUSPICIOUS: '#A96008',
  HIGH_RISK: '#B42332'
};

const RISK_LABELS: Record<string, string> = {
  LOW_RISK: 'Low Risk',
  SUSPICIOUS: 'Suspicious',
  HIGH_RISK: 'High Risk'
};

export default function RiskChart({ stats }: { stats: any }) {
  if (!stats?.risk_distribution) {
    return (
      <div>
        <h3 className="card-title">Risk Distribution</h3>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13, marginTop: 12 }}>
          No risk telemetry data available.
        </p>
      </div>
    );
  }

  const data = Object.entries(stats.risk_distribution).map(([name, value]) => ({
    name: RISK_LABELS[name] || name,
    rawKey: name,
    value: Number(value)
  }));

  const total = data.reduce((acc, cur) => acc + cur.value, 0);

  return (
    <div>
      <div className="card-header" style={{ marginBottom: 12 }}>
        <h3 className="card-title">Threat Classification Ratio</h3>
        <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
          {total.toLocaleString()} evaluated scans
        </span>
      </div>

      <div style={{ height: 320 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={95}
              innerRadius={55}
              paddingAngle={3}
            >
              {data.map((entry) => (
                <Cell
                  key={entry.rawKey}
                  fill={RISK_COLORS[entry.rawKey] || '#64777D'}
                />
              ))}
            </Pie>
            <Tooltip
              formatter={(val: any) => [Number(val).toLocaleString(), 'Count']}
              contentStyle={{ background: '#FFFFFF', border: '1px solid #D8E2DF', borderRadius: 8, fontSize: 12 }}
            />
            <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
