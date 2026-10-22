import React, { useMemo } from 'react';
import { ColumnMeta } from '../types';
import { calculateBasicStats, formatDataValue } from '../utils/stats';
import { ArrowUpRight, ArrowDownRight, Layers, DollarSign, Activity, Zap } from 'lucide-react';

interface MetricCardsProps {
  totalRows: number;
  filteredRows: Record<string, any>[];
  targetMetricCol: string;
  columns: ColumnMeta[];
}

export const MetricCards: React.FC<MetricCardsProps> = ({
  totalRows,
  filteredRows,
  targetMetricCol,
  columns,
}) => {
  const currentCount = filteredRows.length;
  const countDelta = totalRows > 0 ? ((currentCount - totalRows) / totalRows) * 100 : 0;

  // Extract numeric values for primary target metric
  const numericValues = useMemo(() => {
    return filteredRows
      .map((r) => Number(r[targetMetricCol]))
      .filter((v) => !isNaN(v) && v !== null);
  }, [filteredRows, targetMetricCol]);

  const stats = useMemo(() => calculateBasicStats(numericValues), [numericValues]);

  // Calculate period-over-period delta (comparing first 50% of filtered data vs last 50%)
  const periodDelta = useMemo(() => {
    if (numericValues.length < 4) return { changePct: 0, isPositive: true };
    const half = Math.floor(numericValues.length / 2);
    const firstHalfAvg =
      numericValues.slice(0, half).reduce((a, b) => a + b, 0) / half || 1;
    const secondHalfAvg =
      numericValues.slice(half).reduce((a, b) => a + b, 0) / (numericValues.length - half) || 1;

    const changePct = ((secondHalfAvg - firstHalfAvg) / Math.abs(firstHalfAvg)) * 100;
    return {
      changePct: Number(changePct.toFixed(1)),
      isPositive: changePct >= 0,
    };
  }, [numericValues]);

  // Mini sparkline points
  const sparklinePoints = useMemo(() => {
    if (numericValues.length < 3) return '';
    // Sample 20 points
    const step = Math.max(1, Math.floor(numericValues.length / 20));
    const sampled = numericValues.filter((_, i) => i % step === 0).slice(0, 20);
    const min = Math.min(...sampled);
    const max = Math.max(...sampled);
    const span = max - min || 1;

    return sampled
      .map((val, i) => {
        const x = (i / (sampled.length - 1)) * 64;
        const y = 24 - ((val - min) / span) * 20;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }, [numericValues]);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
      {/* Metric 1: Record Count & Filter Ratio */}
      <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200/90 shadow-xs hover:border-slate-300 transition-all">
        <div className="flex items-center justify-between text-[11px] sm:text-xs font-medium text-slate-500 mb-1">
          <span className="flex items-center gap-1 sm:gap-1.5 truncate">
            <Layers className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate">Records</span>
          </span>
          <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-1 sm:px-1.5 py-0.2 rounded shrink-0">
            {((currentCount / (totalRows || 1)) * 100).toFixed(0)}%
          </span>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-lg sm:text-2xl font-bold tracking-tight text-slate-900">
            {currentCount.toLocaleString()}
          </span>
          <span className="text-[10px] sm:text-xs text-slate-400 font-mono hidden sm:inline">/ {totalRows.toLocaleString()}</span>
        </div>
        <div className="mt-1.5 sm:mt-2 text-[10px] sm:text-xs flex items-center gap-1">
          {countDelta === 0 ? (
            <span className="text-slate-500 truncate">100% visible</span>
          ) : (
            <span className="text-amber-600 font-medium truncate">
              {Math.abs(currentCount - totalRows)} excluded
            </span>
          )}
        </div>
      </div>

      {/* Metric 2: Total Aggregate for Selected Y-Axis Metric */}
      <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200/90 shadow-xs hover:border-slate-300 transition-all">
        <div className="flex items-center justify-between text-[11px] sm:text-xs font-medium text-slate-500 mb-1">
          <span className="flex items-center gap-1 sm:gap-1.5 truncate">
            <DollarSign className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span className="truncate">Total {targetMetricCol}</span>
          </span>
          {/* Mini sparkline */}
          {sparklinePoints && (
            <svg className="w-10 sm:w-16 h-5 sm:h-6 overflow-visible shrink-0">
              <polyline
                fill="none"
                stroke={periodDelta.isPositive ? '#10b981' : '#ef4444'}
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={sparklinePoints}
              />
            </svg>
          )}
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-lg sm:text-2xl font-bold tracking-tight text-slate-900 truncate">
            {formatDataValue(stats.sum, targetMetricCol)}
          </span>
        </div>
        <div className="mt-1.5 sm:mt-2 text-[10px] sm:text-xs flex items-center gap-1">
          <span
            className={`font-semibold flex items-center px-1 sm:px-1.5 py-0.2 rounded text-[10px] sm:text-[11px] ${
              periodDelta.isPositive
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-red-50 text-red-700'
            }`}
          >
            {periodDelta.isPositive ? (
              <ArrowUpRight className="w-3 h-3 mr-0.5" />
            ) : (
              <ArrowDownRight className="w-3 h-3 mr-0.5" />
            )}
            {periodDelta.isPositive ? '+' : ''}
            {periodDelta.changePct}%
          </span>
          <span className="text-slate-400 text-[10px] hidden sm:inline">trend</span>
        </div>
      </div>

      {/* Metric 3: Average / Mean Value */}
      <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200/90 shadow-xs hover:border-slate-300 transition-all">
        <div className="flex items-center justify-between text-[11px] sm:text-xs font-medium text-slate-500 mb-1">
          <span className="flex items-center gap-1 sm:gap-1.5 truncate">
            <Activity className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            <span className="truncate">Average</span>
          </span>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-lg sm:text-2xl font-bold tracking-tight text-slate-900 truncate">
            {formatDataValue(stats.mean, targetMetricCol)}
          </span>
        </div>
        <div className="mt-1.5 sm:mt-2 text-[10px] sm:text-xs text-slate-500 flex items-center gap-1">
          <span>StdDev:</span>
          <strong className="font-mono text-slate-700">±{stats.stdDev.toFixed(1)}</strong>
        </div>
      </div>

      {/* Metric 4: Peak & Dynamic Range */}
      <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200/90 shadow-xs hover:border-slate-300 transition-all">
        <div className="flex items-center justify-between text-[11px] sm:text-xs font-medium text-slate-500 mb-1">
          <span className="flex items-center gap-1 sm:gap-1.5 truncate">
            <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span className="truncate">Peak (Max)</span>
          </span>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-lg sm:text-2xl font-bold tracking-tight text-slate-900 truncate">
            {formatDataValue(stats.max, targetMetricCol)}
          </span>
        </div>
        <div className="mt-1.5 sm:mt-2 text-[10px] sm:text-xs text-slate-500 flex items-center gap-1">
          <span>Min:</span>
          <strong className="font-mono text-slate-700 truncate">{formatDataValue(stats.min, targetMetricCol)}</strong>
        </div>
      </div>
    </div>
  );
};
