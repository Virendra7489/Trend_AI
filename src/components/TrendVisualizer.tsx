import React, { useMemo, useState, useRef, useEffect } from 'react';
import { ChartConfig, ChartType, AggregationType, ColumnMeta } from '../types';
import {
  calculateLinearRegression,
  calculateMovingAverage,
  detectAnomaliesInSeries,
  computeHistogramBins,
  calculatePearsonCorrelation,
  calculateBasicStats,
  formatDataValue,
} from '../utils/stats';
import {
  TrendingUp,
  BarChart3,
  ScatterChart,
  AreaChart,
  Sliders,
  AlertTriangle,
  Download,
  Info,
  Maximize2,
  Calendar,
  Sparkles,
  Loader2,
  ChevronDown,
  ChevronUp,
  X,
  Zap,
} from 'lucide-react';
import { AnomalyPoint } from '../types';

function safeArrayMin(arr: number[], defaultVal = 0): number {
  if (!arr.length) return defaultVal;
  let min = defaultVal;
  let found = false;
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i];
    if (typeof v === 'number' && !isNaN(v) && isFinite(v)) {
      if (!found || v < min) {
        min = v;
        found = true;
      }
    }
  }
  return found ? min : defaultVal;
}

function safeArrayMax(arr: number[], defaultVal = 100): number {
  if (!arr.length) return defaultVal;
  let max = defaultVal;
  let found = false;
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i];
    if (typeof v === 'number' && !isNaN(v) && isFinite(v)) {
      if (!found || v > max) {
        max = v;
        found = true;
      }
    }
  }
  return found ? max : defaultVal;
}

interface TrendVisualizerProps {
  rows: Record<string, any>[];
  columns: ColumnMeta[];
  config: ChartConfig;
  onConfigChange: (newConfig: Partial<ChartConfig>) => void;
}

export const TrendVisualizer: React.FC<TrendVisualizerProps> = ({
  rows,
  columns,
  config,
  onConfigChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [hoverCoords, setHoverCoords] = useState<{ x: number; y: number } | null>(null);
  const [selectedAnomaly, setSelectedAnomaly] = useState<AnomalyPoint | null>(null);
  const [anomalyDiagnosis, setAnomalyDiagnosis] = useState<string | null>(null);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [diagnosisError, setDiagnosisError] = useState<string | null>(null);
  const [isAnomalyInspectorOpen, setIsAnomalyInspectorOpen] = useState(true);

  // Fallback safe axes if dataset changed
  const effectiveXAxis = useMemo(() => {
    if (config.xAxis && columns.some((c) => c.name === config.xAxis)) return config.xAxis;
    const dateCol = columns.find((c) => c.type === 'date');
    return dateCol ? dateCol.name : columns[0]?.name || '';
  }, [config.xAxis, columns]);

  const effectiveYAxis = useMemo(() => {
    if (config.yAxis && columns.some((c) => c.name === config.yAxis)) return config.yAxis;
    const numCol = columns.find((c) => c.type === 'number');
    return numCol ? numCol.name : columns[1]?.name || columns[0]?.name || '';
  }, [config.yAxis, columns]);

  // Reset hover state when dataset or axes change
  useEffect(() => {
    setHoverIndex(null);
    setHoverCoords(null);
    setSelectedAnomaly(null);
    setAnomalyDiagnosis(null);
  }, [rows, effectiveXAxis, effectiveYAxis]);

  // Group columns by type
  const numericCols = useMemo(() => columns.filter((c) => c.type === 'number'), [columns]);
  const dateCols = useMemo(() => columns.filter((c) => c.type === 'date'), [columns]);
  const categoricalCols = useMemo(() => columns.filter((c) => c.type === 'string'), [columns]);

  // Prepared processed chart points
  const chartData = useMemo(() => {
    if (!rows.length || !effectiveXAxis || !effectiveYAxis) return [];

    // Filter valid rows
    const validRows = rows.filter((r) => r[effectiveXAxis] !== null && r[effectiveYAxis] !== null);

    // If grouping is active and chart is Bar, aggregate
    if (config.type === 'bar' && config.aggregation !== 'none') {
      const groups: Record<string, number[]> = {};
      validRows.forEach((r) => {
        const key = String(r[effectiveXAxis]);
        const val = Number(r[effectiveYAxis]) || 0;
        if (!groups[key]) groups[key] = [];
        groups[key].push(val);
      });

      return Object.entries(groups).map(([xKey, vals]) => {
        let aggVal = 0;
        if (config.aggregation === 'sum') aggVal = vals.reduce((a, b) => a + b, 0);
        else if (config.aggregation === 'mean') aggVal = vals.reduce((a, b) => a + b, 0) / vals.length;
        else if (config.aggregation === 'count') aggVal = vals.length;
        else if (config.aggregation === 'min') aggVal = safeArrayMin(vals, 0);
        else if (config.aggregation === 'max') aggVal = safeArrayMax(vals, 0);
        else if (config.aggregation === 'median') {
          const sorted = [...vals].sort((a, b) => a - b);
          aggVal = sorted[Math.floor(sorted.length / 2)] || 0;
        }

        return {
          x: xKey,
          y: aggVal,
          originalRow: { [effectiveXAxis]: xKey, [effectiveYAxis]: aggVal },
          rawValues: vals,
        };
      });
    }

    // Default chronological or sequential series
    return validRows.map((r, idx) => ({
      x: r[effectiveXAxis],
      y: Number(r[effectiveYAxis]) || 0,
      originalRow: r,
      index: idx,
    }));
  }, [rows, effectiveXAxis, effectiveYAxis, config.type, config.aggregation]);

  // Statistical calculations
  const yValues = useMemo(() => chartData.map((d) => d.y), [chartData]);
  const stats = useMemo(() => calculateBasicStats(yValues), [yValues]);

  // Moving average
  const movingAverages = useMemo(() => {
    if (!config.showMovingAverage || chartData.length < 2) return [];
    return calculateMovingAverage(yValues, config.movingAverageWindow);
  }, [yValues, config.showMovingAverage, config.movingAverageWindow]);

  // Linear regression trendline
  const regression = useMemo(() => {
    if (!config.showTrendline || chartData.length < 2) return null;
    const points = chartData.map((d, i) => ({ x: i, y: d.y }));
    return calculateLinearRegression(points);
  }, [chartData, config.showTrendline]);

  // Anomalies
  const anomalies = useMemo(() => {
    if (!config.detectAnomalies || chartData.length < 5) return [];
    return detectAnomaliesInSeries(chartData, config.anomalyThreshold);
  }, [chartData, config.detectAnomalies, config.anomalyThreshold]);

  const anomalyIndexSet = useMemo(() => new Set(anomalies.map((a) => a.index)), [anomalies]);

  const handleDiagnoseAnomaly = async (anom: AnomalyPoint) => {
    setSelectedAnomaly(anom);
    setIsDiagnosing(true);
    setAnomalyDiagnosis(null);
    setDiagnosisError(null);

    try {
      const surrounding = rows.slice(
        Math.max(0, anom.index - 2),
        Math.min(rows.length, anom.index + 3)
      );

      const res = await fetch('/api/ai/explain-anomaly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          anomaly: anom,
          targetColumn: effectiveYAxis,
          timeColumn: effectiveXAxis,
          summaryStats: {
            rowCount: rows.length,
            numericMetrics: {
              [effectiveYAxis]: stats,
            },
          },
          surroundingRows: surrounding,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to explain anomaly');
      }

      const data = await res.json();
      setAnomalyDiagnosis(data.explanation);
    } catch (err: any) {
      setDiagnosisError(err.message || 'Error diagnosing anomaly');
    } finally {
      setIsDiagnosing(false);
    }
  };

  // Pearson Correlation for Scatter Plot
  const scatterCorrelation = useMemo(() => {
    if (config.type !== 'scatter' || chartData.length < 2) return null;
    const xVals = chartData.map((d) => Number(d.x) || 0);
    const yVals = chartData.map((d) => d.y);
    return calculatePearsonCorrelation(xVals, yVals);
  }, [config.type, chartData]);

  // Scatter plot x-bounds precomputed safely
  const scatterBounds = useMemo(() => {
    if (config.type !== 'scatter' || !chartData.length) return { min: 0, max: 1 };
    const xNumbers = chartData.map((cd, idx) => {
      const n = Number(cd.x);
      return !isNaN(n) && isFinite(n) ? n : idx;
    });
    return {
      min: safeArrayMin(xNumbers, 0),
      max: safeArrayMax(xNumbers, 1),
    };
  }, [config.type, chartData]);

  // Histogram data
  const histogramBins = useMemo(() => {
    if (config.type !== 'histogram') return [];
    return computeHistogramBins(yValues, 14);
  }, [config.type, yValues]);

  // Dimensions for SVG rendering
  const width = 860;
  const height = 380;
  const padding = { top: 35, right: 40, bottom: 55, left: 65 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  // Scales
  const { minVal, maxVal } = useMemo(() => {
    if (!yValues.length) return { minVal: 0, maxVal: 100 };
    let min = safeArrayMin(yValues, 0);
    let max = safeArrayMax(yValues, 100);

    // If regression line extends outside, adapt bounds
    if (regression && chartData.length > 0) {
      const regStart = regression.predict(0);
      const regEnd = regression.predict(chartData.length - 1);
      if (isFinite(regStart) && isFinite(regEnd)) {
        min = Math.min(min, regStart, regEnd);
        max = Math.max(max, regStart, regEnd);
      }
    }

    // Add breathing room
    const span = max - min || 1;
    return {
      minVal: min >= 0 ? Math.max(0, min - span * 0.08) : min - span * 0.08,
      maxVal: max + span * 0.08,
    };
  }, [yValues, regression, chartData.length]);

  const getYCoord = (val: number) => {
    if (!isFinite(val)) return padding.top + plotHeight / 2;
    if (maxVal === minVal || !isFinite(maxVal) || !isFinite(minVal)) return padding.top + plotHeight / 2;
    const normalized = (val - minVal) / (maxVal - minVal);
    const result = padding.top + plotHeight - normalized * plotHeight;
    return isFinite(result) ? result : padding.top + plotHeight / 2;
  };

  const getXCoord = (index: number, count: number) => {
    if (count <= 1) return padding.left + plotWidth / 2;
    const result = padding.left + (index / (count - 1)) * plotWidth;
    return isFinite(result) ? result : padding.left;
  };

  // SVG Paths
  const linePath = useMemo(() => {
    if (config.type !== 'line' && config.type !== 'area') return '';
    return chartData.reduce((path, pt, i) => {
      const cx = getXCoord(i, chartData.length);
      const cy = getYCoord(pt.y);
      return i === 0 ? `M ${cx} ${cy}` : `${path} L ${cx} ${cy}`;
    }, '');
  }, [chartData, config.type, minVal, maxVal]);

  const areaPath = useMemo(() => {
    if (!linePath || config.type !== 'area') return '';
    const firstX = getXCoord(0, chartData.length);
    const lastX = getXCoord(chartData.length - 1, chartData.length);
    const bottomY = padding.top + plotHeight;
    return `${linePath} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
  }, [linePath, config.type, chartData.length]);

  const movingAveragePath = useMemo(() => {
    if (!config.showMovingAverage || !movingAverages.length) return '';
    return movingAverages.reduce((path, ma, i) => {
      if (ma === null) return path;
      const cx = getXCoord(i, movingAverages.length);
      const cy = getYCoord(ma);
      return path === '' ? `M ${cx} ${cy}` : `${path} L ${cx} ${cy}`;
    }, '');
  }, [movingAverages, config.showMovingAverage, minVal, maxVal]);

  const regressionLine = useMemo(() => {
    if (!regression || chartData.length < 2) return null;
    const x1 = getXCoord(0, chartData.length);
    const y1 = getYCoord(regression.predict(0));
    const x2 = getXCoord(chartData.length - 1, chartData.length);
    const y2 = getYCoord(regression.predict(chartData.length - 1));
    return { x1, y1, x2, y2 };
  }, [regression, chartData.length, minVal, maxVal]);

  // Confidence Envelope (Mean ± 1 stdDev)
  const confidenceBand = useMemo(() => {
    if (!config.showConfidenceBand || stats.stdDev === 0) return null;
    const topY = getYCoord(stats.mean + stats.stdDev);
    const bottomY = getYCoord(stats.mean - stats.stdDev);
    return {
      top: Math.max(padding.top, topY),
      bottom: Math.min(padding.top + plotHeight, bottomY),
      height: Math.abs(bottomY - topY),
    };
  }, [config.showConfidenceBand, stats, minVal, maxVal]);

  // Export SVG as image
  const handleExportSvg = () => {
    const svgElem = containerRef.current?.querySelector('svg');
    if (!svgElem) return;
    const svgData = new XMLSerializer().serializeToString(svgElem);
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `trend-chart-${config.yAxis}.svg`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden" ref={containerRef}>
      {/* Chart Control Header - Streamlit style */}
      <div className="px-3.5 sm:px-5 py-3 sm:py-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/50">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center font-bold text-sm sm:text-base shrink-0">
            📈
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <h3 className="font-semibold text-slate-800 text-sm sm:text-base truncate max-w-[200px] sm:max-w-none">
                {config.yAxis || 'Metric'} by {config.xAxis || 'Time'}
              </h3>
              {anomalies.length > 0 && (
                <span className="px-2 py-0.5 text-[10px] sm:text-xs font-semibold bg-red-100 text-red-700 rounded-full flex items-center gap-1 animate-pulse">
                  <AlertTriangle className="w-3 h-3" />
                  {anomalies.length} {anomalies.length === 1 ? 'anomaly' : 'anomalies'}
                </span>
              )}
            </div>
            <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 truncate">
              Real-time trend analysis on {chartData.length.toLocaleString()} points
            </p>
          </div>
        </div>

        {/* Visualizer Type Selector - horizontally scrollable on mobile */}
        <div className="w-full md:w-auto overflow-x-auto no-scrollbar flex items-center gap-1 bg-slate-200/70 p-1 rounded-lg shrink-0">
          <button
            onClick={() => onConfigChange({ type: 'line' })}
            className={`flex items-center gap-1 px-2.5 sm:px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-all cursor-pointer ${
              config.type === 'line'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            Line
          </button>
          <button
            onClick={() => onConfigChange({ type: 'area' })}
            className={`flex items-center gap-1 px-2.5 sm:px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-all cursor-pointer ${
              config.type === 'area'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <AreaChart className="w-3.5 h-3.5" />
            Area
          </button>
          <button
            onClick={() => onConfigChange({ type: 'bar' })}
            className={`flex items-center gap-1 px-2.5 sm:px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-all cursor-pointer ${
              config.type === 'bar'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Bar
          </button>
          <button
            onClick={() => onConfigChange({ type: 'scatter' })}
            className={`flex items-center gap-1 px-2.5 sm:px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-all cursor-pointer ${
              config.type === 'scatter'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ScatterChart className="w-3.5 h-3.5" />
            Scatter
          </button>
          <button
            onClick={() => onConfigChange({ type: 'histogram' })}
            className={`flex items-center gap-1 px-2.5 sm:px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-all cursor-pointer ${
              config.type === 'histogram'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            Distribution
          </button>
        </div>
      </div>

      {/* Axis & Aggregation Secondary Toolbar */}
      <div className="px-3 sm:px-5 py-2.5 bg-slate-50 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-2.5 sm:gap-3">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-slate-500">X Axis:</span>
            <select
              value={config.xAxis}
              onChange={(e) => onConfigChange({ xAxis: e.target.value })}
              className="bg-white border border-slate-300 rounded px-2 py-1 text-xs text-slate-700 font-medium focus:ring-1 focus:ring-red-500 focus:outline-none"
            >
              {columns.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name} ({c.type})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="font-medium text-slate-500">Y Axis (Metric):</span>
            <select
              value={config.yAxis}
              onChange={(e) => onConfigChange({ yAxis: e.target.value })}
              className="bg-white border border-slate-300 rounded px-2 py-1 text-xs text-slate-700 font-medium focus:ring-1 focus:ring-red-500 focus:outline-none"
            >
              {numericCols.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {config.type === 'bar' && (
            <div className="flex items-center gap-1.5">
              <span className="font-medium text-slate-500">Aggregation:</span>
              <select
                value={config.aggregation}
                onChange={(e) => onConfigChange({ aggregation: e.target.value as AggregationType })}
                className="bg-white border border-slate-300 rounded px-2 py-1 text-xs text-slate-700 font-medium focus:ring-1 focus:ring-red-500 focus:outline-none"
              >
                <option value="none">None (Raw Rows)</option>
                <option value="sum">Sum</option>
                <option value="mean">Average (Mean)</option>
                <option value="median">Median</option>
                <option value="count">Count of Records</option>
                <option value="max">Max</option>
                <option value="min">Min</option>
              </select>
            </div>
          )}
        </div>

        {/* Feature Toggles */}
        <div className="flex flex-wrap items-center gap-3">
          {(config.type === 'line' || config.type === 'area') && (
            <>
              <div className="flex items-center gap-1.5">
                <label className="flex items-center gap-1.5 cursor-pointer select-none text-slate-600 hover:text-slate-900">
                  <input
                    type="checkbox"
                    checked={config.showMovingAverage}
                    onChange={(e) => onConfigChange({ showMovingAverage: e.target.checked })}
                    className="rounded border-slate-300 text-amber-600 focus:ring-amber-500 w-3.5 h-3.5"
                  />
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-0.5 bg-amber-500 rounded-full inline-block"></span>
                    SMA
                  </span>
                </label>
                {config.showMovingAverage && (
                  <select
                    value={config.movingAverageWindow}
                    onChange={(e) => onConfigChange({ movingAverageWindow: Number(e.target.value) })}
                    className="bg-white border border-slate-300 rounded px-1.5 py-0.5 text-[11px] font-mono text-slate-700 focus:outline-none"
                  >
                    <option value={3}>3d</option>
                    <option value={5}>5d</option>
                    <option value={7}>7d</option>
                    <option value={14}>14d</option>
                    <option value={30}>30d</option>
                  </select>
                )}
              </div>

              <label className="flex items-center gap-1.5 cursor-pointer select-none text-slate-600 hover:text-slate-900">
                <input
                  type="checkbox"
                  checked={config.showTrendline}
                  onChange={(e) => onConfigChange({ showTrendline: e.target.checked })}
                  className="rounded border-slate-300 text-sky-600 focus:ring-sky-500 w-3.5 h-3.5"
                />
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-0.5 border-b border-dashed border-sky-500 inline-block"></span>
                  Trendline
                </span>
              </label>

              <div className="flex items-center gap-1.5">
                <label className="flex items-center gap-1.5 cursor-pointer select-none text-slate-600 hover:text-slate-900">
                  <input
                    type="checkbox"
                    checked={config.detectAnomalies}
                    onChange={(e) => onConfigChange({ detectAnomalies: e.target.checked })}
                    className="rounded border-slate-300 text-red-600 focus:ring-red-500 w-3.5 h-3.5"
                  />
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-red-500 inline-block"></span>
                    Anomalies
                  </span>
                </label>
                {config.detectAnomalies && (
                  <select
                    value={config.anomalyThreshold}
                    onChange={(e) => onConfigChange({ anomalyThreshold: Number(e.target.value) })}
                    className="bg-white border border-slate-300 rounded px-1.5 py-0.5 text-[11px] font-mono text-slate-700 focus:outline-none"
                  >
                    <option value={1.5}>±1.5σ</option>
                    <option value={2.0}>±2.0σ</option>
                    <option value={2.5}>±2.5σ</option>
                    <option value={3.0}>±3.0σ</option>
                  </select>
                )}
              </div>
            </>
          )}

          <button
            onClick={handleExportSvg}
            title="Export chart SVG vector"
            className="p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-200/60"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* SVG Canvas Area */}
      <div className="relative p-3 select-none flex items-center justify-center bg-white min-h-[380px]">
        {chartData.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-slate-400">
            <Info className="w-8 h-8 mb-2 stroke-1" />
            <p className="text-sm font-medium">No data points match the current filters.</p>
            <p className="text-xs text-slate-400 mt-1">Adjust sidebar filters or select different axes.</p>
          </div>
        ) : config.type === 'histogram' ? (
          /* Histogram Distribution View */
          <div className="w-full h-[360px] p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-700">
                Frequency Distribution of {config.yAxis}
              </span>
              <span className="text-xs text-slate-500">
                Mean: {formatDataValue(stats.mean, config.yAxis)} | Median: {formatDataValue(stats.median, config.yAxis)} | StdDev: ±{stats.stdDev.toFixed(1)}
              </span>
            </div>
            <div className="flex-1 flex items-end gap-1.5 pt-4 pb-2 border-b border-slate-200">
              {histogramBins.map((bin, i) => {
                const maxCount = Math.max(...histogramBins.map((b) => b.count)) || 1;
                const heightPct = (bin.count / maxCount) * 100;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center h-full justify-end group relative">
                    <div className="text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 mb-1 font-mono transition-opacity">
                      {bin.count}
                    </div>
                    <div
                      style={{ height: `${Math.max(4, heightPct)}%` }}
                      className="w-full bg-red-400/80 hover:bg-red-500 rounded-t transition-all group-hover:shadow-md"
                    />
                    <div className="text-[9px] text-slate-400 truncate w-full text-center mt-1 transform -rotate-25 origin-top-left">
                      {bin.rangeLabel}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : config.type === 'scatter' ? (
          /* Scatter Plot View */
          <div className="w-full relative">
            {scatterCorrelation !== null && (
              <div className="absolute top-2 right-4 z-10 px-3 py-1 bg-slate-50 border border-slate-200 rounded-md text-xs font-mono text-slate-700 shadow-xs">
                Pearson r = <strong>{scatterCorrelation.toFixed(3)}</strong>{' '}
                <span className="text-slate-400 font-sans">
                  ({Math.abs(scatterCorrelation) > 0.7 ? 'Strong' : Math.abs(scatterCorrelation) > 0.4 ? 'Moderate' : 'Weak'}{' '}
                  {scatterCorrelation >= 0 ? 'Positive' : 'Negative'})
                </span>
              </div>
            )}
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
              {/* Horizontal grid */}
              {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
                const y = padding.top + plotHeight * pct;
                const val = maxVal - pct * (maxVal - minVal);
                return (
                  <g key={i}>
                    <line x1={padding.left} y1={y} x2={padding.left + plotWidth} y2={y} stroke="#f1f5f9" strokeWidth="1" />
                    <text x={padding.left - 8} y={y + 4} textAnchor="end" className="text-[10px] fill-slate-400 font-mono">
                      {formatDataValue(val, config.yAxis)}
                    </text>
                  </g>
                );
              })}

              {/* Scatter Points */}
              {chartData.map((d, i) => {
                const xNumeric = Number(d.x) || i;
                const xMin = scatterBounds.min;
                const xMax = scatterBounds.max;
                const normX = xMax === xMin ? 0.5 : (xNumeric - xMin) / (xMax - xMin);
                const cx = padding.left + (isFinite(normX) ? normX : 0.5) * plotWidth;
                const cy = getYCoord(d.y);

                return (
                  <circle
                    key={i}
                    cx={cx}
                    cy={cy}
                    r={hoverIndex === i ? 6 : 4}
                    className="fill-red-500/80 hover:fill-red-600 transition-all cursor-pointer stroke-white stroke-1"
                    onMouseEnter={() => setHoverIndex(i)}
                    onMouseLeave={() => setHoverIndex(null)}
                  />
                );
              })}
            </svg>
          </div>
        ) : (
          /* Standard Line / Area / Bar Chart SVG */
          <div className="w-full relative">
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="w-full h-auto overflow-visible"
              onMouseLeave={() => {
                setHoverIndex(null);
                setHoverCoords(null);
              }}
            >
              <defs>
                <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity="0.02" />
                </linearGradient>
                <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f87171" />
                  <stop offset="100%" stopColor="#dc2626" />
                </linearGradient>
              </defs>

              {/* Background Grid Lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
                const y = padding.top + plotHeight * pct;
                const val = maxVal - pct * (maxVal - minVal);
                return (
                  <g key={i}>
                    <line
                      x1={padding.left}
                      y1={y}
                      x2={padding.left + plotWidth}
                      y2={y}
                      stroke="#f1f5f9"
                      strokeWidth="1"
                      strokeDasharray={pct === 0.5 ? '2 2' : undefined}
                    />
                    <text
                      x={padding.left - 8}
                      y={y + 4}
                      textAnchor="end"
                      className="text-[10px] fill-slate-400 font-mono"
                    >
                      {formatDataValue(val, config.yAxis)}
                    </text>
                  </g>
                );
              })}

              {/* Confidence Band Envelope */}
              {confidenceBand && (
                <rect
                  x={padding.left}
                  y={confidenceBand.top}
                  width={plotWidth}
                  height={confidenceBand.height}
                  fill="#fecaca"
                  fillOpacity="0.25"
                />
              )}

              {/* Mean Reference Line */}
              <line
                x1={padding.left}
                y1={getYCoord(stats.mean)}
                x2={padding.left + plotWidth}
                y2={getYCoord(stats.mean)}
                stroke="#94a3b8"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
              <text
                x={padding.left + plotWidth - 4}
                y={getYCoord(stats.mean) - 4}
                textAnchor="end"
                className="text-[9px] fill-slate-400 font-mono"
              >
                Avg {formatDataValue(stats.mean, config.yAxis)}
              </text>

              {/* Area fill */}
              {config.type === 'area' && areaPath && (
                <path d={areaPath} fill="url(#areaGradient)" />
              )}

              {/* Bar Chart rendering */}
              {config.type === 'bar' &&
                chartData.map((d, i) => {
                  const barWidth = Math.min(36, Math.max(8, (plotWidth / chartData.length) * 0.7));
                  const cx = getXCoord(i, chartData.length);
                  const x = cx - barWidth / 2;
                  const y = getYCoord(Math.max(0, d.y));
                  const zeroY = getYCoord(0);
                  const h = Math.abs(zeroY - y);

                  return (
                    <g key={i} className="group">
                      <rect
                        x={x}
                        y={Math.min(y, zeroY)}
                        width={barWidth}
                        height={Math.max(2, h)}
                        fill="url(#barGradient)"
                        rx="3"
                        className="transition-all hover:opacity-85 cursor-pointer"
                        onMouseEnter={() => setHoverIndex(i)}
                      />
                      {barWidth > 18 && (
                        <text
                          x={cx}
                          y={Math.min(y, zeroY) - 5}
                          textAnchor="middle"
                          className="text-[9px] fill-slate-500 font-mono opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          {formatDataValue(d.y, config.yAxis)}
                        </text>
                      )}
                    </g>
                  );
                })}

              {/* Main Line series */}
              {(config.type === 'line' || config.type === 'area') && linePath && (
                <path
                  d={linePath}
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Moving Average Line */}
              {movingAveragePath && (
                <path
                  d={movingAveragePath}
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="2"
                  strokeDasharray="4 3"
                />
              )}

              {/* Linear Regression Trendline */}
              {regressionLine && (
                <line
                  x1={regressionLine.x1}
                  y1={regressionLine.y1}
                  x2={regressionLine.x2}
                  y2={regressionLine.y2}
                  stroke="#0284c7"
                  strokeWidth="2"
                  strokeDasharray="6 3"
                />
              )}

              {/* Anomaly markers */}
              {config.detectAnomalies &&
                anomalies.map((anom) => {
                  const cx = getXCoord(anom.index, chartData.length);
                  const cy = getYCoord(anom.yValue);
                  return (
                    <g key={anom.index} className="animate-pulse">
                      <circle cx={cx} cy={cy} r="9" fill="none" stroke="#ef4444" strokeWidth="2" opacity="0.6" />
                      <circle cx={cx} cy={cy} r="4" fill="#ef4444" />
                    </g>
                  );
                })}

              {/* Interactive Hover crosshair and hover circle */}
              {hoverIndex !== null && chartData[hoverIndex] && (
                <g>
                  <line
                    x1={getXCoord(hoverIndex, chartData.length)}
                    y1={padding.top}
                    x2={getXCoord(hoverIndex, chartData.length)}
                    y2={padding.top + plotHeight}
                    stroke="#94a3b8"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                  />
                  <circle
                    cx={getXCoord(hoverIndex, chartData.length)}
                    cy={getYCoord(chartData[hoverIndex].y)}
                    r="5"
                    fill="#ef4444"
                    stroke="#fff"
                    strokeWidth="2"
                  />
                </g>
              )}

              {/* Mouse & Touch capture overlay for desktop and mobile */}
              <rect
                x={padding.left}
                y={padding.top}
                width={plotWidth}
                height={plotHeight}
                fill="transparent"
                className="cursor-crosshair"
                onMouseMove={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const mouseX = e.clientX - rect.left;
                  const ratio = Math.max(0, Math.min(1, mouseX / rect.width));
                  const idx = Math.round(ratio * (chartData.length - 1));
                  setHoverIndex(idx);
                }}
                onTouchStart={(e) => {
                  const touch = e.touches[0];
                  if (!touch) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const touchX = touch.clientX - rect.left;
                  const ratio = Math.max(0, Math.min(1, touchX / rect.width));
                  const idx = Math.round(ratio * (chartData.length - 1));
                  setHoverIndex(idx);
                }}
                onTouchMove={(e) => {
                  const touch = e.touches[0];
                  if (!touch) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const touchX = touch.clientX - rect.left;
                  const ratio = Math.max(0, Math.min(1, touchX / rect.width));
                  const idx = Math.round(ratio * (chartData.length - 1));
                  setHoverIndex(idx);
                }}
                onTouchEnd={() => {
                  // Keep tooltip visible or clear on delay
                  setTimeout(() => setHoverIndex(null), 3000);
                }}
              />

              {/* X Axis Ticks */}
              {chartData.map((d, i) => {
                const step = Math.max(1, Math.floor(chartData.length / 8));
                if (i % step !== 0 && i !== chartData.length - 1) return null;
                const cx = getXCoord(i, chartData.length);
                const str = String(d.x);
                const shortLabel = str.length > 10 ? str.substring(5, 10) : str;

                return (
                  <text
                    key={i}
                    x={cx}
                    y={padding.top + plotHeight + 18}
                    textAnchor="middle"
                    className="text-[10px] fill-slate-500 font-mono"
                  >
                    {shortLabel}
                  </text>
                );
              })}
            </svg>

            {/* Hover Tooltip (Streamlit altair style) with edge clamping for mobile screens */}
            {hoverIndex !== null && chartData[hoverIndex] && (
              <div
                className="absolute pointer-events-none z-20 bg-slate-900/95 text-white px-3 py-2 rounded-lg shadow-xl text-xs backdrop-blur-xs transform -translate-x-1/2 -translate-y-full border border-slate-700/60 transition-all max-w-[240px] sm:max-w-xs"
                style={{
                  left: `${Math.max(22, Math.min(78, (getXCoord(hoverIndex, chartData.length) / width) * 100))}%`,
                  top: `${Math.max(15, (getYCoord(chartData[hoverIndex].y) / height) * 100 - 4)}%`,
                }}
              >
                <div className="font-semibold text-slate-200 border-b border-slate-700/80 pb-1 mb-1 flex items-center justify-between gap-4">
                  <span>{String(chartData[hoverIndex].x)}</span>
                  <span className="text-[10px] text-slate-400">Row #{hoverIndex + 1}</span>
                </div>
                <div className="flex items-center justify-between gap-4 py-0.5">
                  <span className="text-slate-400">{config.yAxis}:</span>
                  <span className="font-mono font-bold text-red-400">
                    {formatDataValue(chartData[hoverIndex].y, config.yAxis)}
                  </span>
                </div>

                {config.showMovingAverage && movingAverages[hoverIndex] !== null && (
                  <div className="flex items-center justify-between gap-4 py-0.5 text-amber-300">
                    <span className="text-slate-400">SMA:</span>
                    <span className="font-mono">
                      {formatDataValue(movingAverages[hoverIndex]!, config.yAxis)}
                    </span>
                  </div>
                )}

                {anomalyIndexSet.has(hoverIndex) && (
                  <div className="mt-1 pt-1 border-t border-red-500/40 text-red-400 flex items-center gap-1 font-semibold text-[11px]">
                    <AlertTriangle className="w-3 h-3" /> Statistical Anomaly Detected!
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Chart Footer Statistics Legend */}
      <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex flex-wrap items-center gap-4 text-slate-600">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-0.5 bg-red-500 rounded-full inline-block"></span>
            <span>Current Series</span>
          </div>
          {config.showMovingAverage && (
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-0.5 bg-amber-500 rounded-full inline-block"></span>
              <span>{config.movingAverageWindow}-Day Moving Avg</span>
            </div>
          )}
          {config.showTrendline && regression && (
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-0.5 bg-sky-500 rounded-full inline-block"></span>
              <span>
                Trendline Slope: <strong className="font-mono text-sky-700">{regression.slope > 0 ? '+' : ''}{regression.slope.toFixed(2)}/step</strong> (R² = {(regression.r2 * 100).toFixed(1)}%)
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 text-slate-500 font-mono text-[11px]">
          <span>Min: <strong className="text-slate-700">{formatDataValue(stats.min, config.yAxis)}</strong></span>
          <span>Avg: <strong className="text-slate-700">{formatDataValue(stats.mean, config.yAxis)}</strong></span>
          <span>Max: <strong className="text-slate-700">{formatDataValue(stats.max, config.yAxis)}</strong></span>
        </div>
      </div>

      {/* Streamlit Anomaly Deep Dive & Forensic AI Inspector */}
      {config.detectAnomalies && anomalies.length > 0 && (
        <div className="border-t border-red-100 bg-red-50/25 p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-red-100 text-red-600">
                <AlertTriangle className="w-4 h-4" />
              </span>
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span>Detected Statistical Anomalies ({anomalies.length})</span>
                  <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-mono">
                    Threshold: ±{config.anomalyThreshold}σ
                  </span>
                </h4>
                <p className="text-[11px] text-slate-500">
                  Select any anomaly point below to run instant Gemini AI forensic diagnosis on its underlying drivers.
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsAnomalyInspectorOpen(!isAnomalyInspectorOpen)}
              className="text-xs text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer font-medium px-2 py-1 rounded hover:bg-slate-100"
            >
              <span>{isAnomalyInspectorOpen ? 'Collapse' : 'Expand'}</span>
              {isAnomalyInspectorOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>

          {isAnomalyInspectorOpen && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                {anomalies.slice(0, 6).map((anom) => {
                  const isSelected = selectedAnomaly?.index === anom.index;
                  return (
                    <div
                      key={anom.index}
                      onClick={() => handleDiagnoseAnomaly(anom)}
                      className={`p-3 rounded-lg border text-xs cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-white border-red-500 shadow-sm ring-1 ring-red-400'
                          : 'bg-white/90 border-slate-200 hover:border-red-300 hover:bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between font-mono mb-1">
                        <span className="font-semibold text-slate-800 truncate max-w-[120px]">{String(anom.xValue)}</span>
                        <span className="text-red-600 font-bold bg-red-50 px-1.5 py-0.5 rounded text-[11px]">
                          {anom.zScore > 0 ? '+' : ''}{anom.zScore}σ
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-slate-600 font-mono text-[11px]">
                        <span>Observed: <strong className="text-slate-900">{formatDataValue(anom.yValue, config.yAxis)}</strong></span>
                        <span className="text-slate-400">Exp: {formatDataValue(anom.expectedValue, config.yAxis)}</span>
                      </div>
                      <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">Row #{anom.index + 1}</span>
                        <span className="text-[#ff4b4b] font-semibold flex items-center gap-1 hover:underline">
                          <Sparkles className="w-3 h-3" /> Diagnose with AI
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* AI Forensic Diagnosis Result Card */}
              {selectedAnomaly && (
                <div className="bg-white p-4 rounded-xl border border-red-200 shadow-sm mt-3 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2.5">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-red-500" />
                      <h5 className="font-bold text-xs text-slate-900">
                        Gemini Forensic Anomaly Diagnosis • {String(selectedAnomaly.xValue)} ({selectedAnomaly.zScore > 0 ? '+' : ''}{selectedAnomaly.zScore}σ)
                      </h5>
                    </div>
                    <button
                      onClick={() => setSelectedAnomaly(null)}
                      className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {isDiagnosing ? (
                    <div className="flex items-center gap-2.5 text-xs text-slate-600 py-3">
                      <Loader2 className="w-4 h-4 animate-spin text-red-500" />
                      <span>Investigating multivariate correlations and drivers with Gemini AI...</span>
                    </div>
                  ) : diagnosisError ? (
                    <div className="text-xs text-red-600 py-2">
                      {diagnosisError}
                    </div>
                  ) : anomalyDiagnosis ? (
                    <div className="text-xs text-slate-700 leading-relaxed space-y-2 whitespace-pre-line font-sans">
                      {anomalyDiagnosis}
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
