import React from 'react';

interface ModelDirectoryProps {
  results: any;
  onSelectModel: (modelId: string) => void;
  onCompare: () => void;
}

export default function ModelDirectory({ results, onSelectModel, onCompare }: ModelDirectoryProps) {
  const models = [
    {
      id: 'LightGBM',
      name: 'LightGBM',
      fullName: 'LightGBM Classifier (Isotonic Calibrated)',
      type: 'Histogram-based Gradient Boosted Trees',
      description: 'Optimized gradient boosting framework that uses tree-based learning algorithms. Fast training speed, high efficiency, and handling of large-scale data with leaf-wise tree growth.',
      metrics: results?.test_metrics?.['LightGBM'],
      bestCvF1: results?.best_cv_f1_lgb || 0.8489,
      bestParams: results?.best_params_lgb || {
        n_estimators: 102,
        learning_rate: 0.2444,
        num_leaves: 16,
        max_depth: -1,
        reg_alpha: 1.3685
      },
      topFeatures: ['url_entropy', 'path_length', 'hostname_length', 'url_length', 'digit_letter_ratio'],
      status: 'Integrated',
      statusClass: 'lime'
    },
    {
      id: 'XGBoost',
      name: 'XGBoost',
      fullName: 'XGBoost Classifier (Isotonic Calibrated)',
      type: 'Scalable Gradient Boosted Decision Trees',
      description: 'Extreme Gradient Boosting implementation with exact greedy tree learning, penalization terms (reg_lambda, gamma), and sub-sampling to control overfitting.',
      metrics: results?.test_metrics?.['XGBoost'],
      bestCvF1: results?.best_cv_f1_xgb || 0.8575,
      bestParams: results?.best_params_xgb || {
        n_estimators: 63,
        learning_rate: 0.2543,
        max_depth: 6,
        reg_lambda: 2.2818
      },
      topFeatures: ['hostname_length', 'subdomain_count', 'path_length', 'special_char_count', 'digit_count'],
      status: 'Production Baseline',
      statusClass: 'success'
    },
    {
      id: 'Random Forest',
      name: 'Random Forest',
      fullName: 'Random Forest Classifier (Isotonic Calibrated)',
      type: 'Bootstrap Aggregated Decision Forest',
      description: 'Ensemble of decision trees trained with bagging and random feature selection per split, maximizing precision with strong resistance to noise.',
      metrics: results?.test_metrics?.['Random Forest'],
      bestCvF1: results?.best_cv_f1_rf || 0.8752,
      bestParams: results?.best_params_rf || {
        n_estimators: 138,
        min_samples_split: 5,
        min_samples_leaf: 2,
        max_features: 'sqrt',
        max_depth: null
      },
      topFeatures: ['hostname_length', 'subdomain_count', 'path_length', 'hyphen_count', 'digit_letter_ratio'],
      status: 'High Precision Baseline',
      statusClass: 'neutral'
    }
  ];

  return (
    <div>
      <div className="card-header" style={{ marginBottom: 'var(--space-6)' }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-ink)' }}>
            Model Directory
          </h2>
          <p className="card-subtitle">
            All machine learning classifiers evaluated in the PhishGuard test pipeline.
          </p>
        </div>
        <button onClick={onCompare} className="btn-lime">
          Open Comparison Workspace →
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        {models.map(m => {
          const met = m.metrics;
          return (
            <div key={m.id} className="surface-card" style={{ transition: 'all 0.2s ease' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text)' }}>
                      {m.fullName}
                    </h3>
                    <span className={`status-pill ${m.statusClass}`}>
                      {m.status}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--color-teal)', fontWeight: 600, marginTop: 2 }}>
                    {m.type}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => onSelectModel(m.id)} className="btn-secondary" style={{ fontSize: 13 }}>
                    View Specifications &amp; Parameters →
                  </button>
                </div>
              </div>

              <p style={{ fontSize: 13.5, color: 'var(--color-text-muted)', marginBottom: 18, maxWidth: 900, lineHeight: 1.6 }}>
                {m.description}
              </p>

              {met ? (
                <div className="grid-4" style={{ marginBottom: 16 }}>
                  <div className="metric-box">
                    <div className="metric-label">F1-Score</div>
                    <div className="metric-val lime-tint">
                      {(Number(met['F1-Score']) * 100).toFixed(2)}%
                    </div>
                    <div className="metric-sub">Harmonic mean P &amp; R</div>
                  </div>

                  <div className="metric-box">
                    <div className="metric-label">ROC-AUC</div>
                    <div className="metric-val teal">
                      {Number(met['ROC-AUC']).toFixed(4)}
                    </div>
                    <div className="metric-sub">Area under ROC curve</div>
                  </div>

                  <div className="metric-box">
                    <div className="metric-label">Precision / Recall</div>
                    <div className="metric-val" style={{ fontSize: 20 }}>
                      {(Number(met['Precision']) * 100).toFixed(1)}% / {(Number(met['Recall']) * 100).toFixed(1)}%
                    </div>
                    <div className="metric-sub">PPV and Sensitivity</div>
                  </div>

                  <div className="metric-box">
                    <div className="metric-label">Best CV F1</div>
                    <div className="metric-val" style={{ fontSize: 20 }}>
                      {m.bestCvF1 ? Number(m.bestCvF1).toFixed(4) : '—'}
                    </div>
                    <div className="metric-sub">Stratified 3/5-Fold CV</div>
                  </div>
                </div>
              ) : (
                <div style={{ padding: 16, background: 'var(--color-surface-muted)', borderRadius: 'var(--radius-md)', fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 16 }}>
                  Evaluation metrics unavailable for this model.
                </div>
              )}

              {m.bestParams && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)' }}>Optimal Parameters:</span>
                  {Object.entries(m.bestParams).slice(0, 5).map(([pk, pv]) => (
                    <span key={pk} className="status-pill neutral" style={{ fontSize: 11.5, padding: '2px 8px' }}>
                      <code style={{ fontSize: 11 }}>{pk}</code>: <strong style={{ marginLeft: 3 }}>{pv === null ? 'None' : typeof pv === 'number' ? (Math.round(pv * 1000) / 1000) : String(pv)}</strong>
                    </span>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTop: '1px solid var(--color-border)', fontSize: 12.5, color: 'var(--color-text-muted)' }}>
                <div>
                  <strong>Top Diagnostic Features:</strong> {m.topFeatures.join(', ')}
                </div>
                <button
                  onClick={() => onSelectModel(m.id)}
                  style={{ background: 'none', border: 'none', color: 'var(--color-teal)', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}
                >
                  Inspect Complete Model Profile →
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
