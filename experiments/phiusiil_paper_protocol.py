"""Experiment design of the SHAP/LIME phishing-detection paper, reproduced.

Implements Section III of ``Explainable_Phishing_Detection_Paper02.docx``
so that Tables I and II can be filled with measured values instead of
placeholders:

* dataset     PhiUSIIL table, text columns dropped, phishing = positive class
* split       80/20 stratified, repeated over five random seeds (mean +/- std)
* models      Decision Tree (CART), XGBoost, tabular 1D-CNN
* tuning      5-fold CV on training data only, F1 as the selection criterion
* explanation SHAP (TreeExplainer / integrated gradients) and LIME on one
              shared test sample; agreement via Spearman rho, Kendall tau and
              top-10 overlap
* check       retrain after deleting each model's five most important
              features, to test whether the classes separate too easily

Example:
    python experiments/phiusiil_paper_protocol.py \
        --dataset ml/data/processed/PhiUSIIL_Phishing_URL_Dataset.csv \
        --out experiments/reports/phiusiil_paper_protocol

Writes results.json, table1.csv, table2.csv and run.log into --out.
"""
from __future__ import annotations

import argparse
import json
import os
import platform
import time
from dataclasses import dataclass, field
from typing import Any, Callable, Sequence

import numpy as np
import pandas as pd
import scipy
import shap
import torch
import torch.nn as nn
import torch.nn.functional as F
from lime.lime_tabular import LimeTabularExplainer
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)
from sklearn.model_selection import StratifiedKFold, train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.tree import DecisionTreeClassifier
from xgboost import XGBClassifier

LABEL_POSITIVE_IS_PHISHING: bool = False  # PhiUSIIL encodes 1 = legitimate.
TEXT_COLUMNS = ("FILENAME", "url", "URL", "Domain", "TLD", "Title")
CLASS_NAMES = ["legitimate", "phishing"]


@dataclass(slots=True)
class ProtocolConfig:
    """Every knob of the experiment, overridable from the command line."""

    dataset: str
    out: str
    seeds: tuple[int, ...] = (0, 1, 2, 3, 4)
    test_size: float = 0.20
    cv_folds: int = 5
    tune_rows_trees: int = 30_000
    tune_rows_cnn: int = 8_000
    xgb_rows: int = 120_000
    cnn_epochs: int = 8
    cnn_batch: int = 512
    cnn_lr: float = 1e-3
    cnn_patience: int = 3
    explain_rows: int = 100
    lime_samples: int = 1000
    ig_steps: int = 32
    shap_background: int = 200
    lime_training_rows: int = 2000
    ablate_top: int = 5
    smoke: bool = False

    def resolve(self) -> "ProtocolConfig":
        """Apply the --quick preset so the pipeline can be integration-tested."""
        if not self.smoke:
            return self
        self.seeds = (0, 1)
        self.tune_rows_trees = 2_000
        self.tune_rows_cnn = 1_500
        self.xgb_rows = 2_000
        self.cnn_epochs = 2
        self.explain_rows = 8
        self.lime_samples = 200
        self.shap_background = 25
        self.lime_training_rows = 200
        return self


@dataclass(slots=True)
class TabularCNNParams:
    """Architecture hyperparameters of the tabular 1D-CNN."""

    filters: int = 64
    kernel: int = 3
    dropout: float = 0.3

    def as_dict(self) -> dict[str, Any]:
        return {"filters": self.filters, "kernel": self.kernel, "dropout": self.dropout}


class TabularCNN(nn.Module):
    """1D-CNN over the ordered feature vector, as described in Section III-C.

    Two ReLU convolutions, global pooling, one dropout-regularised dense
    layer and a single logit output.
    """

    def __init__(self, n_features: int, params: TabularCNNParams) -> None:
        super().__init__()
        pad = params.kernel // 2
        self.conv1 = nn.Conv1d(1, params.filters, params.kernel, padding=pad)
        self.conv2 = nn.Conv1d(params.filters, params.filters, params.kernel, padding=pad)
        self.pool = nn.AdaptiveAvgPool1d(1)
        self.dense = nn.Linear(params.filters, 32)
        self.dropout = nn.Dropout(params.dropout)
        self.head = nn.Linear(32, 1)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        h = x.unsqueeze(1)
        h = F.relu(self.conv1(h))
        h = F.relu(self.conv2(h))
        h = self.pool(h).flatten(1)
        h = self.dropout(F.relu(self.dense(h)))
        return self.head(h).squeeze(-1)


def log(msg: str = "") -> None:
    print(msg, flush=True)


def banner(title: str, step: int) -> None:
    bar = "=" * 70
    log(f"\n{bar}\n{step}. {title}\n{bar}")


def load_dataset(path: str) -> tuple[pd.DataFrame, list[str], dict[str, Any]]:
    """Load PhiUSIIL, normalise the label, drop text columns and duplicates."""
    if not os.path.exists(path):
        raise SystemExit(f"Dataset not found: {path}")
    df = pd.read_csv(path, encoding="utf-8-sig")
    if "label" not in df.columns:
        raise SystemExit("Dataset has no 'label' column")

    raw = df["label"].astype("int64")
    n_legit_raw, n_phish_raw = int((raw == 1).sum()), int((raw == 0).sum())
    if LABEL_POSITIVE_IS_PHISHING:
        df["label"] = raw
    else:
        # PhiUSIIL ships 1 = legitimate; the paper counts phishing.
        df["label"] = (raw == 0).astype("int64")

    dropped_text: list[str] = []
    for col in list(df.columns):
        if col == "label":
            continue
        series = pd.to_numeric(df[col], errors="coerce")
        if series.isna().mean() > 0.50 or col in TEXT_COLUMNS:
            dropped_text.append(col)
            df = df.drop(columns=[col])
    features = [c for c in df.columns if c != "label"]

    dupes = int(df.duplicated().sum())
    df = df.drop_duplicates().reset_index(drop=True)
    df = df.dropna(subset=["label"])
    df["label"] = df["label"].astype(int)

    meta = {
        "source_rows": int(raw.shape[0]),
        "legitimate_rows": n_legit_raw,
        "phishing_rows": n_phish_raw,
        "label_convention": "PhiUSIIL 1=legitimate -> flipped, phishing = 1",
        "duplicate_rows_removed": dupes,
        "dropped_non_numeric_columns": dropped_text,
        "rows_used": int(df.shape[0]),
        "phishing_rate": float(df["label"].mean()),
        "missing_cells_in_features": int(df[features].isna().sum().sum()),
    }
    return df, features, meta


def classification_metrics(y_true: np.ndarray, y_pred: np.ndarray) -> dict[str, float]:
    """Phishing-as-positive metrics plus the four confusion-matrix cells."""
    tn, fp, fn, tp = confusion_matrix(y_true, y_pred, labels=[0, 1]).ravel()
    return {
        "Accuracy": float(accuracy_score(y_true, y_pred)),
        "Precision": float(precision_score(y_true, y_pred, zero_division=0)),
        "Recall": float(recall_score(y_true, y_pred, zero_division=0)),
        "F1": float(f1_score(y_true, y_pred, zero_division=0)),
        "TN": int(tn),
        "FP": int(fp),
        "FN": int(fn),
        "TP": int(tp),
    }


def summarise(runs: Sequence[dict[str, float]]) -> dict[str, dict[str, float]]:
    """Return mean and sample standard deviation (ddof=1) per metric."""
    out: dict[str, dict[str, float]] = {}
    keys = ["Accuracy", "Precision", "Recall", "F1", "TN", "FP", "FN", "TP"]
    for key in keys:
        vals = np.array([r[key] for r in runs], dtype=float)
        out[key] = {"mean": float(vals.mean()), "std": float(vals.std(ddof=1)) if len(vals) > 1 else 0.0}
    return out


# --------------------------------------------------------------------- trees
def make_dt(params: dict[str, Any]) -> DecisionTreeClassifier:
    return DecisionTreeClassifier(
        criterion="gini",
        random_state=0,
        max_depth=params["max_depth"],
        min_samples_leaf=params["min_samples_leaf"],
    )


def make_xgb(params: dict[str, Any], seed: int = 0) -> XGBClassifier:
    return XGBClassifier(
        n_estimators=params["n_estimators"],
        max_depth=params["max_depth"],
        learning_rate=params["learning_rate"],
        subsample=0.9,
        colsample_bytree=0.9,
        random_state=seed,
        n_jobs=max(1, min(8, os.cpu_count() or 1)),
        eval_metric="logloss",
        tree_method="hist",
        # XGBoost >= 3.4 defaults this to True, which makes shap's TreeExplainer refuse the model.
        # All features here are numeric, so quantized splits are all we need.
        enable_categorical=False,
    )


def cross_validate(
    builder: Callable[[dict[str, Any]], Any],
    grid: list[dict[str, Any]],
    X: np.ndarray,
    y: np.ndarray,
    folds: int,
    seed: int = 0,
) -> tuple[dict[str, Any], float]:
    """5-fold CV on the tuning sample, F1 (phishing positive) as criterion."""
    skf = StratifiedKFold(n_splits=folds, shuffle=True, random_state=seed)
    best_params, best_f1 = grid[0], -1.0
    for params in grid:
        scores: list[float] = []
        model = builder(params)
        for tr, va in skf.split(X, y):
            model.fit(X[tr], y[tr])
            scores.append(f1_score(y[va], model.predict(X[va]), zero_division=0))
        mean_f1 = float(np.mean(scores))
        if mean_f1 > best_f1:
            best_f1, best_params = mean_f1, params
    return best_params, best_f1


# ----------------------------------------------------------------------- CNN
def train_cnn(
    X_tr: np.ndarray,
    y_tr: np.ndarray,
    params: TabularCNNParams,
    cfg: ProtocolConfig,
    seed: int,
) -> nn.Module:
    """Fit the tabular CNN with early stopping on a validation slice of train."""
    torch.manual_seed(seed)
    np.random.seed(seed)
    X_fit, X_val, y_fit, y_val = train_test_split(
        X_tr, y_tr, test_size=0.1, stratify=y_tr, random_state=seed
    )
    pos_weight = torch.tensor(float((y_fit == 0).sum()) / max(1, int((y_fit == 1).sum())))
    model = TabularCNN(X_tr.shape[1], params)
    optim = torch.optim.Adam(model.parameters(), lr=cfg.cnn_lr)
    loss_fn = nn.BCEWithLogitsLoss(pos_weight=pos_weight)

    fit_t = torch.from_numpy(np.ascontiguousarray(X_fit, dtype=np.float32))
    fit_y = torch.from_numpy(np.ascontiguousarray(y_fit, dtype=np.float32))
    val_t = torch.from_numpy(np.ascontiguousarray(X_val, dtype=np.float32))
    val_y = torch.from_numpy(y_val)

    best_f1, best_state, stale = -1.0, None, 0
    for epoch in range(cfg.cnn_epochs):
        model.train()
        perm = torch.randperm(fit_t.shape[0])
        for start in range(0, fit_t.shape[0], cfg.cnn_batch):
            idx = perm[start : start + cfg.cnn_batch]
            xb, yb = fit_t[idx], fit_y[idx]
            optim.zero_grad()
            loss = loss_fn(model(xb), yb)
            loss.backward()
            optim.step()

        model.eval()
        with torch.no_grad():
            pred = (torch.sigmoid(model(val_t)) >= 0.5).to(torch.int64).numpy()
        f1 = f1_score(val_y, pred, zero_division=0)
        log(f"      cnn epoch {epoch + 1}/{cfg.cnn_epochs} val_f1 {f1:.4f}")
        if f1 > best_f1:
            best_f1, stale = f1, 0
            best_state = {k: v.clone() for k, v in model.state_dict().items()}
        else:
            stale += 1
            if stale >= cfg.cnn_patience:
                break
    if best_state is not None:
        model.load_state_dict(best_state)
    model.eval()
    return model


def cnn_proba(model: nn.Module, X: np.ndarray) -> np.ndarray:
    """Two-column probability matrix, so LIME/SHAP wrappers behave alike."""
    model.eval()
    with torch.no_grad():
        p1 = torch.sigmoid(model(torch.from_numpy(np.ascontiguousarray(X, dtype=np.float32)))).numpy()
    return np.column_stack([1.0 - p1, p1])


def integrated_gradients(
    model: nn.Module, X: np.ndarray, baseline: np.ndarray, steps: int, batch: int = 25
) -> np.ndarray:
    """Gradient-based attributions (Sundararajan et al. path integration)."""
    model.eval()
    out = np.zeros_like(X, dtype=np.float64)
    for start in range(0, X.shape[0], batch):
        x = torch.from_numpy(np.ascontiguousarray(X[start : start + batch], dtype=np.float32))
        b = torch.from_numpy(np.ascontiguousarray(baseline[: x.shape[0]], dtype=np.float32))
        total = torch.zeros_like(x, dtype=torch.float64)
        for k in range(steps):
            alpha = (k + 0.5) / steps
            point = (b + alpha * (x - b)).to(torch.float32).requires_grad_(True)
            (grad,) = torch.autograd.grad(model(point).sum(), point)
            total += grad.to(torch.float64)
        out[start : start + batch] = ((x - b).to(torch.float64) * total / steps).numpy()
    return out


# ------------------------------------------------------------------ LIME/SHAP
def lime_matrix(
    explainer: LimeTabularExplainer,
    predict_fn: Callable[[np.ndarray], np.ndarray],
    X: np.ndarray,
    n_features: int,
    cfg: ProtocolConfig,
) -> np.ndarray:
    """Per-record LIME weights over the full feature set (no truncation)."""
    weights = np.zeros((X.shape[0], n_features))
    for i in range(X.shape[0]):
        exp = explainer.explain_instance(
            X[i],
            predict_fn,
            labels=(1,),
            num_features=n_features,
            num_samples=cfg.lime_samples,
        )
        explanation_map = exp.as_map()
        if 1 in explanation_map:
            for idx, value in explanation_map[1]:
                weights[i, idx] = value
    return weights


def shap_to_matrix(values: Any) -> np.ndarray:
    """Normalise SHAP output to a (records, features) positive-class matrix."""
    if isinstance(values, list):
        values = values[1] if len(values) > 1 else values[0]
    arr = np.asarray(values, dtype=float)
    if arr.ndim == 3:
        arr = arr[:, :, 1]
    return arr


def agreement(shap_mean: np.ndarray, lime_mean: np.ndarray, top_k: int = 10) -> dict[str, float]:
    """Rank-agreement between the two tools on one global feature ranking."""
    rho = float(scipy.stats.spearmanr(shap_mean, lime_mean).statistic)
    tau = float(scipy.stats.kendalltau(shap_mean, lime_mean).statistic)
    a = set(np.argsort(-shap_mean)[:top_k].tolist())
    b = set(np.argsort(-lime_mean)[:top_k].tolist())
    return {
        "Spearman": rho,
        "Kendall": tau,
        "Top10Overlap": len(a & b) / float(top_k),
    }


def ranking(values: np.ndarray) -> np.ndarray:
    return np.abs(values).mean(axis=0)


def top_names(scores: np.ndarray, names: list[str], k: int = 10) -> list[str]:
    order = np.argsort(-scores)[:k]
    return [names[i] for i in order]


# ------------------------------------------------------------------------ main
def run(cfg: ProtocolConfig) -> dict[str, Any]:
    t_start = time.time()
    np.random.seed(0)
    torch.set_num_threads(max(1, os.cpu_count() or 1))
    os.makedirs(cfg.out, exist_ok=True)

    banner("DATASET", 1)
    df, features, meta = load_dataset(cfg.dataset)
    names = list(features)
    log(f"Rows used: {meta['rows_used']:,} | features: {len(names)} | "
        f"phishing rate: {100 * meta['phishing_rate']:.2f}%")
    log(f"Duplicates removed: {meta['duplicate_rows_removed']} | "
        f"missing cells: {meta['missing_cells_in_features']}")
    log(f"Dropped non-identifier columns: {meta['dropped_non_numeric_columns']}")

    X = df[names].to_numpy(dtype=float)
    y = df["label"].to_numpy(dtype=int)

    banner("HYPERPARAMETER SEARCH (5-fold CV on training data only)", 2)
    # One fixed split provides the tuning pool; the 20% test set is never touched.
    X_pool, X_test, y_pool, y_test = train_test_split(
        X, y, test_size=cfg.test_size, stratify=y, random_state=cfg.seeds[0]
    )
    scaler = StandardScaler().fit(X_pool)
    X_pool_s = scaler.transform(X_pool)
    X_test_s = scaler.transform(X_test)

    tree_tune = min(cfg.tune_rows_trees, X_pool.shape[0])
    idx = np.random.choice(X_pool.shape[0], tree_tune, replace=False)
    Xt, yt = X_pool[idx], y_pool[idx]
    dt_grid = [
        {"max_depth": d, "min_samples_leaf": l}
        for d in (16, 24, None)
        for l in (1, 10)
    ]
    t0 = time.time()
    dt_params, dt_cv = cross_validate(make_dt, dt_grid, Xt, yt, cfg.cv_folds)
    log(f"  Decision Tree  best CV F1 {dt_cv:.4f}  params {dt_params}  "
        f"({time.time() - t0:.0f}s)")

    xgb_tune = min(12_000 if cfg.smoke else 20_000, Xt.shape[0])
    Xx, yx = Xt[:xgb_tune], yt[:xgb_tune]
    xgb_grid = [
        {"n_estimators": n, "max_depth": d, "learning_rate": lr}
        for n in (300, 600)
        for d in (6, 9)
        for lr in (0.1, 0.2)
    ]
    t0 = time.time()
    xgb_params, xgb_cv = cross_validate(
        lambda p: make_xgb(p, seed=0), xgb_grid, Xx, yx, cfg.cv_folds
    )
    log(f"  XGBoost        best CV F1 {xgb_cv:.4f}  params {xgb_params}  "
        f"({time.time() - t0:.0f}s)")

    cnn_idx = np.random.choice(X_pool_s.shape[0], min(cfg.tune_rows_cnn, X_pool_s.shape[0]), replace=False)
    Xc, yc = X_pool_s[cnn_idx], y_pool[cnn_idx]
    cnn_grid = [
        TabularCNNParams(filters=f, kernel=k)
        for f in (32, 64)
        for k in (3, 5)
    ]
    t0 = time.time()
    best_cnn, best_cnn_f1 = cnn_grid[0], -1.0
    for params in cnn_grid:
        scores = []
        for tr, va in StratifiedKFold(cfg.cv_folds, shuffle=True, random_state=0).split(Xc, yc):
            model = train_cnn(Xc[tr], yc[tr], params, cfg, seed=0)
            pred = (cnn_proba(model, Xc[va])[:, 1] >= 0.5).astype(int)
            scores.append(f1_score(yc[va], pred, zero_division=0))
        mean_f1 = float(np.mean(scores))
        log(f"    cnn filters={params.filters} kernel={params.kernel} CV F1 {mean_f1:.4f}")
        if mean_f1 > best_cnn_f1:
            best_cnn_f1, best_cnn = mean_f1, params
    log(f"  1D-CNN         best CV F1 {best_cnn_f1:.4f}  params {best_cnn.as_dict()}  "
        f"({time.time() - t0:.0f}s)")

    banner(f"REPEATED EVALUATION OVER {len(cfg.seeds)} SEEDS", 3)
    per_seed: dict[str, list[dict[str, float]]] = {"Decision Tree": [], "XGBoost": [], "1D-CNN": []}
    seed0_models: dict[str, Any] = {}
    seed0_data: dict[str, Any] = {}
    for seed in cfg.seeds:
        Xtr, Xte, ytr, yte = train_test_split(
            X, y, test_size=cfg.test_size, stratify=y, random_state=seed
        )
        sc = StandardScaler().fit(Xtr)
        Xtr_s, Xte_s = sc.transform(Xtr), sc.transform(Xte)
        if Xtr.shape[0] > cfg.xgb_rows:
            sub = np.random.choice(Xtr.shape[0], cfg.xgb_rows, replace=False)
            Xtr_sub, ytr_sub = Xtr[sub], ytr[sub]
        else:
            Xtr_sub, ytr_sub = Xtr, ytr
        log(f"  seed {seed}: train {Xtr.shape[0]:,} test {Xte.shape[0]:,}")

        dt = make_dt(dt_params).fit(Xtr, ytr)
        xgb = make_xgb(xgb_params, seed=seed).fit(Xtr_sub, ytr_sub)
        cnn = train_cnn(Xtr_s, ytr, best_cnn, cfg, seed=seed)

        for name, preds in (
            ("Decision Tree", dt.predict(Xte)),
            ("XGBoost", xgb.predict(Xte)),
            ("1D-CNN", (cnn_proba(cnn, Xte_s)[:, 1] >= 0.5).astype(int)),
        ):
            m = classification_metrics(yte, preds)
            per_seed[name].append(m)
            log(f"    {name:14s} acc {m['Accuracy']:.4f} prec {m['Precision']:.4f} "
                f"rec {m['Recall']:.4f} f1 {m['F1']:.4f}")
        if seed == cfg.seeds[0]:
            seed0_models = {"Decision Tree": dt, "XGBoost": xgb, "1D-CNN": cnn}
            seed0_data = {
                "X_pool": Xtr, "X_pool_s": Xtr_s, "X_test": Xte, "X_test_s": Xte_s,
                "y_pool": ytr, "y_test": yte, "scaler": sc,
            }

    table1 = {name: summarise(runs_) for name, runs_ in per_seed.items()}
    log("\n  mean +/- std over seeds:")
    for name, summary in table1.items():
        log(f"    {name:14s} F1 {summary['F1']['mean']:.4f} +/- {summary['F1']['std']:.4f}"
            f" | Acc {summary['Accuracy']['mean']:.4f} +/- "
            f"{summary['Accuracy']['std']:.4f}")

    banner("SHAP AND LIME AGREEMENT (shared fixed test sample)", 4)
    n_feat = len(names)
    sample_idx = np.random.choice(seed0_data["X_test"].shape[0], cfg.explain_rows, replace=False)
    Xs = seed0_data["X_test"][sample_idx]
    Xs_s = seed0_data["X_test_s"][sample_idx]
    ys = seed0_data["y_test"][sample_idx]
    log(f"  explained records: {Xs.shape[0]} ({int(ys.sum())} phishing / "
        f"{int((ys == 0).sum())} legitimate)")

    bg = seed0_data["X_pool"][: min(cfg.shap_background, seed0_data["X_pool"].shape[0])]
    dt_model = seed0_models["Decision Tree"]
    xgb_model = seed0_models["XGBoost"]
    cnn_model = seed0_models["1D-CNN"]

    shap_dt = shap_to_matrix(shap.TreeExplainer(dt_model, data=bg).shap_values(Xs))
    shap_xgb = shap_to_matrix(shap.TreeExplainer(xgb_model, data=bg).shap_values(Xs))
    baseline = np.tile(seed0_data["X_pool_s"].mean(axis=0), (Xs_s.shape[0], 1))
    shap_cnn = integrated_gradients(cnn_model, Xs_s, baseline, cfg.ig_steps)
    shap_all = {"Decision Tree": shap_dt, "XGBoost": shap_xgb, "1D-CNN": shap_cnn}

    lime_bg = seed0_data["X_pool"][: min(cfg.lime_training_rows, seed0_data["X_pool"].shape[0])]
    lime_bg_s = seed0_data["X_pool_s"][: min(cfg.lime_training_rows, seed0_data["X_pool_s"].shape[0])]
    explainer_raw = LimeTabularExplainer(
        lime_bg, mode="classification", feature_names=names,
        class_names=CLASS_NAMES, discretize_continuous=True, random_state=0,
    )
    explainer_scaled = LimeTabularExplainer(
        lime_bg_s, mode="classification", feature_names=names,
        class_names=CLASS_NAMES, discretize_continuous=True, random_state=0,
    )
    t0 = time.time()
    lime_all = {
        "Decision Tree": lime_matrix(explainer_raw, dt_model.predict_proba, Xs, n_feat, cfg),
        "XGBoost": lime_matrix(explainer_raw, xgb_model.predict_proba, Xs, n_feat, cfg),
        "1D-CNN": lime_matrix(explainer_scaled, lambda Z: cnn_proba(cnn_model, Z), Xs_s, n_feat, cfg),
    }
    log(f"  LIME explanations complete ({time.time() - t0:.0f}s)")

    table2, tops = {}, {}
    for name in per_seed:
        s_rank, l_rank = ranking(shap_all[name]), ranking(lime_all[name])
        table2[name] = agreement(s_rank, l_rank)
        tops[name] = top_names(s_rank, names)
        log(f"  {name:14s} rho {table2[name]['Spearman']:.4f} "
            f"tau {table2[name]['Kendall']:.4f} "
            f"top-10 overlap {table2[name]['Top10Overlap']:.2f}")

    cross = {}
    keys = list(per_seed)
    for i in range(len(keys)):
        for j in range(i + 1, len(keys)):
            a, b = ranking(shap_all[keys[i]]), ranking(shap_all[keys[j]])
            cross[f"{keys[i]} vs {keys[j]}"] = float(scipy.stats.spearmanr(a, b).statistic)
    log("  SHAP ranking agreement between models: "
        + ", ".join(f"{k}={v:.4f}" for k, v in cross.items()))

    banner("FEATURE-REMOVAL CHECK", 5)
    ablation = {}
    for name, rank_source in (("Decision Tree", shap_dt), ("XGBoost", shap_xgb), ("1D-CNN", shap_cnn)):
        drop = set(np.argsort(-ranking(rank_source))[: cfg.ablate_top].tolist())
        keep = [i for i in range(n_feat) if i not in drop]
        Xtr_k = seed0_data["X_pool"][:, keep]
        Xte_k = seed0_data["X_test"][:, keep]
        if name == "Decision Tree":
            pred = make_dt(dt_params).fit(Xtr_k, seed0_data["y_pool"]).predict(Xte_k)
        elif name == "XGBoost":
            pred = make_xgb(xgb_params).fit(Xtr_k, seed0_data["y_pool"]).predict(Xte_k)
        else:
            model = train_cnn(seed0_data["X_pool_s"][:, keep], seed0_data["y_pool"], best_cnn, cfg, 0)
            pred = (cnn_proba(model, seed0_data["X_test_s"][:, keep])[:, 1] >= 0.5).astype(int)
        f1_no = f1_score(seed0_data["y_test"], pred, zero_division=0)
        f1_full = per_seed[name][0]["F1"]
        ablation[name] = {
            "F1_full": float(f1_full),
            "F1_without_top5": float(f1_no),
            "drop": float(f1_full - f1_no),
            "removed_features": [names[i] for i in sorted(drop)],
        }
        log(f"  {name:14s} F1 {f1_full:.4f} -> {f1_no:.4f} after removing top-{cfg.ablate_top}")

    results = {
        "protocol": {
            "models": list(per_seed),
            "seeds": list(cfg.seeds),
            "test_size": cfg.test_size,
            "cv_folds": cfg.cv_folds,
            "positive_class": "phishing",
            "label_note": meta["label_convention"],
            "tuning_note": (
                "5-fold CV on the training pool only, F1 criterion; searched on "
                f"{tree_tune:,} rows for the tree models and "
                f"{Xc.shape[0]:,} rows for the CNN to bound CPU time"
            ),
            "xgb_train_rows": int(Xtr_sub.shape[0]),
            "explainer_sample_rows": int(Xs.shape[0]),
            "shap_backend": "TreeExplainer (exact) + integrated gradients for the CNN",
            "lime_num_samples": cfg.lime_samples,
            "cnn_params": best_cnn.as_dict(),
            "dt_params": dt_params,
            "xgb_params": xgb_params,
            "cv_f1": {"Decision Tree": dt_cv, "XGBoost": xgb_cv, "1D-CNN": best_cnn_f1},
        },
        "dataset": meta,
        "features": {"count": n_feat, "names": names},
        "table1": table1,
        "table2": table2,
        "cross_model_shap_spearman": cross,
        "top_features_shap": tops,
        "ablation_top5": ablation,
        "per_seed_metrics": per_seed,
        "runtime_seconds": round(time.time() - t_start, 1),
        "environment": {
            "python": platform.python_version(),
            "numpy": np.__version__,
            "pandas": pd.__version__,
            "sklearn": __import__("sklearn").__version__,
            "xgboost": __import__("xgboost").__version__,
            "torch": torch.__version__,
            "shap": shap.__version__,
            "lime": __import__("lime").__version__ if hasattr(__import__("lime"), "__version__") else "0.2.0.1",
            "threads": torch.get_num_threads(),
        },
    }

    dest = os.path.join(cfg.out, "results.json")
    with open(dest, "w", encoding="utf-8") as handle:
        json.dump(results, handle, indent=2)
    pd.DataFrame(
        [
            {"Model": m, **{k: f"{v['mean']:.4f} +/- {v['std']:.4f}" for k, v in s.items()}}
            for m, s in table1.items()
        ]
    ).to_csv(os.path.join(cfg.out, "table1.csv"), index=False)
    pd.DataFrame(
        [
            {
                "Model": m,
                "Spearman": s["Spearman"],
                "Kendall": s["Kendall"],
                "Top10Overlap": s["Top10Overlap"],
            }
            for m, s in table2.items()
        ]
    ).to_csv(os.path.join(cfg.out, "table2.csv"), index=False)
    log(f"\nSaved: {dest}")
    log(f"Total wall time: {results['runtime_seconds']:.0f}s")
    log("DONE")
    return results


def parse_args() -> ProtocolConfig:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--dataset", default=os.path.join("ml", "data", "processed", "PhiUSIIL_Phishing_URL_Dataset.csv"))
    parser.add_argument("--out", default=os.path.join("experiments", "reports", "phiusiil_paper_protocol"))
    parser.add_argument("--seeds", type=int, nargs="+", default=[0, 1, 2, 3, 4])
    parser.add_argument("--cv-folds", type=int, default=5)
    parser.add_argument("--xgb-rows", type=int, default=120_000, help="cap on XGBoost training rows")
    parser.add_argument("--cnn-epochs", type=int, default=8)
    parser.add_argument("--explain-rows", type=int, default=100, help="records shared by SHAP and LIME")
    parser.add_argument("--lime-samples", type=int, default=1000, help="perturbations per LIME explanation")
    parser.add_argument("--ablate-top", type=int, default=5)
    parser.add_argument("--smoke", action="store_true", help="tiny preset to validate the pipeline")
    args = parser.parse_args()
    return ProtocolConfig(
        dataset=args.dataset,
        out=args.out,
        seeds=tuple(args.seeds),
        cv_folds=args.cv_folds,
        xgb_rows=args.xgb_rows,
        cnn_epochs=args.cnn_epochs,
        explain_rows=args.explain_rows,
        lime_samples=args.lime_samples,
        ablate_top=args.ablate_top,
        smoke=args.smoke,
    ).resolve()


if __name__ == "__main__":
    run(parse_args())
