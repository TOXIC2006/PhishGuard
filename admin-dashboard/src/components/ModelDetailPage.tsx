import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts';

interface ModelDetailPageProps {
  modelId: string;
  results: any;
  onBack: () => void;
  onCompare: () => void;
}

export default function ModelDetailPage({ modelId, results, onBack, onCompare }: ModelDetailPageProps) {
  const resolvedModelId = (() => {
    if (!modelId) return 'Random Forest';
    let decoded = modelId;
    try {
      decoded = decodeURIComponent(modelId);
    } catch {
      // keep
    }
    const lower = decoded.trim().toLowerCase().replace(/[-_]/g, ' ');
    if (lower.includes('light') || lower.includes('lgb')) return 'LightGBM';
    if (lower.includes('xgb')) return 'XGBoost';
    if (lower.includes('random') || lower.includes('forest') || lower === 'rf') return 'Random Forest';
    return decoded.trim();
  })();

  const modelMeta: Record<string, any> = {
    'LightGBM': {
      name: 'LightGBM Classifier',
      architecture: 'Light Gradient Boosting Machine (LGBMClassifier)',
      library: 'lightgbm>=4.0.0',
      description: 'A tree-based gradient boosting framework that uses histogram-based decision tree algorithms. Calibrated via isotonic regression (5-fold CV) in the PhishGuard pipeline for balanced probability estimation.',
      topFeatures: ['url_entropy', 'path_length', 'hostname_length', 'url_length', 'digit_letter_ratio'],
      bestParams: results?.best_params_lgb || {
        n_estimators: 102,
        learning_rate: 0.2444,
        num_leaves: 16,
        max_depth: -1,
        min_child_samples: 35,
        subsample: 0.6488,
        colsample_bytree: 0.9863,
        reg_alpha: 1.3685,
        reg_lambda: 1.4205
      },
      bestCvF1: results?.best_cv_f1_lgb || 0.8489
    },
    'XGBoost': {
      name: 'XGBoost Classifier',
      architecture: 'Extreme Gradient Boosting (XGBClassifier)',
      library: 'xgboost>=2.1.1',
      description: 'Scalable and regularized gradient tree boosting system. Built with exact depth-wise greedy search, calibrated via isotonic regression, and weighted with scale_pos_weight for high-imbalance phishing detection.',
      topFeatures: ['hostname_length', 'subdomain_count', 'path_length', 'special_char_count', 'digit_count'],
      bestParams: results?.best_params_xgb || {
        n_estimators: 63,
        learning_rate: 0.2543,
        max_depth: 6,
        subsample: 0.7306,
        colsample_bytree: 0.8271,
        gamma: 0.0626,
        reg_lambda: 2.2818,
        min_child_weight: 2
      },
      bestCvF1: results?.best_cv_f1_xgb || 0.8575
    },
    'Random Forest': {
      name: 'Random Forest Classifier',
      architecture: 'Bootstrap Aggregated Decision Forest (RandomForestClassifier)',
      library: 'scikit-learn>=1.5.2',
      description: 'Non-parametric ensemble method that builds multiple decision trees on random data subsets with Gini-impurity splitting. Calibrated using isotonic regression for reliable probability scoring.',
      topFeatures: ['hostname_length', 'subdomain_count', 'path_length', 'hyphen_count', 'digit_letter_ratio'],
      bestParams: results?.best_params_rf || {
        n_estimators: 138,
        min_samples_split: 5,
        min_samples_leaf: 2,
        max_features: 'sqrt',
        max_depth: null,
        class_weight: null
      },
      bestCvF1: results?.best_cv_f1_rf || 0.8752
    }
  };

  const currentMeta = modelMeta[resolvedModelId] || {
    name: resolvedModelId,
    architecture: 'Machine Learning Classifier',
    library: 'Unknown',
    description: 'Model evaluated in PhishGuard.',
    topFeatures: [],
    bestParams: {},
    bestCvF1: null
  };

  const metrics = results?.test_metrics?.[resolvedModelId];

  // Prepare chart data
  const chartMetrics = metrics ? [
    { name: 'Accuracy', value: Number(metrics['Accuracy']) * 100 },
    { name: 'Precision', value: Number(metrics['Precision']) * 100 },
    { name: 'Recall', value: Number(metrics['Recall']) * 100 },
    { name: 'F1-Score', value: Number(metrics['F1-Score']) * 100 },
    { name: 'Specificity', value: Number(metrics['Specificity']) * 100 },
    { name: 'ROC-AUC', value: Number(metrics['ROC-AUC']) * 100 },
    { name: 'PR-AUC', value: Number(metrics['PR-AUC']) * 100 },
  ] : [];

  const overfitGap = metrics && metrics['Train-F1'] && metrics['F1-Score']
    ? (Number(metrics['Train-F1']) - Number(metrics['F1-Score'])).toFixed(4)
    : null;

  return (
    <div>
      {/* Breadcrumbs & Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--color-text-muted)', marginBottom: varSpace4 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--color-teal)', cursor: 'pointer', padding: 0, fontWeight: 500 }}>
          Model Directory
        </button>
        <span>/</span>
        <span style={{ color: 'var(--color-text)', fontWeight: 600 }}>{currentMeta.name}</span>
      </div>

      <div className="card-header" style={{ marginBottom: 'var(--space-6)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-ink)' }}>
              {currentMeta.name}
            </h1>
            <span className="status-pill lime">Verified Evaluation Data</span>
          </div>
          <div style={{ fontSize: 13.5, color: 'var(--color-teal)', fontWeight: 600, marginTop: 4 }}>
            {currentMeta.architecture} · Dependency: <code>{currentMeta.library}</code>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onBack} className="btn-secondary">
            ← Back to Directory
          </button>
          <button onClick={onCompare} className="btn-lime">
            Compare in Workspace →
          </button>
        </div>
      </div>

      {/* Model Description */}
      <div className="surface-card" style={{ marginBottom: 'var(--space-6)' }}>
        <h3 className="card-title" style={{ marginBottom: 6 }}>Overview &amp; Purpose</h3>
        <p style={{ fontSize: 14, color: 'var(--color-text)', lineHeight: 1.6 }}>
          {currentMeta.description}
        </p>
      </div>

      {/* Key Metric Grid */}
      {metrics ? (
        <>
          <div style={{ marginBottom: 'var(--space-6)' }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-ink)', marginBottom: 'var(--space-3)' }}>
              Test Set Evaluation Metrics ({results?.dataset?.test_size ? results.dataset.test_size.toLocaleString() : '47,159'} Samples)
            </h3>
            <div className="grid-4">
              <div className="metric-box">
                <div className="metric-label">F1-Score</div>
                <div className="metric-val lime-tint">{(Number(metrics['F1-Score']) * 100).toFixed(2)}%</div>
                <div className="metric-sub">Harmonic mean of precision &amp; recall</div>
              </div>

              <div className="metric-box">
                <div className="metric-label">Precision</div>
                <div className="metric-val">{(Number(metrics['Precision']) * 100).toFixed(2)}%</div>
                <div className="metric-sub">True Positives / (TP + FP)</div>
              </div>

              <div className="metric-box">
                <div className="metric-label">Recall (Sensitivity)</div>
                <div className="metric-val">{(Number(metrics['Recall']) * 100).toFixed(2)}%</div>
                <div className="metric-sub">True Positives / (TP + FN)</div>
              </div>

              <div className="metric-box">
                <div className="metric-label">ROC-AUC</div>
                <div className="metric-val teal">{Number(metrics['ROC-AUC']).toFixed(4)}</div>
                <div className="metric-sub">Area under Receiver Operating Curve</div>
              </div>

              <div className="metric-box">
                <div className="metric-label">Accuracy</div>
                <div className="metric-val">{(Number(metrics['Accuracy']) * 100).toFixed(2)}%</div>
                <div className="metric-sub">Overall classification correctness</div>
              </div>

              <div className="metric-box">
                <div className="metric-label">Specificity</div>
                <div className="metric-val">{(Number(metrics['Specificity']) * 100).toFixed(2)}%</div>
                <div className="metric-sub">True Negatives / (TN + FP)</div>
              </div>

              <div className="metric-box">
                <div className="metric-label">Matthews Corr (MCC)</div>
                <div className="metric-val">{Number(metrics['MCC']).toFixed(4)}</div>
                <div className="metric-sub">Balanced quality score for imbalanced classes</div>
              </div>

              <div className="metric-box">
                <div className="metric-label">PR-AUC</div>
                <div className="metric-val">{Number(metrics['PR-AUC']).toFixed(4)}</div>
                <div className="metric-sub">Precision-Recall Average Precision</div>
              </div>
            </div>
          </div>

          {/* Performance Visualization & Overfit Gap */}
          <div className="grid-2" style={{ marginBottom: 'var(--space-6)' }}>
            <div className="surface-card">
              <h3 className="card-title">Metric Performance Profile</h3>
              <p className="card-subtitle" style={{ marginBottom: 16 }}>Test metrics scaled 0–100%</p>
              <div style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartMetrics} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#D8E2DF" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64777D' }} interval={0} angle={-20} textAnchor="end" />
                    <YAxis domain={[70, 100]} tick={{ fontSize: 11, fill: '#64777D' }} />
                    <Tooltip
                      formatter={(v: any) => [`${Number(v).toFixed(2)}%`, 'Value']}
                      contentStyle={{ background: '#FFFFFF', border: '1px solid #D8E2DF', borderRadius: 8, fontSize: 12 }}
                    />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {chartMetrics.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.name === 'F1-Score' ? '#B8E63A' : '#0D596B'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="surface-card">
              <h3 className="card-title">Generalization &amp; Overfit Verification</h3>
              <p className="card-subtitle" style={{ marginBottom: 16 }}>Comparison of train vs test F1 performance</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--color-surface-muted)', borderRadius: 8 }}>
                  <span style={{ fontSize: 13.5, color: 'var(--color-text-muted)' }}>Train F1 Score</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>
                    {metrics['Train-F1'] ? Number(metrics['Train-F1']).toFixed(4) : '—'}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--color-surface-muted)', borderRadius: 8 }}>
                  <span style={{ fontSize: 13.5, color: 'var(--color-text-muted)' }}>Test F1 Score (Untouched)</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-success)' }}>
                    {metrics['F1-Score'] ? Number(metrics['F1-Score']).toFixed(4) : '—'}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--color-teal-soft)', borderRadius: 8 }}>
                  <span style={{ fontSize: 13.5, color: 'var(--color-ink)', fontWeight: 600 }}>Train / Test F1 Delta</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-ink)' }}>
                    {overfitGap ? `+${overfitGap}` : '—'}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--color-surface-muted)', borderRadius: 8 }}>
                  <span style={{ fontSize: 13.5, color: 'var(--color-text-muted)' }}>Best Cross-Validation F1</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>
                    {currentMeta.bestCvF1 ? Number(currentMeta.bestCvF1).toFixed(4) : '—'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Hyperparameters & Top Features */}
          <div className="grid-2">
            <div className="surface-card">
              <h3 className="card-title">Optimal Hyperparameters</h3>
              <p className="card-subtitle" style={{ marginBottom: 12 }}>Resolved by RandomizedSearchCV with cross-validation</p>
              {currentMeta.bestParams && Object.keys(currentMeta.bestParams).length > 0 ? (
                <div className="modern-table-container">
                  <table className="modern-table">
                    <thead>
                      <tr><th>Parameter</th><th>Value</th></tr>
                    </thead>
                    <tbody>
                      {Object.entries(currentMeta.bestParams).map(([k, v]) => (
                        <tr key={k}>
                          <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5 }}>{k}</td>
                          <td style={{ fontWeight: 600 }}>
                            {v === null || v === undefined ? (
                              <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>None (unrestricted)</span>
                            ) : typeof v === 'number' ? (
                              (Math.round(v * 10000) / 10000)
                            ) : (
                              String(v)
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Default hyperparameters used.</div>
              )}
            </div>

            <div className="surface-card">
              <h3 className="card-title">Top Diagnostic Features</h3>
              <p className="card-subtitle" style={{ marginBottom: 12 }}>Features contributing highest predictive weight</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {currentMeta.topFeatures.map((feat: string, idx: number) => (
                  <div key={feat} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', border: '1px solid var(--color-border)', borderRadius: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="status-pill neutral" style={{ width: 22, height: 22, justifyContent: 'center', padding: 0 }}>
                        {idx + 1}
                      </span>
                      <code style={{ fontSize: 13, fontWeight: 600 }}>{feat}</code>
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--color-teal)' }}>Lexical Signal</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="surface-card" style={{ textAlign: 'center', padding: 'var(--space-12)' }}>
          <h3 style={{ fontSize: 16, color: 'var(--color-text-muted)', marginBottom: 8 }}>Evaluation Data Pending</h3>
          <p style={{ fontSize: 13.5, color: 'var(--color-text-muted)', marginBottom: 16 }}>
            Run the benchmark pipeline to generate test set performance metrics for this model.
          </p>
          <button onClick={onCompare} className="btn-lime">
            Go to Comparison Workspace
          </button>
        </div>
      )}
    </div>
  );
}

const varSpace4 = 'var(--space-4)';
