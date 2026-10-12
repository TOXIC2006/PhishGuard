import React, { useEffect, useState } from 'react';

export default function SystemHealth({ health }: { health: any }) {
  const [modelInfo, setModelInfo] = useState<any>(null);

  useEffect(() => {
    const fetchModel = async () => {
      try {
        const base = import.meta.env.VITE_API_URL || 'http://localhost:8000';
        const res = await fetch(`${base}/model`);
        if (res.ok) setModelInfo(await res.json());
      } catch (e) {
        console.error("Failed to fetch model info", e);
      }
    };
    fetchModel();
  }, []);

  const items = [
    { label: 'FastAPI Backend', ok: health ? health.api === 'ok' : true },
    { label: 'Database (PostgreSQL)', ok: health ? health.database === 'ok' : true },
    { label: 'ML Prediction Pipeline', ok: health ? health.ml_model_loaded : true },
    { label: 'Deterministic Rule Engine', ok: health ? health.rule_engine_loaded : true },
    { label: 'SHAP Explainer Service', ok: health ? health.explainer_loaded : true },
  ];

  return (
    <div>
      <div className="card-header" style={{ marginBottom: 16 }}>
        <h3 className="card-title">System Infrastructure &amp; Active Engines</h3>
        <span className="status-pill success">Operational</span>
      </div>
      
      <div className="grid-2">
        <div>
          <h4 style={{ fontSize: 13, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 12 }}>
            Component Subsystems
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {items.map(i => (
              <div key={i.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--color-surface-muted)', borderRadius: 8 }}>
                <span style={{ fontSize: 13.5, fontWeight: 500 }}>{i.label}</span>
                <span className={`status-pill ${i.ok ? 'success' : 'danger'}`}>
                  {i.ok ? 'Online' : 'Offline'}
                </span>
              </div>
            ))}
          </div>
        </div>
        
        <div>
          <h4 style={{ fontSize: 13, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 12 }}>
            Production Model Configuration
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--color-surface-muted)', borderRadius: 8 }}>
              <span style={{ fontSize: 13.5, color: 'var(--color-text-muted)' }}>Serving Model:</span>
              <span style={{ fontSize: 13.5, fontWeight: 600 }}>{modelInfo?.model_name || 'XGBoost (Calibrated)'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--color-surface-muted)', borderRadius: 8 }}>
              <span style={{ fontSize: 13.5, color: 'var(--color-text-muted)' }}>Artifact Version:</span>
              <span style={{ fontSize: 13.5, fontFamily: 'var(--font-mono)' }}>{modelInfo?.model_version || 'xgboost_v1.0'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--color-surface-muted)', borderRadius: 8 }}>
              <span style={{ fontSize: 13.5, color: 'var(--color-text-muted)' }}>Fusion Strategy:</span>
              <span style={{ fontSize: 13.5, fontWeight: 600 }}>{modelInfo?.fusion_strategy || 'weighted_sum (0.6 / 0.4)'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--color-surface-muted)', borderRadius: 8 }}>
              <span style={{ fontSize: 13.5, color: 'var(--color-text-muted)' }}>Rules Heuristic Version:</span>
              <span style={{ fontSize: 13.5, fontWeight: 600 }}>v{modelInfo?.rule_config_version || '1.0'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
