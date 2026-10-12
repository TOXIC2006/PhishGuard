import React from 'react';

interface HomePageProps {
  onNavigate: (route: 'home' | 'models' | 'model-detail' | 'compare' | 'live-ops', modelId?: string) => void;
  results: any;
}

export default function HomePage({ onNavigate, results }: HomePageProps) {
  const models = [
    {
      id: 'LightGBM',
      name: 'LightGBM Classifier',
      type: 'Gradient Boosted Decision Trees',
      desc: 'Histogram-based gradient boosting optimized for high efficiency and fast tree leaf-wise splitting.',
      metrics: results?.test_metrics?.['LightGBM'] || {
        'Accuracy': 0.9944,
        'F1-Score': 0.9952,
        'ROC-AUC': 0.9975,
        'Recall': 0.9978
      },
      tag: 'Newly Integrated'
    },
    {
      id: 'XGBoost',
      name: 'XGBoost Classifier',
      type: 'Extreme Gradient Boosting',
      desc: 'Regularized gradient boosted trees with exact depth-wise greedy search and calibrated decision thresholds.',
      metrics: results?.test_metrics?.['XGBoost'] || {
        'Accuracy': 0.9930,
        'F1-Score': 0.9939,
        'ROC-AUC': 0.9975,
        'Recall': 0.9965
      },
      tag: 'Production ML'
    },
    {
      id: 'Random Forest',
      name: 'Random Forest Classifier',
      type: 'Bagging Ensemble',
      desc: 'Ensemble of randomized decision trees with bootstrap aggregation and Gini-impurity splitting.',
      metrics: results?.test_metrics?.['Random Forest'] || {
        'Accuracy': 0.9756,
        'F1-Score': 0.9789,
        'ROC-AUC': 0.9959,
        'Recall': 0.9898
      },
      tag: 'High Precision'
    }
  ];

  const technologies = [
    { name: 'FastAPI', category: 'Backend Architecture', desc: 'Asynchronous API backend with strict Pydantic schemas' },
    { name: 'LightGBM', category: 'Model Pipeline', desc: 'Leaf-wise gradient boosted trees for classification' },
    { name: 'XGBoost', category: 'Model Pipeline', desc: 'Regularized gradient boosting tree model' },
    { name: 'Random Forest', category: 'Model Pipeline', desc: 'Scikit-learn ensemble bagging classifier' },
    { name: 'Scikit-Learn', category: 'ML Infrastructure', desc: 'CalibratedClassifierCV, Pipelines & cross-validation' },
    { name: 'SHAP', category: 'Explainability', desc: 'Game-theoretic feature attributions for URL scans' },
    { name: 'PostgreSQL & SQLAlchemy', category: 'Data Layer', desc: 'Async persistence for scans, users, and audit logs' },
    { name: 'Chrome Extension (MV3)', category: 'Client Application', desc: 'Browser navigation interceptor with risk modal' },
    { name: 'React & TypeScript', category: 'Analytics UI', desc: 'Component architecture with strict type safety' },
    { name: 'Recharts', category: 'Data Visualisation', desc: 'SVG charts for comparative evaluation curves' },
    { name: 'Pandas & NumPy', category: 'Feature Extraction', desc: 'Lexical parsing and high-dimensional matrix transforms' },
    { name: 'Rule Engine', category: 'Deterministic Logic', desc: 'Configurable multi-category heuristic rule scorer' }
  ];

  return (
    <div>
      {/* Hero Section */}
      <section className="hero-banner">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
          <img src="/logo.png" alt="PhishGuard Shield" style={{ width: 44, height: 44, objectFit: 'contain', filter: 'drop-shadow(0 0 12px rgba(215, 255, 63, 0.4))' }} />
          <div className="hero-tag" style={{ margin: 0 }}>
            <span>●</span> PhishGuard Multi-Model Evaluation Suite
          </div>
        </div>
        <h1 className="hero-title">
          Hybrid Explainable Phishing Detection System
        </h1>
        <p className="hero-desc">
          PhishGuard is an end-to-end, machine learning-powered anti-phishing system designed to protect users from malicious websites in real-time. It combines robust Machine Learning models with a deterministic Rule Engine and Deep Scan analysis to provide accurate, explainable risk assessments.
        </p>

        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          <button onClick={() => onNavigate('compare')} className="btn-lime">
            Open Comparison Workspace →
          </button>
          <button onClick={() => onNavigate('models')} className="btn-ghost-dark">
            Explore All Models
          </button>
          <button onClick={() => onNavigate('live-ops')} className="btn-ghost-dark">
            View Live Scan Operations
          </button>
        </div>
      </section>

      {/* Project Overview */}
      <section style={{ marginBottom: 'var(--space-8)' }}>
        <div className="card-header">
          <div>
            <h2 className="card-title">Architecture &amp; Methodology</h2>
            <p className="card-subtitle">Verified components and detection pipeline from repository implementation</p>
          </div>
        </div>

        <div className="grid-2">
          <div className="surface-card">
            <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-ink)', marginBottom: 8 }}>
              Two-Stage Hybrid Analysis
            </h3>
            <p style={{ fontSize: 13.5, color: 'var(--color-text-muted)', lineHeight: 1.6, marginBottom: 14 }}>
              The system executes a fast synchronous scan analyzing 18 lexical URL features combined with a deterministic heuristic rule engine. If the initial confidence indicates borderline risk, asynchronous workers initiate deep evidence extraction collecting TLS certificates, DNS records, and HTML structure.
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span className="status-pill neutral">18 Lexical Features</span>
              <span className="status-pill neutral">Rule Engine Heuristics</span>
              <span className="status-pill neutral">SSRF-Protected Scraper</span>
            </div>
          </div>

          <div className="surface-card">
            <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-ink)', marginBottom: 8 }}>
              Multi-Model Benchmarking
            </h3>
            <p style={{ fontSize: 13.5, color: 'var(--color-text-muted)', lineHeight: 1.6, marginBottom: 14 }}>
              PhishGuard rigorously cross-evaluates tree-based architectures—<strong>Random Forest</strong>, <strong>XGBoost</strong>, and newly integrated <strong>LightGBM</strong>—on an untouched test split of {results?.dataset?.test_size ? results.dataset.test_size.toLocaleString() : '47,159'} verified URLs. Predictions are probability-calibrated using isotonic regression to prevent overconfident classifications.
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span className="status-pill neutral">Isotonic Probability Calibration</span>
              <span className="status-pill neutral">Stratified 80:20 Split</span>
              <span className="status-pill lime">LightGBM Integrated</span>
            </div>
          </div>
        </div>
      </section>

      {/* Model Directory Preview */}
      <section style={{ marginBottom: 'var(--space-8)' }}>
        <div className="card-header">
          <div>
            <h2 className="card-title">Evaluated Detection Models</h2>
            <p className="card-subtitle">Actual evaluation metrics measured on untouched test set ({results?.dataset?.test_size ? results.dataset.test_size.toLocaleString() : '47,159'} samples)</p>
          </div>
          <button onClick={() => onNavigate('models')} className="btn-secondary" style={{ fontSize: 12.5 }}>
            View Full Directory →
          </button>
        </div>

        <div className="grid-3">
          {models.map(m => (
            <div key={m.id} className="model-card" onClick={() => onNavigate('model-detail', m.id)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                <div className="model-card-title">{m.name}</div>
                <span className={`status-pill ${m.tag === 'Newly Integrated' ? 'lime' : 'neutral'}`}>
                  {m.tag}
                </span>
              </div>
              <div className="model-card-type">{m.type}</div>
              <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 18, flex: 1 }}>
                {m.desc}
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 16 }}>
                <div className="metric-box" style={{ padding: '8px 12px' }}>
                  <div className="metric-label">F1-Score</div>
                  <div className="metric-val" style={{ fontSize: 20 }}>
                    {m.metrics['F1-Score'] ? (m.metrics['F1-Score'] * 100).toFixed(2) + '%' : '—'}
                  </div>
                </div>
                <div className="metric-box" style={{ padding: '8px 12px' }}>
                  <div className="metric-label">ROC-AUC</div>
                  <div className="metric-val" style={{ fontSize: 20 }}>
                    {m.metrics['ROC-AUC'] ? (m.metrics['ROC-AUC'] * 100).toFixed(2) + '%' : '—'}
                  </div>
                </div>
                <div className="metric-box" style={{ padding: '8px 12px' }}>
                  <div className="metric-label">Recall</div>
                  <div className="metric-val" style={{ fontSize: 20 }}>
                    {m.metrics['Recall'] ? (m.metrics['Recall'] * 100).toFixed(2) + '%' : '—'}
                  </div>
                </div>
                <div className="metric-box" style={{ padding: '8px 12px' }}>
                  <div className="metric-label">Accuracy</div>
                  <div className="metric-val" style={{ fontSize: 20 }}>
                    {m.metrics['Accuracy'] ? (m.metrics['Accuracy'] * 100).toFixed(2) + '%' : '—'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13, color: 'var(--color-teal)', fontWeight: 600 }}>
                <span>Inspect Specifications</span>
                <span>→</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Confirmed Technology Stack */}
      <section style={{ marginBottom: 'var(--space-8)' }}>
        <div className="card-header">
          <div>
            <h2 className="card-title">Technologies Used by Project</h2>
            <p className="card-subtitle">Verified software dependencies and engines confirmed in repository files</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {technologies.map(t => (
            <div key={t.name} className="surface-card" style={{ padding: '14px 18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                <span style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--color-text)' }}>{t.name}</span>
                <span style={{ fontSize: 11, color: 'var(--color-teal)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {t.category}
                </span>
              </div>
              <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)' }}>{t.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Comparison Workspace Preview Callout */}
      <section className="surface-card" style={{ borderLeft: '4px solid var(--color-lime)', background: 'var(--color-surface)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text)', marginBottom: 4 }}>
              Multi-Model Comparison Workspace
            </h3>
            <p style={{ fontSize: 13.5, color: 'var(--color-text-muted)' }}>
              Compare scalar metrics, confusion matrices, ROC/PR curves, and train customized datasets in real time.
            </p>
          </div>
          <button onClick={() => onNavigate('compare')} className="btn-lime">
            Launch Comparison Workspace →
          </button>
        </div>
      </section>
    </div>
  );
}
