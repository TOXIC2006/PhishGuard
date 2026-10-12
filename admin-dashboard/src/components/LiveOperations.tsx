import React from 'react';
import StatsCards from './StatsCards';
import LiveFeed from './LiveFeed';
import RiskChart from './RiskChart';
import TopRulesTable from './TopRulesTable';
import AlertsTable from './AlertsTable';
import SystemHealth from './SystemHealth';

interface LiveOperationsProps {
  stats: any;
  events: any[];
  alerts: any[];
  topRules: any[];
  health: any;
  connected: boolean;
}

export default function LiveOperations({
  stats,
  events,
  alerts,
  topRules,
  health,
  connected
}: LiveOperationsProps) {
  return (
    <div>
      <div className="card-header" style={{ marginBottom: 'var(--space-6)' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-ink)' }}>
            Live Threat Operations &amp; Telemetry
          </h1>
          <p className="card-subtitle">
            Real-time WebSocket telemetry, scan traffic analytics, and active rule heuristics.
          </p>
        </div>
        <div className="live-indicator">
          <span className="live-dot" style={{ backgroundColor: connected ? 'var(--color-success)' : 'var(--color-warning)' }} />
          {connected ? 'WebSocket Stream Connected' : 'Reconnecting to Stream...'}
        </div>
      </div>

      {/* Aggregate Stats Cards */}
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <StatsCards stats={stats} />
      </div>

      {/* Live Feed & Risk Distribution */}
      <div className="grid-2" style={{ marginBottom: 'var(--space-6)' }}>
        <div className="surface-card">
          <LiveFeed events={events} />
        </div>
        <div className="surface-card">
          <RiskChart stats={stats} />
        </div>
      </div>

      {/* Alerts and Top Rules */}
      <div className="grid-2" style={{ marginBottom: 'var(--space-6)' }}>
        <div className="surface-card">
          <AlertsTable alerts={alerts} />
        </div>
        <div className="surface-card">
          <TopRulesTable rules={topRules} />
        </div>
      </div>

      {/* System Health */}
      <div className="surface-card">
        <SystemHealth health={health} />
      </div>
    </div>
  );
}
