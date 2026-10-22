import React, { useMemo } from 'react';
import { ColumnMeta, CorrelationItem } from '../types';
import { computeCorrelationMatrix, detectAnomaliesInSeries, formatDataValue } from '../utils/stats';
import { AlertTriangle, GitCompare, ArrowUpRight, ArrowDownRight, Info } from 'lucide-react';

interface CorrelationTabProps {
  columns: ColumnMeta[];
  filteredRows: Record<string, any>[];
  targetMetricCol: string;
  timeCol?: string;
}

export const CorrelationTab: React.FC<CorrelationTabProps> = ({
  columns,
  filteredRows,
  targetMetricCol,
  timeCol,
}) => {
  const numericCols = useMemo(() => columns.filter((c) => c.type === 'number'), [columns]);
  const numColNames = useMemo(() => numericCols.map((c) => c.name), [numericCols]);

  // Compute correlation matrix
  const correlations = useMemo(() => {
    if (numericCols.length < 2 || filteredRows.length < 3) return [];
    return computeCorrelationMatrix(filteredRows, numColNames);
  }, [filteredRows, numColNames, numericCols.length]);

  // Find top correlations (excluding diagonal 1.0)
  const topCorrelations = useMemo(() => {
    return correlations
      .filter((c) => c.colA !== c.colB)
      .sort((a, b) => Math.abs(b.r) - Math.abs(a.r))
      .slice(0, 6);
  }, [correlations]);

  // Anomaly points across the primary target metric
  const anomalies = useMemo(() => {
    if (!targetMetricCol || filteredRows.length < 5) return [];
    const series = filteredRows.map((r, i) => ({
      x: timeCol ? r[timeCol] : `Row #${i + 1}`,
      y: Number(r[targetMetricCol]) || 0,
      originalRow: r,
    }));
    return detectAnomaliesInSeries(series, 2.0);
  }, [filteredRows, targetMetricCol, timeCol]);

  // Color helper for correlation heat (-1.0 to +1.0)
  const getCorrelationColor = (r: number) => {
    if (r === 1) return 'bg-slate-100 text-slate-800 font-bold';
    if (r >= 0.7) return 'bg-red-500 text-white font-bold';
    if (r >= 0.4) return 'bg-red-300 text-red-950 font-semibold';
    if (r >= 0.1) return 'bg-red-100 text-red-900';
    if (r > -0.1) return 'bg-slate-50 text-slate-500';
    if (r > -0.4) return 'bg-blue-100 text-blue-900';
    if (r > -0.7) return 'bg-blue-300 text-blue-950 font-semibold';
    return 'bg-blue-600 text-white font-bold';
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Top Correlation Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 sm:gap-4">
        {topCorrelations.slice(0, 3).map((item, idx) => {
          const isPos = item.r >= 0;
          return (
            <div
              key={idx}
              className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200/90 shadow-xs flex items-center justify-between"
            >
              <div className="min-w-0 pr-2">
                <span className="text-[10px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-wider block truncate">
                  {Math.abs(item.r) > 0.7 ? 'Strong' : 'Moderate'}{' '}
                  {isPos ? 'Positive' : 'Negative'} Pair
                </span>
                <div className="text-xs font-bold text-slate-800 mt-0.5 truncate">
                  {item.colA} <span className="text-slate-400 font-normal">vs</span> {item.colB}
                </div>
              </div>
              <div
                className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg text-xs sm:text-sm font-mono font-bold flex items-center gap-1 shrink-0 ${
                  isPos ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'
                }`}
              >
                {isPos ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                {item.r.toFixed(2)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Pearson Correlation Grid Matrix */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm p-3.5 sm:p-6 overflow-x-auto custom-scrollbar">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <GitCompare className="w-4 h-4 text-red-500" />
            <h3 className="font-bold text-slate-800 text-sm">Pearson Correlation Matrix</h3>
          </div>
          <div className="flex items-center gap-2.5 text-[10px] sm:text-[11px] text-slate-500">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 bg-blue-500 rounded-xs inline-block"></span> -1.0 Negative
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 bg-slate-100 border border-slate-200 rounded-xs inline-block"></span> 0 Neutral
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 bg-red-500 rounded-xs inline-block"></span> +1.0 Positive
            </span>
          </div>
        </div>

        {numericCols.length < 2 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            At least 2 numeric columns are required to calculate correlations.
          </div>
        ) : (
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr>
                <th className="p-2 border border-slate-200 bg-slate-50 text-left text-slate-500 font-medium"></th>
                {numColNames.map((col) => (
                  <th
                    key={col}
                    className="p-2 border border-slate-200 bg-slate-50 text-slate-700 font-semibold text-center truncate max-w-[120px]"
                    title={col}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {numColNames.map((rowCol) => (
                <tr key={rowCol}>
                  <td
                    className="p-2 border border-slate-200 bg-slate-50 text-slate-700 font-semibold text-left truncate max-w-[140px]"
                    title={rowCol}
                  >
                    {rowCol}
                  </td>
                  {numColNames.map((colCol) => {
                    const match = correlations.find(
                      (c) =>
                        (c.colA === rowCol && c.colB === colCol) ||
                        (c.colA === colCol && c.colB === rowCol)
                    );
                    const rVal = match ? match.r : rowCol === colCol ? 1 : 0;
                    return (
                      <td
                        key={colCol}
                        className={`p-2 border border-slate-200 text-center font-mono transition-colors ${getCorrelationColor(
                          rVal
                        )}`}
                      >
                        {rVal.toFixed(2)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Anomaly Watch Table */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <h3 className="font-bold text-slate-800 text-sm">
              Statistical Anomaly & Outlier Watch ({targetMetricCol})
            </h3>
          </div>
          <span className="text-xs text-slate-500">
            Flags points with <span className="font-mono text-red-600 font-semibold">|Z| &gt; 2.0σ</span> deviation
          </span>
        </div>

        {anomalies.length === 0 ? (
          <div className="p-8 text-center text-xs text-emerald-600 bg-emerald-50/50 rounded-lg border border-emerald-100 flex items-center justify-center gap-2">
            <Info className="w-4 h-4" />
            <span>No significant outliers detected in the current filtered series. Distribution is stable.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 text-left font-medium">
                  <th className="py-2.5 px-3">Timeline / Row</th>
                  <th className="py-2.5 px-3">Observed Value</th>
                  <th className="py-2.5 px-3">Expected Baseline (Mean)</th>
                  <th className="py-2.5 px-3">Z-Score (Sigma)</th>
                  <th className="py-2.5 px-3">Severity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {anomalies.map((anom, idx) => {
                  const isSevere = Math.abs(anom.zScore) >= 2.5;
                  return (
                    <tr key={idx} className="hover:bg-red-50/40 transition-colors">
                      <td className="py-2.5 px-3 font-semibold text-slate-700">
                        {String(anom.xValue)}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-red-600">
                        {formatDataValue(anom.yValue, targetMetricCol)}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500">
                        {formatDataValue(anom.expectedValue, targetMetricCol)}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                            anom.zScore > 0
                              ? 'bg-red-100 text-red-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}
                        >
                          {anom.zScore > 0 ? '+' : ''}
                          {anom.zScore}σ
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`text-[10px] font-sans font-semibold uppercase px-2 py-0.5 rounded ${
                            isSevere
                              ? 'bg-red-600 text-white'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {isSevere ? 'Critical Spike' : 'Warning Outlier'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
