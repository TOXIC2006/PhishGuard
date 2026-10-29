import React, { useState, useEffect } from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import AppShell, { NavRoute } from './components/AppShell';
import HomePage from './components/HomePage';
import ModelDirectory from './components/ModelDirectory';
import ModelDetailPage from './components/ModelDetailPage';
import ComparisonWorkspace from './components/ComparisonWorkspace';
import DeepLearning from './components/DeepLearning';
import LiveOperations from './components/LiveOperations';
import LoginForm from './components/LoginForm';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Default baseline results from repository benchmark if backend eval endpoint is temporarily offline
const DEFAULT_BASELINE_RESULTS = {
  dataset: {
    file: "ml/data/processed/PhiUSIIL_Phishing_URL_Dataset.csv",
    rows: 235795,
    positive: 134850,
    negative: 100945,
    features: [
      "url_length", "hostname_length", "path_length", "query_length", "dot_count",
      "subdomain_count", "hyphen_count", "digit_count", "special_char_count",
      "has_at_symbol", "has_ip_hostname", "suspicious_token_count", "url_entropy",
      "has_encoding", "has_punycode", "digit_letter_ratio", "path_token_count", "query_param_count"
    ],
    train_size: 188636,
    test_size: 47159
  },
  best_params_rf: {
    class_weight: null,
    max_depth: null,
    max_features: "sqrt",
    min_samples_leaf: 2,
    min_samples_split: 5,
    n_estimators: 138
  },
  best_cv_f1_rf: 0.9742,
  best_params_xgb: {
    colsample_bytree: 0.8282,
    gamma: 1.0417,
    learning_rate: 0.2887,
    max_depth: 7,
    min_child_weight: 5,
    n_estimators: 131,
    reg_lambda: 1.7191,
    subsample: 0.8347
  },
  best_cv_f1_xgb: 0.9920,
  best_params_lgb: {
    colsample_bytree: 0.9863,
    learning_rate: 0.2444,
    max_depth: -1,
    min_child_samples: 35,
    n_estimators: 102,
    num_leaves: 16,
    reg_alpha: 1.3685,
    reg_lambda: 1.4205,
    subsample: 0.6488
  },
  best_cv_f1_lgb: 0.9947,
  test_metrics: {
    "Random Forest": {
      "Accuracy": 0.9756,
      "Precision": 0.9683,
      "Recall": 0.9898,
      "F1-Score": 0.9789,
      "Specificity": 0.9567,
      "Sensitivity": 0.9898,
      "ROC-AUC": 0.9959,
      "MCC": 0.9504,
      "PR-AUC": 0.9959,
      "Train-Accuracy": 0.9774,
      "Train-F1": 0.9804
    },
    "XGBoost": {
      "Accuracy": 0.9930,
      "Precision": 0.9914,
      "Recall": 0.9965,
      "F1-Score": 0.9939,
      "Specificity": 0.9884,
      "Sensitivity": 0.9965,
      "ROC-AUC": 0.9975,
      "MCC": 0.9858,
      "PR-AUC": 0.9966,
      "Train-Accuracy": 0.9933,
      "Train-F1": 0.9941
    },
    "LightGBM": {
      "Accuracy": 0.9944,
      "Precision": 0.9925,
      "Recall": 0.9978,
      "F1-Score": 0.9952,
      "Specificity": 0.9899,
      "Sensitivity": 0.9978,
      "ROC-AUC": 0.9975,
      "MCC": 0.9887,
      "PR-AUC": 0.9963,
      "Train-Accuracy": 0.9948,
      "Train-F1": 0.9955
    }
  },
  plots: ["confusion_matrices.png", "roc_curves.png", "pr_curves.png", "feature_importances.png"]
};

export default function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('admin_token'));
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [currentRoute, setCurrentRoute] = useState<NavRoute>('home');
  const [selectedModelId, setSelectedModelId] = useState<string>('LightGBM');

  // Evaluation & Benchmark state
  const [results, setResults] = useState<any>(DEFAULT_BASELINE_RESULTS);

  // Live Operations state
  const [stats, setStats] = useState<any>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [topRules, setTopRules] = useState<any[]>([]);
  const [health, setHealth] = useState<any>(null);

  const { events, connected } = useWebSocket(token);

  // Helper to normalize model IDs from slugs or URL encoded strings
  const normalizeModelId = (id: string): string => {
    if (!id) return 'Random Forest';
    let decoded = id;
    try {
      decoded = decodeURIComponent(id);
    } catch {
      // keep original
    }
    const lower = decoded.trim().toLowerCase().replace(/[-_]/g, ' ');
    if (lower.includes('light') || lower.includes('lgb')) return 'LightGBM';
    if (lower.includes('xgb')) return 'XGBoost';
    if (lower.includes('random') || lower.includes('forest') || lower === 'rf') return 'Random Forest';
    return decoded.trim();
  };

  // Sync hash routing
  useEffect(() => {
    const handleHashChange = () => {
      let rawHash = window.location.hash.replace('#', '') || 'home';
      try {
        rawHash = decodeURIComponent(rawHash);
      } catch {
        // keep
      }
      if (rawHash.startsWith('models/')) {
        const id = rawHash.replace('models/', '');
        const normalized = normalizeModelId(id);
        setSelectedModelId(normalized);
        setCurrentRoute('model-detail');
      } else if (['home', 'models', 'compare', 'deep-learning', 'live-ops'].includes(rawHash)) {
        setCurrentRoute(rawHash as NavRoute);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    handleHashChange();
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigateTo = (route: NavRoute, modelId?: string) => {
    if (modelId) {
      const normalized = normalizeModelId(modelId);
      setSelectedModelId(normalized);
      window.location.hash = `models/${encodeURIComponent(normalized)}`;
    } else {
      window.location.hash = route;
    }
    setCurrentRoute(route);
  };

  const fetchResults = async (jobId: string | null = null) => {
    try {
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const url = jobId ? `${API_URL}/eval/results?job_id=${jobId}` : `${API_URL}/eval/results`;
      const res = await fetch(url, { headers });
      if (res.ok) {
        const data = await res.json();
        setResults(data);
      }
    } catch {
      // Fallback already set
    }
  };

  const fetchLiveTelemetry = async () => {
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    try {
      const [statsRes, alertsRes, rulesRes, healthRes] = await Promise.all([
        fetch(`${API_URL}/admin/stats`, { headers }),
        fetch(`${API_URL}/admin/alerts?limit=50`, { headers }),
        fetch(`${API_URL}/admin/top-rules?limit=100`, { headers }),
        fetch(`${API_URL}/admin/health`, { headers })
      ]);

      if (statsRes.ok) setStats(await statsRes.json());
      if (alertsRes.ok) setAlerts(await alertsRes.json());
      if (rulesRes.ok) setTopRules(await rulesRes.json());
      if (healthRes.ok) setHealth(await healthRes.json());
    } catch (err) {
      console.warn('Backend telemetry polling failed', err);
    }
  };

  useEffect(() => {
    fetchResults();
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchLiveTelemetry();
      const interval = setInterval(fetchLiveTelemetry, 15000);
      return () => clearInterval(interval);
    }
  }, [token]);

  const handleLogin = (newToken: string) => {
    setToken(newToken);
    localStorage.setItem('admin_token', newToken);
    setShowLoginModal(false);
  };

  const handleLogout = () => {
    setToken(null);
    localStorage.removeItem('admin_token');
  };

  return (
    <AppShell
      currentRoute={currentRoute}
      onRouteChange={(r) => navigateTo(r)}
      connected={connected}
      token={token}
      onLogout={handleLogout}
      onOpenLogin={() => setShowLoginModal(true)}
    >
      {/* Route Views */}
      {currentRoute === 'home' && (
        <HomePage
          results={results}
          onNavigate={(route, id) => navigateTo(route, id)}
        />
      )}

      {currentRoute === 'models' && (
        <ModelDirectory
          results={results}
          onSelectModel={(id) => navigateTo('model-detail', id)}
          onCompare={() => navigateTo('compare')}
        />
      )}

      {currentRoute === 'model-detail' && (
        <ModelDetailPage
          modelId={selectedModelId}
          results={results}
          onBack={() => navigateTo('models')}
          onCompare={() => navigateTo('compare')}
        />
      )}

      {currentRoute === 'compare' && (
        <ComparisonWorkspace
          results={results}
          apiUrl={API_URL}
          token={token}
          onRefreshResults={fetchResults}
        />
      )}

      {currentRoute === 'deep-learning' && (
        <DeepLearning
          apiUrl={API_URL}
          token={token}
          onOpenLogin={() => setShowLoginModal(true)}
        />
      )}

      {currentRoute === 'live-ops' && (
        token ? (
          <LiveOperations
            stats={stats}
            events={events}
            alerts={alerts}
            topRules={topRules}
            health={health}
            connected={connected}
          />
        ) : (
          <div className="surface-card" style={{ textAlign: 'center', padding: 'var(--space-12)' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🛡️</div>
            <h2 style={{ fontSize: 20, color: 'var(--color-ink)', marginBottom: 8 }}>
              Admin Authentication Required
            </h2>
            <p style={{ fontSize: 13.5, color: 'var(--color-text-muted)', maxWidth: 440, margin: '0 auto 20px' }}>
              Real-time scan logs, database alert history, and heuristic rule metrics require active administrator authentication.
            </p>
            <button onClick={() => setShowLoginModal(true)} className="btn-lime">
              Sign In as Admin
            </button>
          </div>
        )
      )}

      {/* Login Modal */}
      {showLoginModal && (
        <LoginForm
          apiUrl={API_URL}
          onLogin={handleLogin}
          onCancel={() => setShowLoginModal(false)}
        />
      )}
    </AppShell>
  );
}
