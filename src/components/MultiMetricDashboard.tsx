import React, { useMemo, useState } from 'react';
import { ColumnMeta } from '../types';
import { calculateBasicStats, calculatePercentiles, calculateSkewness, formatDataValue } from '../utils/stats';
import {
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  BarChart2,
  Table as TableIcon,
  Search,
} from 'lucide-react';

interface MultiMetricDashboardProps {
  columns: ColumnMeta[];
  filteredRows: Record<string, any>[];
  totalRows: Record<string, any>[];
  timeCol?: string;
  onSelectMetricForVisualizer: (metricName: string) => void;
}

export const MultiMetricDashboard: React.FC<MultiMetricDashboardProps> = ({
  columns,
  filteredRows,
  totalRows,
  timeCol,
  onSelectMetricForVisualizer,
}) => {
  const [searchMetric, setSearchMetric] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'sum' | 'mean' | 'delta'>('name');

  const numericCols = useMemo(() => {
    return columns.filter((c) => c.type === 'number');
  }, [columns]);

  // Compute rich metrics for both filtered rows and total baseline rows
  const metricCardsData = useMemo(() => {
    return numericCols.map((col) => {
      const filteredVals = filteredRows
        .map((r) => Number(r[col.name]))
        .filter((v) => !isNaN(v) && isFinite(v));

      const totalVals = totalRows
        .map((r) => Number(r[col.name]))
        .filter((v) => !isNaN(v) && isFinite(v));

      const fStats = calculateBasicStats(filteredVals);
      const tStats = calculateBasicStats(totalVals);
      const percentiles = calculatePercentiles(filteredVals, [10, 25, 50, 75, 90, 99]);
      const skewness = calculateSkewness(filteredVals);

      // Delta between filtered mean and baseline mean
      const meanDeltaPct =
        tStats.mean !== 0 ? ((fStats.mean - tStats.mean) / Math.abs(tStats.mean)) * 100 : 0;

      // Delta between filtered sum and baseline sum
      const sumDeltaPct =
        tStats.sum !== 0 ? ((fStats.sum - tStats.sum) / Math.abs(tStats.sum)) * 100 : 0;

      // Compute sparkline points (up to 24 sampled points)
      let sparklineSvg = '';
      if (filteredVals.length >= 2) {
        const step = Math.max(1, Math.floor(filteredVals.length / 24));
        const sampled = filteredVals.filter((_, i) => i % step === 0).slice(0, 24);
        const min = Math.min(...sampled);
        const max = Math.max(...sampled);
        const span = max - min || 1;

        sparklineSvg = sampled
          .map((v, i) => {
            const x = (i / (sampled.length - 1)) * 120;
            const y = 32 - ((v - min) / span) * 26;
            return `${x.toFixed(1)},${y.toFixed(1)}`;
          })
          .join(' ');
      }

      // Check trend direction (first third vs last third)
      let trendDirection: 'up' | 'down' | 'flat' = 'flat';
      if (filteredVals.length >= 6) {
        const third = Math.floor(filteredVals.length / 3);
        const firstThirdAvg =
          filteredVals.slice(0, third).reduce((a, b) => a + b, 0) / third;
        const lastThirdAvg =
          filteredVals.slice(-third).reduce((a, b) => a + b, 0) / third;
        const diff = (lastThirdAvg - firstThirdAvg) / (Math.abs(firstThirdAvg) || 1);
        if (diff > 0.05) trendDirection = 'up';
        else if (diff < -0.05) trendDirection = 'down';
      }

      return {
        column: col,
        fStats,
        tStats,
        percentiles,
        skewness,
        meanDeltaPct,
        sumDeltaPct,
        sparklineSvg,
        trendDirection,
        count: filteredVals.length,
      };
    });
  }, [numericCols, filteredRows, totalRows]);

  // Filter and sort cards
  const displayedMetrics = useMemo(() => {
    let result = metricCardsData;
    if (searchMetric.trim()) {
      const q = searchMetric.toLowerCase();
      result = result.filter((m) => m.column.name.toLowerCase().includes(q));
    }

    result.sort((a, b) => {
      if (sortBy === 'name') return a.column.name.localeCompare(b.column.name);
      if (sortBy === 'sum') return b.fStats.sum - a.fStats.sum;
      if (sortBy === 'mean') return b.fStats.mean - a.fStats.mean;
      if (sortBy === 'delta') return Math.abs(b.meanDeltaPct) - Math.abs(a.meanDeltaPct);
      return 0;
    });

    return result;
  }, [metricCardsData, searchMetric, sortBy]);

  return (
    <div className="space-y-6">
      {/* Top Controls Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-red-50 text-red-600 font-bold">
            <BarChart2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Multi-Metric KPI Dashboard</h2>
            <p className="text-xs text-slate-500">
              Tracking {numericCols.length} numerical metrics across {filteredRows.length} active records
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search metric */}
          <div className="relative min-w-[180px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search metrics..."
              value={searchMetric}
              onChange={(e) => setSearchMetric(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-red-500 focus:outline-none"
            />
          </div>

          {/* Sort selector */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="font-medium">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-700 focus:ring-1 focus:ring-red-500 focus:outline-none cursor-pointer"
            >
              <option value="name">Metric Name (A-Z)</option>
              <option value="sum">Total Sum (High to Low)</option>
              <option value="mean">Average (High to Low)</option>
              <option value="delta">Absolute Delta vs Baseline</option>
            </select>
          </div>
        </div>
      </div>

      {/* Grid of Multi-Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {displayedMetrics.map((item) => {
          const isPositiveDelta = item.meanDeltaPct >= 0;
          return (
            <div
              key={item.column.name}
              className="bg-white rounded-xl border border-slate-200/90 shadow-xs hover:shadow-md transition-all p-4.5 flex flex-col justify-between"
            >
              <div>
                {/* Header: Metric Name & Trend Badge */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                      Metric
                    </span>
                    <h3 className="text-sm font-bold text-slate-900 truncate" title={item.column.name}>
                      {item.column.name}
                    </h3>
                  </div>

                  <div
                    className={`px-2 py-0.5 rounded-full text-[11px] font-bold flex items-center gap-0.5 shrink-0 ${
                      item.trendDirection === 'up'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                        : item.trendDirection === 'down'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200/60'
                        : 'bg-slate-50 text-slate-600 border border-slate-200/60'
                    }`}
                  >
                    {item.trendDirection === 'up' && <ArrowUpRight className="w-3 h-3" />}
                    {item.trendDirection === 'down' && <ArrowDownRight className="w-3 h-3" />}
                    <span>{item.trendDirection.toUpperCase()}</span>
                  </div>
                </div>

                {/* Primary Aggregates (Sum and Mean) */}
                <div className="grid grid-cols-2 gap-2 my-3 p-2.5 bg-slate-50/70 rounded-lg border border-slate-100">
                  <div>
                    <span className="text-[10px] text-slate-500 font-medium block">Total Sum</span>
                    <span className="text-base font-bold font-mono text-slate-900">
                      {formatDataValue(item.fStats.sum, item.column.name)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-medium block">Average (Mean)</span>
                    <span className="text-base font-bold font-mono text-slate-900">
                      {formatDataValue(item.fStats.mean, item.column.name)}
                    </span>
                  </div>
                </div>

                {/* Delta vs Total Baseline */}
                {totalRows.length > filteredRows.length && (
                  <div className="flex items-center justify-between text-xs mb-3 text-slate-600">
                    <span className="text-[11px] text-slate-500">vs Unfiltered Baseline:</span>
                    <span
                      className={`font-mono font-semibold flex items-center gap-0.5 ${
                        isPositiveDelta ? 'text-emerald-600' : 'text-red-600'
                      }`}
                    >
                      {isPositiveDelta ? '+' : ''}
                      {item.meanDeltaPct.toFixed(1)}%
                    </span>
                  </div>
                )}

                {/* Sparkline Visualization */}
                {item.sparklineSvg && (
                  <div className="my-2 py-1">
                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono mb-1">
                      <span>Trajectory Sparkline</span>
                      <span>{item.count} pts</span>
                    </div>
                    <svg viewBox="0 0 120 32" className="w-full h-8 overflow-visible">
                      <polyline
                        fill="none"
                        stroke="#ff4b4b"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        points={item.sparklineSvg}
                      />
                    </svg>
                  </div>
                )}

                {/* Statistical Details Grid */}
                <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-slate-100 text-[11px] font-mono text-slate-600">
                  <div>
                    <span className="text-[9px] text-slate-400 block font-sans">Min</span>
                    <strong>{formatDataValue(item.fStats.min, item.column.name)}</strong>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 block font-sans">Median (P50)</span>
                    <strong>{formatDataValue(item.fStats.median, item.column.name)}</strong>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 block font-sans">Max</span>
                    <strong>{formatDataValue(item.fStats.max, item.column.name)}</strong>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 block font-sans">Std Dev</span>
                    <strong>±{item.fStats.stdDev.toFixed(1)}</strong>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 block font-sans">90th Pct</span>
                    <strong>{formatDataValue(item.percentiles[90], item.column.name)}</strong>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 block font-sans">Skewness</span>
                    <strong>{item.skewness}</strong>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end">
                <button
                  onClick={() => onSelectMetricForVisualizer(item.column.name)}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-[#ff4b4b] transition-colors cursor-pointer"
                >
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>Visualize Trend</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Comprehensive Statistical Distribution Matrix */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs p-4 sm:p-5 overflow-hidden">
        <div className="flex items-center gap-2 mb-3">
          <TableIcon className="w-4 h-4 text-slate-700" />
          <h3 className="text-sm font-bold text-slate-900">
            Parametric & Quantile Distribution Table
          </h3>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 font-semibold">
                <th className="py-2.5 px-3">Metric</th>
                <th className="py-2.5 px-3 text-right">Sum</th>
                <th className="py-2.5 px-3 text-right">Mean</th>
                <th className="py-2.5 px-3 text-right">StdDev</th>
                <th className="py-2.5 px-3 text-right">Min</th>
                <th className="py-2.5 px-3 text-right">P25 (Q1)</th>
                <th className="py-2.5 px-3 text-right">Median</th>
                <th className="py-2.5 px-3 text-right">P75 (Q3)</th>
                <th className="py-2.5 px-3 text-right">P90</th>
                <th className="py-2.5 px-3 text-right">Max</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-slate-700">
              {displayedMetrics.map((item) => (
                <tr key={item.column.name} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-2.5 px-3 font-sans font-semibold text-slate-900">
                    {item.column.name}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    {formatDataValue(item.fStats.sum, item.column.name)}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    {formatDataValue(item.fStats.mean, item.column.name)}
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-500">
                    ±{item.fStats.stdDev.toFixed(1)}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    {formatDataValue(item.fStats.min, item.column.name)}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    {formatDataValue(item.percentiles[25], item.column.name)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold text-red-600">
                    {formatDataValue(item.fStats.median, item.column.name)}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    {formatDataValue(item.percentiles[75], item.column.name)}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    {formatDataValue(item.percentiles[90], item.column.name)}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    {formatDataValue(item.fStats.max, item.column.name)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-sans">
                    <button
                      onClick={() => onSelectMetricForVisualizer(item.column.name)}
                      className="text-[#ff4b4b] hover:text-red-700 font-semibold text-[11px] underline cursor-pointer"
                    >
                      Plot Trend
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
