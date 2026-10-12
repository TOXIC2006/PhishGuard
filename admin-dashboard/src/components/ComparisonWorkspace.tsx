import React, { useState, useEffect, useRef } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';

const ALL_METRICS = [
  'Accuracy',
  'Precision',
  'Recall',
  'F1-Score',
  'Specificity',
  'Sensitivity',
  'ROC-AUC',
  'MCC',
  'PR-AUC'
];

const MODEL_COLORS: Record<string, string> = {
  'Random Forest': '#0D596B',
  'XGBoost': '#2B7A78',
  'LightGBM': '#98D82A'
};

const PLOT_TITLES: Record<string, string> = {
  confusion_matrices: 'Confusion Matrices (Test Set)',
  roc_curves: 'ROC Curves (Test Set)',
  pr_curves: 'Precision-Recall Curves (Test Set)',
  feature_importances: 'Feature Importances by Model',
};

interface ComparisonWorkspaceProps {
  results: any;
  apiUrl: string;
  token: string | null;
  onRefreshResults: (jobId: string | null) => void;
}

export default function ComparisonWorkspace({
  results,
  apiUrl,
  token,
  onRefreshResults
}: ComparisonWorkspaceProps) {
  const [selectedModels, setSelectedModels] = useState<string[]>(['Random Forest', 'XGBoost', 'LightGBM']);
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(['Accuracy', 'Precision', 'Recall', 'F1-Score', 'ROC-AUC']);
  
  // Custom Training Job state
  const [jobs, setJobs] = useState<any[]>([]);
  const [activeJob, setActiveJob] = useState<any>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [quick, setQuick] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [plotUrls, setPlotUrls] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  const availableModels = results?.test_metrics ? Object.keys(results.test_metrics) : ['Random Forest', 'XGBoost', 'LightGBM'];

  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  // Fetch Jobs
  const fetchJobs = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${apiUrl}/eval/jobs`, { headers });
      if (res.ok) setJobs(await res.json());
    } catch { /* ignore */ }
  };

  useEffect(() => {
    fetchJobs();
  }, [token]);

  // Poll running job
  useEffect(() => {
    if (!token) return;
    const running = jobs.find(j => j.status === 'running' || j.status === 'queued');
    if (!running) { setActiveJob(null); return; }
    const poll = async () => {
      try {
        const res = await fetch(`${apiUrl}/eval/jobs/${running.job_id}`, { headers });
        if (!res.ok) return;
        const job = await res.json();
        setActiveJob(job);
        if (job.status === 'done' || job.status === 'failed') {
          fetchJobs();
          if (job.status === 'done') {
            setSelectedJobId(job.job_id);
            onRefreshResults(job.job_id);
            setNotice(`Job ${job.job_id} finished — results loaded.`);
          }
        }
      } catch { /* ignore */ }
    };
    poll();
    const t = setInterval(poll, 5000);
    return () => clearInterval(t);
  }, [jobs, token]);

  // Load plot images
  useEffect(() => {
    if (!results?.plots?.length) { setPlotUrls({}); return; }
    const urls: Record<string, string> = {};
    const created: string[] = [];
    (async () => {
      for (const name of results.plots) {
        try {
          const q = results.job_id ? `?job_id=${results.job_id}` : '';
          const res = await fetch(`${apiUrl}/eval/plots/${name}${q}`, { headers });
          if (res.ok) {
            const objUrl = URL.createObjectURL(await res.blob());
            urls[name.replace('.png', '')] = objUrl;
            created.push(objUrl);
          }
        } catch { /* skip */ }
      }
      setPlotUrls(urls);
    })();
    return () => created.forEach(u => URL.revokeObjectURL(u));
  }, [results, token]);

  const handleUpload = async () => {
    setError(null); setNotice(null);
    if (!token) {
      setError('Admin authentication required to run custom training.');
      return;
    }
    const file = fileRef.current?.files?.[0];
    if (!file) { setError('Choose a CSV file first.'); return; }
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`${apiUrl}/eval/train?quick=${quick}`, { method: 'POST', headers, body: form });
      const data = await res.json();
      if (!res.ok) { setError(data.detail || 'Upload failed'); return; }
      setNotice(`Training started (job ${data.job_id}) on ${data.dataset.rows.toLocaleString()} URLs ` +
        `(${data.dataset.phishing} phishing / ${data.dataset.legitimate} legitimate). This takes 1-2 minutes.`);
      if (fileRef.current) fileRef.current.value = '';
      fetchJobs();
    } catch (e: any) {
      setError('Upload failed: ' + e.message);
    } finally {
      setUploading(false);
    }
  };

  const toggleModel = (model: string) => {
    if (selectedModels.includes(model)) {
      if (selectedModels.length > 1) setSelectedModels(selectedModels.filter(m => m !== model));
    } else {
      setSelectedModels([...selectedModels, model]);
    }
  };

  const toggleMetric = (metric: string) => {
    if (selectedMetrics.includes(metric)) {
      if (selectedMetrics.length > 1) setSelectedMetrics(selectedMetrics.filter(m => m !== metric));
    } else {
      setSelectedMetrics([...selectedMetrics, metric]);
    }
  };

  // Build grouped bar chart data
  const chartData = selectedMetrics.map(metric => {
    const row: Record<string, any> = { metric };
    selectedModels.forEach(model => {
      const val = results?.test_metrics?.[model]?.[metric];
      if (val !== undefined) {
        row[model] = Number((Number(val) * 100).toFixed(2));
      }
    });
    return row;
  });

  return (
    <div>
      <div className="card-header" style={{ marginBottom: 'var(--space-6)' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-ink)' }}>
            Multi-Model Comparison Workspace
          </h1>
          <p className="card-subtitle">
            Side-by-side evaluation across Random Forest, XGBoost, and LightGBM on untouched test data.
          </p>
        </div>
      </div>

      {/* Dataset Context Bar */}
      {results?.dataset && (
        <div className="surface-card" style={{ marginBottom: 'var(--space-6)', background: 'var(--color-surface)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              <div>
                <span style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 600 }}>Dataset Source</span>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-ink)' }}>{results.dataset.file}</div>
              </div>
              <div>
                <span style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 600 }}>Total Rows</span>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-ink)' }}>{results.dataset.rows?.toLocaleString()}</div>
              </div>
              <div>
                <span style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 600 }}>Class Distribution</span>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-ink)' }}>
                  {results.dataset.positive} phishing · {results.dataset.negative} legitimate (33.3:1)
                </div>
              </div>
              <div>
                <span style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 600 }}>Test Evaluation Split</span>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-ink)' }}>
                  {results.dataset.test_size?.toLocaleString()} samples (80:20 Stratified)
                </div>
              </div>
            </div>

            <span className="status-pill lime">Isotonic Calibrated</span>
          </div>
        </div>
      )}

      {/* Controls & Selectors */}
      <div className="surface-card" style={{ marginBottom: 'var(--space-6)' }}>
        <div className="grid-2">
          {/* Model Selector */}
          <div>
            <label style={{ fontSize: 12.5, fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)', display: 'block', marginBottom: 8 }}>
              Select Models to Compare
            </label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {availableModels.map(model => {
                const isSelected = selectedModels.includes(model);
                return (
                  <button
                    key={model}
                    onClick={() => toggleModel(model)}
                    style={{
                      padding: '7px 14px',
                      borderRadius: 'var(--radius-md)',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: isSelected ? `2px solid ${MODEL_COLORS[model] || 'var(--color-teal)'}` : '1px solid var(--color-border)',
                      background: isSelected ? 'var(--color-teal-soft)' : 'var(--color-surface)',
                      color: isSelected ? 'var(--color-ink)' : 'var(--color-text-muted)'
                    }}
                  >
                    {isSelected ? '✓ ' : '+ '}{model}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Metric Selector */}
          <div>
            <label style={{ fontSize: 12.5, fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)', display: 'block', marginBottom: 8 }}>
              Select Metrics
            </label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {ALL_METRICS.map(metric => {
                const isSelected = selectedMetrics.includes(metric);
                return (
                  <button
                    key={metric}
                    onClick={() => toggleMetric(metric)}
                    style={{
                      padding: '5px 10px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: 12,
                      fontWeight: isSelected ? 600 : 500,
                      cursor: 'pointer',
                      border: isSelected ? '1px solid var(--color-teal)' : '1px solid var(--color-border)',
                      background: isSelected ? 'var(--color-ink)' : 'var(--color-surface)',
                      color: isSelected ? '#FFFFFF' : 'var(--color-text-muted)'
                    }}
                  >
                    {metric}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Primary Comparison Chart */}
      <div className="surface-card" style={{ marginBottom: 'var(--space-6)' }}>
        <h3 className="card-title">Comparative Performance (Test Set)</h3>
        <p className="card-subtitle" style={{ marginBottom: 16 }}>Percentage values (0–100%) across active models</p>
        
        <div style={{ height: 320 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 15, right: 20, left: -10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#D8E2DF" vertical={false} />
              <XAxis dataKey="metric" tick={{ fontSize: 12, fill: '#64777D' }} />
              <YAxis domain={[70, 100]} tick={{ fontSize: 12, fill: '#64777D' }} />
              <Tooltip
                formatter={(val: any, name: any) => [`${val}%`, name]}
                contentStyle={{ background: '#FFFFFF', border: '1px solid #D8E2DF', borderRadius: 8, fontSize: 12 }}
              />
              <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: 13 }} />
              {selectedModels.map(model => (
                <Bar
                  key={model}
                  dataKey={model}
                  fill={MODEL_COLORS[model] || '#64777D'}
                  radius={[4, 4, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Comparison Table */}
      <div className="surface-card" style={{ marginBottom: 'var(--space-6)' }}>
        <h3 className="card-title">Side-by-Side Performance Matrix</h3>
        <p className="card-subtitle" style={{ marginBottom: 16 }}>
          Numeric alignment on untouched test set with bold highlighting on best performing classifier
        </p>

        <div className="modern-table-container">
          <table className="modern-table">
            <thead>
              <tr>
                <th style={{ width: '22%' }}>Metric</th>
                {selectedModels.map(m => (
                  <th key={m} style={{ textAlign: 'right', color: MODEL_COLORS[m] || 'inherit' }}>
                    {m}
                  </th>
                ))}
                <th style={{ textAlign: 'center', width: '16%' }}>Best Model</th>
              </tr>
            </thead>
            <tbody>
              {ALL_METRICS.map(m => {
                // Find highest value
                let maxVal = -1;
                let bestModel = '';
                selectedModels.forEach(model => {
                  const val = Number(results?.test_metrics?.[model]?.[m]);
                  if (!isNaN(val) && val > maxVal) {
                    maxVal = val;
                    bestModel = model;
                  }
                });

                return (
                  <tr key={m}>
                    <td style={{ fontWeight: 600 }}>{m}</td>
                    {selectedModels.map(model => {
                      const val = Number(results?.test_metrics?.[model]?.[m]);
                      const isBest = val === maxVal && maxVal > 0;
                      return (
                        <td
                          key={model}
                          style={{
                            textAlign: 'right',
                            fontFamily: 'var(--font-mono)',
                            fontWeight: isBest ? 700 : 400,
                            color: isBest ? 'var(--color-success)' : 'inherit',
                            backgroundColor: isBest ? 'rgba(22, 121, 75, 0.04)' : undefined
                          }}
                        >
                          {!isNaN(val) ? val.toFixed(4) : '—'}
                        </td>
                      );
                    })}
                    <td style={{ textAlign: 'center' }}>
                      <span className="status-pill lime" style={{ fontSize: 11 }}>
                        {bestModel}
                      </span>
                    </td>
                  </tr>
                );
              })}

              {/* Overfit check rows */}
              <tr>
                <td style={{ color: 'var(--color-text-muted)' }}>Train F1 (Overfit check)</td>
                {selectedModels.map(model => {
                  const val = Number(results?.test_metrics?.[model]?.['Train-F1']);
                  return (
                    <td key={model} style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>
                      {!isNaN(val) ? val.toFixed(4) : '—'}
                    </td>
                  );
                })}
                <td style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 12 }}>—</td>
              </tr>
              <tr>
                <td style={{ color: 'var(--color-text-muted)' }}>Train vs Test Gap</td>
                {selectedModels.map(model => {
                  const tr = Number(results?.test_metrics?.[model]?.['Train-F1']);
                  const te = Number(results?.test_metrics?.[model]?.['F1-Score']);
                  const gap = (!isNaN(tr) && !isNaN(te)) ? (tr - te).toFixed(4) : '—';
                  return (
                    <td key={model} style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>
                      {gap !== '—' ? `+${gap}` : '—'}
                    </td>
                  );
                })}
                <td style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 12 }}>—</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Generated Diagnostic Visualizations */}
      {results?.plots?.length > 0 && (
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-ink)', marginBottom: 'var(--space-4)' }}>
            Evaluation Diagnostic Plots
          </h3>
          <div className="grid-2">
            {results.plots.map((name: string) => {
              const key = name.replace('.png', '');
              const url = plotUrls[key];
              return (
                <div className="surface-card" key={name}>
                  <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)', marginBottom: 10 }}>
                    {PLOT_TITLES[key] || key}
                  </h4>
                  {url ? (
                    <img
                      src={url}
                      alt={key}
                      style={{ width: '100%', borderRadius: 8, border: '1px solid var(--color-border)', display: 'block' }}
                    />
                  ) : (
                    <div style={{ padding: '36px 16px', textAlign: 'center', background: 'var(--color-surface-muted)', borderRadius: 8, color: 'var(--color-text-muted)', fontSize: 13 }}>
                      Diagnostic plot is generated via backend API.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Custom Dataset Training Runner */}
      <div className="surface-card" style={{ marginBottom: 'var(--space-6)' }}>
        <h3 className="card-title">Retrain &amp; Benchmark on Custom Dataset</h3>
        <p className="card-subtitle" style={{ marginBottom: 14 }}>
          Upload a CSV containing <code>url</code> and <code>label</code> columns (0 = legitimate, 1 = phishing).
          Re-trains and tunes Random Forest, XGBoost, and LightGBM with automated 80:20 stratified splitting.
        </p>

        <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            style={{ fontSize: 13, color: 'var(--color-text)' }}
          />
          <label style={{ fontSize: 13, color: 'var(--color-text-muted)', display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={quick}
              onChange={e => setQuick(e.target.checked)}
            />
            Quick mode (faster hyperparameter search)
          </label>
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="btn-lime"
          >
            {uploading ? 'Processing…' : 'Start 3-Way Training'}
          </button>
        </div>

        {error && <div style={{ color: 'var(--color-danger)', fontSize: 13, marginTop: 10 }}>⚠ {error}</div>}
        {notice && <div style={{ color: 'var(--color-success)', fontSize: 13, marginTop: 10 }}>✓ {notice}</div>}

        {/* Active Job Status */}
        {activeJob && (activeJob.status === 'running' || activeJob.status === 'queued') && (
          <div style={{ marginTop: 16, padding: 14, borderRadius: 8, background: '#FEF6EC', border: '1px solid #FCD9B3' }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-warning)', marginBottom: 6 }}>
              ● Training in Progress — Job {activeJob.job_id} ({activeJob.status})
            </div>
            {activeJob.log_tail && (
              <pre style={{ background: '#073F50', color: '#F3F8F7', padding: 10, borderRadius: 6, fontSize: 11.5, maxHeight: 150, overflowX: 'auto' }}>
                {activeJob.log_tail}
              </pre>
            )}
          </div>
        )}

        {/* Training Jobs Table */}
        {jobs.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <h4 style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-text)', marginBottom: 8 }}>
              Execution History
            </h4>
            <div className="modern-table-container">
              <table className="modern-table">
                <thead>
                  <tr>
                    <th>Job ID</th>
                    <th>File</th>
                    <th>Rows</th>
                    <th>Status</th>
                    <th>Timestamp</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map(j => (
                    <tr key={j.job_id}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{j.job_id}</td>
                      <td>{j.filename}</td>
                      <td>{j.dataset?.rows?.toLocaleString() || '—'}</td>
                      <td>
                        <span className={`status-pill ${j.status === 'done' ? 'success' : j.status === 'failed' ? 'danger' : 'warning'}`}>
                          {j.status}
                        </span>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                        {new Date(j.created_at).toLocaleString()}
                      </td>
                      <td>
                        {j.status === 'done' && (
                          <button
                            onClick={() => {
                              setSelectedJobId(j.job_id);
                              onRefreshResults(j.job_id);
                            }}
                            className="btn-secondary"
                            style={{ fontSize: 11.5, padding: '4px 10px' }}
                          >
                            {selectedJobId === j.job_id ? 'Active' : 'Load Results'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {selectedJobId && (
              <button
                onClick={() => {
                  setSelectedJobId(null);
                  onRefreshResults(null);
                }}
                className="btn-secondary"
                style={{ marginTop: 12, fontSize: 12 }}
              >
                ← Restore Default Repository Benchmark Results
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
