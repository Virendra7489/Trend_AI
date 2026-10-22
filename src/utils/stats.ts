import { CorrelationItem, AnomalyPoint } from '../types';

/**
 * Calculates linear regression: slope (m), intercept (b), and R-squared coefficient
 */
export function calculateLinearRegression(points: { x: number; y: number }[]): {
  slope: number;
  intercept: number;
  r2: number;
  predict: (x: number) => number;
} {
  const validPoints = (points || []).filter(
    (p) => p && typeof p.x === 'number' && !isNaN(p.x) && typeof p.y === 'number' && !isNaN(p.y)
  );
  const n = validPoints.length;
  if (n < 2) {
    const defaultY = validPoints[0]?.y || 0;
    return {
      slope: 0,
      intercept: defaultY,
      r2: 0,
      predict: () => defaultY,
    };
  }

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;
  let sumY2 = 0;

  for (let i = 0; i < n; i++) {
    const { x, y } = validPoints[i];
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
    sumY2 += y * y;
  }

  const denominator = n * sumX2 - sumX * sumX;
  if (denominator === 0) {
    const meanY = sumY / n;
    return { slope: 0, intercept: meanY, r2: 0, predict: () => meanY };
  }

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;

  // Calculate R-squared
  const meanY = sumY / n;
  let ssTot = 0;
  let ssRes = 0;
  for (let i = 0; i < n; i++) {
    const { x, y } = validPoints[i];
    const yPred = slope * x + intercept;
    ssTot += (y - meanY) ** 2;
    ssRes += (y - yPred) ** 2;
  }
  const r2 = ssTot === 0 ? 1 : Math.max(0, 1 - ssRes / ssTot);

  return {
    slope,
    intercept,
    r2,
    predict: (x: number) => slope * x + intercept,
  };
}

/**
 * Calculates Simple Moving Average for numeric series safely
 */
export function calculateMovingAverage(values: number[], windowSize: number): (number | null)[] {
  if (!Array.isArray(values) || !values.length) return [];
  const result: (number | null)[] = [];
  const safeWindow = Math.max(1, Math.min(windowSize || 7, values.length));

  for (let i = 0; i < values.length; i++) {
    const safeVal = Number(values[i]) || 0;
    if (i < safeWindow - 1) {
      let sum = 0;
      for (let j = 0; j <= i; j++) {
        sum += Number(values[j]) || 0;
      }
      result.push(sum / (i + 1));
    } else {
      let sum = 0;
      for (let j = i - safeWindow + 1; j <= i; j++) {
        sum += Number(values[j]) || 0;
      }
      result.push(sum / safeWindow);
    }
  }

  return result;
}

/**
 * Standard statistics: mean, median, stdDev, min, max without call-stack overflow
 */
export function calculateBasicStats(numbers: number[]) {
  if (!Array.isArray(numbers) || !numbers.length) {
    return { count: 0, mean: 0, median: 0, stdDev: 0, min: 0, max: 0, sum: 0, q1: 0, q3: 0 };
  }

  const cleanNumbers = numbers.filter((n) => typeof n === 'number' && !isNaN(n) && isFinite(n));
  if (!cleanNumbers.length) {
    return { count: 0, mean: 0, median: 0, stdDev: 0, min: 0, max: 0, sum: 0, q1: 0, q3: 0 };
  }

  const sorted = [...cleanNumbers].sort((a, b) => a - b);
  const count = sorted.length;
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  const mean = sum / count;

  let median: number;
  const mid = Math.floor(count / 2);
  if (count % 2 === 0) {
    median = (sorted[mid - 1] + sorted[mid]) / 2;
  } else {
    median = sorted[mid];
  }

  const variance = sorted.reduce((acc, v) => acc + (v - mean) ** 2, 0) / count;
  const stdDev = Math.sqrt(variance);

  return {
    count,
    mean: Number(mean.toFixed(2)),
    median: Number(median.toFixed(2)),
    stdDev: Number(stdDev.toFixed(2)),
    min: sorted[0],
    max: sorted[count - 1],
    sum: Number(sum.toFixed(2)),
    q1: sorted[Math.floor(count * 0.25)] ?? sorted[0],
    q3: sorted[Math.floor(count * 0.75)] ?? sorted[count - 1],
  };
}

/**
 * Detects anomalies using rolling mean and Z-scores
 */
export function detectAnomaliesInSeries(
  data: { x: any; y: number; originalRow: Record<string, any> }[],
  threshold = 2.0
): AnomalyPoint[] {
  if (!Array.isArray(data) || data.length < 5) return [];

  const yValues = data.map((d) => (d && typeof d.y === 'number' ? d.y : 0));
  const { mean, stdDev } = calculateBasicStats(yValues);

  if (stdDev === 0) return [];

  const anomalies: AnomalyPoint[] = [];

  data.forEach((item, index) => {
    if (!item) return;
    const yVal = typeof item.y === 'number' && !isNaN(item.y) ? item.y : 0;
    const zScore = (yVal - mean) / stdDev;
    if (Math.abs(zScore) >= threshold) {
      anomalies.push({
        index,
        xValue: item.x,
        yValue: yVal,
        zScore: Number(zScore.toFixed(2)),
        expectedValue: Number(mean.toFixed(2)),
        row: item.originalRow || {},
      });
    }
  });

  return anomalies;
}

/**
 * Pearson correlation coefficient between two numeric arrays
 */
export function calculatePearsonCorrelation(x: number[], y: number[]): number {
  if (!Array.isArray(x) || !Array.isArray(y)) return 0;
  const n = Math.min(x.length, y.length);
  if (n < 2) return 0;

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;
  let sumY2 = 0;

  for (let i = 0; i < n; i++) {
    const xi = Number(x[i]) || 0;
    const yi = Number(y[i]) || 0;
    sumX += xi;
    sumY += yi;
    sumXY += xi * yi;
    sumX2 += xi * xi;
    sumY2 += yi * yi;
  }

  const numerator = n * sumXY - sumX * sumY;
  const denom = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

  if (denom === 0 || isNaN(denom)) return 0;
  const r = numerator / denom;
  return isNaN(r) ? 0 : Math.max(-1, Math.min(1, r));
}

/**
 * Compute full correlation matrix for all numeric columns safely
 */
export function computeCorrelationMatrix(
  rows: Record<string, any>[],
  numericColumns: string[]
): CorrelationItem[] {
  if (!Array.isArray(rows) || !Array.isArray(numericColumns) || numericColumns.length === 0) {
    return [];
  }
  const correlations: CorrelationItem[] = [];

  for (let i = 0; i < numericColumns.length; i++) {
    const colA = numericColumns[i];
    const valsA = rows.map((r) => (r && r[colA] !== null && r[colA] !== undefined ? Number(r[colA]) || 0 : 0));

    for (let j = i; j < numericColumns.length; j++) {
      const colB = numericColumns[j];
      const valsB = rows.map((r) => (r && r[colB] !== null && r[colB] !== undefined ? Number(r[colB]) || 0 : 0));

      const r = i === j ? 1.0 : calculatePearsonCorrelation(valsA, valsB);
      correlations.push({
        colA,
        colB,
        r: Number(r.toFixed(3)),
      });
    }
  }

  return correlations;
}

/**
 * Creates auto-binned histogram data without stack overflows
 */
export function computeHistogramBins(values: number[], targetBinCount = 12) {
  if (!Array.isArray(values) || !values.length) return [];
  const clean = values.filter((v) => typeof v === 'number' && !isNaN(v) && isFinite(v));
  if (!clean.length) return [];

  let min = clean[0];
  let max = clean[0];
  for (let i = 1; i < clean.length; i++) {
    if (clean[i] < min) min = clean[i];
    if (clean[i] > max) max = clean[i];
  }

  if (min === max) {
    return [{ rangeLabel: `${min}`, count: clean.length, binStart: min, binEnd: max }];
  }

  const binCount = Math.max(5, Math.min(targetBinCount || 12, 25));
  const binWidth = (max - min) / binCount;
  if (binWidth <= 0 || !isFinite(binWidth)) {
    return [{ rangeLabel: `${min}`, count: clean.length, binStart: min, binEnd: max }];
  }

  const bins: { rangeLabel: string; count: number; binStart: number; binEnd: number }[] = [];
  for (let i = 0; i < binCount; i++) {
    const binStart = min + i * binWidth;
    const binEnd = min + (i + 1) * binWidth;
    const label = `${binStart >= 1000 ? (binStart / 1000).toFixed(1) + 'k' : binStart.toFixed(1)} - ${binEnd >= 1000 ? (binEnd / 1000).toFixed(1) + 'k' : binEnd.toFixed(1)}`;
    bins.push({
      rangeLabel: label,
      count: 0,
      binStart,
      binEnd,
    });
  }

  for (const v of clean) {
    let index = Math.floor((v - min) / binWidth);
    if (index >= binCount) index = binCount - 1;
    if (index < 0) index = 0;
    if (bins[index]) {
      bins[index].count++;
    }
  }

  return bins;
}

/**
 * Safe formatter for numbers, currencies, percentages (handles null/undefined column names gracefully)
 */
export function formatDataValue(val: any, colName: string | null | undefined = ''): string {
  if (val === null || val === undefined || Number.isNaN(val)) return '—';
  if (typeof val === 'number') {
    const lowerCol = String(colName || '').toLowerCase();
    const isCurrency =
      lowerCol.includes('sales') ||
      lowerCol.includes('revenue') ||
      lowerCol.includes('mrr') ||
      lowerCol.includes('profit') ||
      lowerCol.includes('cost') ||
      lowerCol.includes('spend') ||
      lowerCol.includes('price');
    const isPercent =
      lowerCol.includes('rate') ||
      lowerCol.includes('pct') ||
      lowerCol.includes('percent') ||
      lowerCol.includes('ctr') ||
      lowerCol.includes('discount') ||
      lowerCol.includes('churn');

    if (isCurrency) {
      if (Math.abs(val) >= 1_000_000) return `$${(val / 1_000_000).toFixed(2)}M`;
      if (Math.abs(val) >= 1_000) return `$${(val / 1_000).toFixed(1)}K`;
      return `$${val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
    }
    if (isPercent) {
      return `${(val > 1 ? val : val * 100).toFixed(1)}%`;
    }
    if (Math.abs(val) >= 1_000_000) return `${(val / 1_000_000).toFixed(2)}M`;
    if (Math.abs(val) >= 1_000) return `${(val / 1_000).toFixed(1)}K`;
    return Number.isInteger(val) ? val.toLocaleString() : val.toFixed(2);
  }
  return String(val);
}

/**
 * Calculates requested percentiles (e.g. 10th, 25th, 50th, 75th, 90th, 99th)
 */
export function calculatePercentiles(numbers: number[], percentiles: number[] = [10, 25, 50, 75, 90, 99]): Record<number, number> {
  const result: Record<number, number> = {};
  if (!Array.isArray(numbers) || !numbers.length) {
    percentiles.forEach((p) => { result[p] = 0; });
    return result;
  }
  const clean = numbers.filter((n) => typeof n === 'number' && !isNaN(n) && isFinite(n));
  if (!clean.length) {
    percentiles.forEach((p) => { result[p] = 0; });
    return result;
  }
  const sorted = [...clean].sort((a, b) => a - b);
  const n = sorted.length;

  for (const p of percentiles) {
    if (p <= 0) {
      result[p] = sorted[0];
    } else if (p >= 100) {
      result[p] = sorted[n - 1];
    } else {
      const rank = (p / 100) * (n - 1);
      const low = Math.floor(rank);
      const high = Math.ceil(rank);
      const weight = rank - low;
      const val = sorted[low] * (1 - weight) + sorted[high] * weight;
      result[p] = Number(val.toFixed(2));
    }
  }
  return result;
}

/**
 * Calculates Fisher-Pearson skewness coefficient
 */
export function calculateSkewness(numbers: number[]): number {
  if (!Array.isArray(numbers) || numbers.length < 3) return 0;
  const clean = numbers.filter((n) => typeof n === 'number' && !isNaN(n) && isFinite(n));
  const n = clean.length;
  if (n < 3) return 0;

  const mean = clean.reduce((a, b) => a + b, 0) / n;
  let m2 = 0;
  let m3 = 0;
  for (let i = 0; i < n; i++) {
    const diff = clean[i] - mean;
    m2 += diff * diff;
    m3 += diff * diff * diff;
  }
  const variance = m2 / n;
  const stdDev = Math.sqrt(variance);
  if (stdDev === 0) return 0;

  const skew = (m3 / n) / Math.pow(stdDev, 3);
  return Number(skew.toFixed(2));
}

/**
 * Generates an executable Streamlit Python script (app.py) reproducing the current dashboard
 */
export function generateStreamlitPythonScript({
  datasetName,
  xAxis,
  yAxis,
  chartType,
  movingAverageWindow,
  anomalyThreshold,
  filterCount,
  sampleRows,
  rawCsv,
}: {
  datasetName: string;
  xAxis: string;
  yAxis: string;
  chartType: string;
  movingAverageWindow: number;
  anomalyThreshold: number;
  filterCount: number;
  sampleRows?: Record<string, any>[];
  rawCsv?: string;
}): string {
  // Prepare safe embedded CSV string
  let embeddedCsvSafe = '';
  if (rawCsv && rawCsv.trim()) {
    // Escape backslashes and triple quotes if any
    embeddedCsvSafe = rawCsv.replace(/\\/g, '\\\\').replace(/"""/g, '\\"\\"\\"').slice(0, 15000);
  } else if (sampleRows && sampleRows.length > 0) {
    const headers = Object.keys(sampleRows[0]);
    const lines = [headers.join(',')];
    sampleRows.slice(0, 50).forEach((r) => {
      const rowLine = headers.map((h) => {
        const v = r[h];
        if (v === null || v === undefined) return '';
        const s = String(v);
        return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
      });
      lines.push(rowLine.join(','));
    });
    embeddedCsvSafe = lines.join('\n').replace(/\\/g, '\\\\').replace(/"""/g, '\\"\\"\\"');
  } else {
    embeddedCsvSafe = 'Date,Metric\n2024-01-01,100\n2024-01-02,120';
  }

  const chartTypeIndex =
    chartType === 'area' ? 1 : chartType === 'bar' ? 2 : chartType === 'scatter' ? 3 : chartType === 'histogram' ? 4 : 0;

  return `# ==============================================================================
# TrendAI - Streamlit Application Generator
# Generated for dataset: ${datasetName}
# ==============================================================================

import streamlit as st
import pandas as pd
import numpy as np
import plotly.express as px
import plotly.graph_objects as go
import io

st.set_page_config(
    page_title="${datasetName} - TrendAI Analyzer",
    page_icon="📈",
    layout="wide",
    initial_sidebar_state="expanded",
)

# Custom Streamlit styling
st.markdown("""
<style>
    .main-title { font-size: 2.1rem; font-weight: 700; color: #0f172a; margin-bottom: 0.2rem; }
    .sub-title { font-size: 0.95rem; color: #64748b; margin-bottom: 1.5rem; }
    div[data-testid="stMetricValue"] { font-size: 1.8rem; font-weight: 700; }
</style>
""", unsafe_allow_html=True)

st.markdown('<div class="main-title">📈 ${datasetName}</div>', unsafe_allow_html=True)
st.markdown('<div class="sub-title">Real-time dynamic trend visualization with moving averages, anomalies, and multi-metric intelligence.</div>', unsafe_allow_html=True)

# 1. Embedded fallback dataset (runs instantly without external files)
CSV_DATA = """${embeddedCsvSafe}"""

@st.cache_data
def load_data():
    uploaded_file = st.sidebar.file_uploader("📂 Upload CSV File", type=["csv"])
    if uploaded_file is not None:
        try:
            return pd.read_csv(uploaded_file)
        except Exception as e:
            st.sidebar.error(f"Error loading uploaded file: {e}")
    try:
        return pd.read_csv("dataset.csv")
    except Exception:
        return pd.read_csv(io.StringIO(CSV_DATA.strip()))

df = load_data()

# Ensure we have valid data
if df.empty:
    st.error("No data available. Please upload a valid CSV file.")
    st.stop()

# 2. Sidebar Dynamic Interactive Filters
st.sidebar.header("🔍 Dynamic Filters")
total_rows = len(df)
st.sidebar.caption(f"Total Records in Dataset: **{total_rows}**")

filtered_df = df.copy()

# Filter by Numeric Ranges
numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
categorical_cols = df.select_dtypes(include=['object', 'category', 'string']).columns.tolist()

if numeric_cols:
    with st.sidebar.expander("Filter by Numeric Range", expanded=True):
        for col in numeric_cols[:4]:
            col_min = float(df[col].dropna().min()) if not df[col].dropna().empty else 0.0
            col_max = float(df[col].dropna().max()) if not df[col].dropna().empty else 1.0
            if col_min < col_max:
                selected_range = st.slider(f"{col}", col_min, col_max, (col_min, col_max))
                filtered_df = filtered_df[
                    (filtered_df[col] >= selected_range[0]) & (filtered_df[col] <= selected_range[1])
                ]

if categorical_cols:
    with st.sidebar.expander("Filter by Categories", expanded=False):
        for col in categorical_cols[:3]:
            unique_vals = df[col].dropna().unique().tolist()
            if 1 < len(unique_vals) <= 30:
                selected = st.multiselect(f"Select {col}", unique_vals, default=unique_vals)
                if selected:
                    filtered_df = filtered_df[filtered_df[col].isin(selected)]

filtered_count = len(filtered_df)
st.sidebar.caption(f"Filtered Records: **{filtered_count}** / {total_rows}")

# Download filtered data directly from sidebar
st.sidebar.download_button(
    label="📥 Download Filtered CSV",
    data=filtered_df.to_csv(index=False).encode('utf-8'),
    file_name="filtered_dataset.csv",
    mime="text/csv",
)

# 3. Axis Selectors & Chart Configuration
st.sidebar.header("⚙️ Visualization Settings")
all_cols = df.columns.tolist()

default_x = "${xAxis}" if "${xAxis}" in all_cols else all_cols[0]
x_axis = st.sidebar.selectbox("X-Axis (Time or Category)", all_cols, index=all_cols.index(default_x) if default_x in all_cols else 0)

default_y = "${yAxis}" if "${yAxis}" in numeric_cols else (numeric_cols[0] if numeric_cols else all_cols[0])
y_axis = st.sidebar.selectbox("Y-Axis (Primary Metric)", numeric_cols if numeric_cols else all_cols, index=numeric_cols.index(default_y) if default_y in numeric_cols else 0)

# 4. Multi-Metric KPI Header
if not filtered_df.empty and y_axis in filtered_df.columns and pd.api.types.is_numeric_dtype(filtered_df[y_axis]):
    s = filtered_df[y_axis].dropna()
    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Visible Records", f"{len(filtered_df):,}", f"{(len(filtered_df)/total_rows)*100:.0f}% of total")
    c2.metric(f"Total {y_axis}", f"{s.sum():,.2f}")
    c3.metric(f"Average {y_axis}", f"{s.mean():,.2f}")
    c4.metric("Std Deviation", f"±{s.std():,.2f}" if len(s) > 1 else "—")
    st.markdown("---")

# 5. Interactive Tabs
tab1, tab2, tab3 = st.tabs(["📊 Interactive Trend Visualizer", "📋 Filtered Data Table", "🔥 Correlation Heatmap"])

with tab1:
    if filtered_df.empty:
        st.warning("⚠️ No records match the selected filters. Please adjust the sidebar controls.")
    else:
        chart_ctrl_col1, chart_ctrl_col2 = st.columns([2, 1])
        with chart_ctrl_col1:
            chart_type = st.radio(
                "Chart Type",
                ["Line", "Area", "Bar", "Scatter", "Histogram"],
                index=${chartTypeIndex},
                horizontal=True,
            )
        with chart_ctrl_col2:
            show_ma = st.checkbox("Show Moving Average (SMA)", value=True)
            show_anomalies = st.checkbox("Detect Anomalies (Z-Score)", value=True)

        if chart_type == "Bar":
            fig = px.bar(
                filtered_df,
                x=x_axis,
                y=y_axis,
                title=f"{y_axis} by {x_axis}",
                color_discrete_sequence=['#ff4b4b'],
                template="plotly_white",
            )
        elif chart_type == "Area":
            fig = px.area(
                filtered_df,
                x=x_axis,
                y=y_axis,
                title=f"{y_axis} by {x_axis}",
                color_discrete_sequence=['#ff4b4b'],
                template="plotly_white",
            )
        elif chart_type == "Scatter":
            fig = px.scatter(
                filtered_df,
                x=x_axis,
                y=y_axis,
                title=f"{y_axis} vs {x_axis}",
                trendline="ols" if pd.api.types.is_numeric_dtype(filtered_df[x_axis]) else None,
                color_discrete_sequence=['#ff4b4b'],
                template="plotly_white",
            )
        elif chart_type == "Histogram":
            fig = px.histogram(
                filtered_df,
                x=y_axis,
                title=f"Frequency Distribution of {y_axis}",
                nbins=24,
                color_discrete_sequence=['#ff4b4b'],
                template="plotly_white",
            )
        else: # Line Chart with SMA and Anomalies
            fig = go.Figure()

            # Main Line
            fig.add_trace(go.Scatter(
                x=filtered_df[x_axis],
                y=filtered_df[y_axis],
                mode='lines+markers',
                name=f"{y_axis}",
                line=dict(color='#ff4b4b', width=2.5),
                marker=dict(size=4),
            ))

            # Moving Average
            if show_ma and pd.api.types.is_numeric_dtype(filtered_df[y_axis]) and len(filtered_df) >= 2:
                max_w = min(30, max(3, len(filtered_df)))
                window = st.slider("SMA Window (periods)", 2, max_w, min(${movingAverageWindow}, max_w))
                ma = filtered_df[y_axis].rolling(window=window, min_periods=1).mean()
                fig.add_trace(go.Scatter(
                    x=filtered_df[x_axis],
                    y=ma,
                    mode='lines',
                    name=f"SMA ({window})",
                    line=dict(color='#f59e0b', width=2, dash='dot'),
                ))

            # Statistical Outlier Detection
            if show_anomalies and pd.api.types.is_numeric_dtype(filtered_df[y_axis]) and len(filtered_df) >= 4:
                z_thresh = st.slider("Anomaly Sensitivity (σ)", 1.5, 3.5, ${anomalyThreshold}, step=0.1)
                series = filtered_df[y_axis].dropna()
                if series.std() > 0:
                    z_scores = (filtered_df[y_axis] - series.mean()).abs() / series.std()
                    anom_df = filtered_df[z_scores >= z_thresh]
                    if not anom_df.empty:
                        fig.add_trace(go.Scatter(
                            x=anom_df[x_axis],
                            y=anom_df[y_axis],
                            mode='markers',
                            name=f"Anomalies (±{z_thresh}σ)",
                            marker=dict(color='#ef4444', size=11, symbol='circle-open', line=dict(width=2.5, color='#dc2626')),
                        ))
                        st.info(f"🚨 Detected **{len(anom_df)}** statistical anomalies exceeding ±{z_thresh}σ deviation.")

        fig.update_layout(
            template="plotly_white",
            height=480,
            margin=dict(l=20, r=20, t=40, b=20),
            legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
        )
        st.plotly_chart(fig, use_container_width=True)

with tab2:
    st.markdown(f"**Showing {len(filtered_df)} records**")
    st.dataframe(filtered_df, use_container_width=True)

with tab3:
    if len(numeric_cols) > 1:
        corr = filtered_df[numeric_cols].corr()
        corr_fig = px.imshow(
            corr,
            text_auto=True,
            aspect="auto",
            color_continuous_scale="RdBu_r",
            title="Pearson Correlation Heatmap",
        )
        st.plotly_chart(corr_fig, use_container_width=True)
    else:
        st.info("At least two numerical columns are required to display a correlation heatmap.")
`;
}

