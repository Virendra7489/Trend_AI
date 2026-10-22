import React, { useState } from 'react';
import { ColumnMeta, ChartConfig, FilterState, CustomFilterRule } from '../types';
import { Sparkles, X, ArrowRight, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

interface NaturalQueryModalProps {
  isOpen: boolean;
  onClose: () => void;
  columns: ColumnMeta[];
  onApplyQuery: (result: {
    filters: Partial<FilterState>;
    chartConfig?: Partial<ChartConfig>;
    explanation: string;
  }) => void;
}

export const NaturalQueryModal: React.FC<NaturalQueryModalProps> = ({
  isOpen,
  onClose,
  columns,
  onApplyQuery,
}) => {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleInterpretQuery = async (queryText: string) => {
    if (!queryText.trim()) return;
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/ai/nl-filter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          naturalQuery: queryText.trim(),
          columns: columns.map((c) => ({
            name: c.name,
            type: c.type,
            uniqueValues: c.uniqueValues?.slice(0, 10),
          })),
        }),
      });

      if (!res.ok) {
        throw new Error('Could not translate natural language query');
      }

      const data = await res.json();

      // Convert returned filters to state
      const customRules: CustomFilterRule[] = [];
      const categoricalSelections: Record<string, string[]> = {};
      const numericRanges: Record<string, [number, number]> = {};

      if (Array.isArray(data.filters)) {
        for (const f of data.filters) {
          const colMeta = columns.find((c) => c.name.toLowerCase() === f.column?.toLowerCase());
          const targetColName = colMeta ? colMeta.name : f.column;

          if (colMeta?.type === 'number' && typeof f.value === 'number') {
            if (f.operator === '>=' || f.operator === '>') {
              numericRanges[targetColName] = [f.value, colMeta.max || f.value * 2];
            } else if (f.operator === '<=' || f.operator === '<') {
              numericRanges[targetColName] = [colMeta.min || 0, f.value];
            } else {
              customRules.push({
                id: Math.random().toString(36).substring(2, 9),
                column: targetColName,
                operator: f.operator,
                value: f.value,
              });
            }
          } else if (colMeta?.type === 'string' && f.operator === '==') {
            categoricalSelections[targetColName] = [String(f.value)];
          } else {
            customRules.push({
              id: Math.random().toString(36).substring(2, 9),
              column: targetColName,
              operator: f.operator || '==',
              value: f.value,
            });
          }
        }
      }

      const chartConfig: Partial<ChartConfig> = {};
      if (data.suggestedChartType) chartConfig.type = data.suggestedChartType;
      if (data.suggestedX && columns.some((c) => c.name === data.suggestedX)) {
        chartConfig.xAxis = data.suggestedX;
      }
      if (data.suggestedY && columns.some((c) => c.name === data.suggestedY)) {
        chartConfig.yAxis = data.suggestedY;
      }

      onApplyQuery({
        filters: {
          customRules,
          categoricalSelections,
          numericRanges,
        },
        chartConfig,
        explanation: data.explanation || `Applied query: "${queryText}"`,
      });

      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to interpret prompt');
    } finally {
      setIsLoading(false);
    }
  };

  const sampleQueries = [
    'Filter where profit is greater than 500 and plot profit over time',
    'Show only North region and group by Category',
    'Show anomalies in telemetry CPU above 80%',
    'Filter where CAC is under 200 and plot MRR growth',
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-4 sm:p-6 shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto custom-scrollbar">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-red-100 text-red-600">
              <Sparkles className="w-4 h-4" />
            </span>
            <h3 className="font-bold text-slate-800 text-sm">Natural Language Query-to-Filter</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-500 mt-2 mb-4">
          Describe the data slice and chart you want in plain words. TrendAI will configure the filters, axes, and visualizations automatically.
        </p>

        {error && (
          <div className="mb-3 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleInterpretQuery(query);
          }}
          className="space-y-4"
        >
          <div className="relative">
            <textarea
              rows={3}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. Show records with sales > 1000 in North region, plot sales trend as an area chart..."
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
            />
          </div>

          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Quick Suggestions
            </span>
            <div className="flex flex-col gap-1.5">
              {sampleQueries.map((sq, i) => (
                <button
                  type="button"
                  key={i}
                  onClick={() => {
                    setQuery(sq);
                    handleInterpretQuery(sq);
                  }}
                  className="text-left text-xs bg-slate-50 hover:bg-red-50 hover:text-red-700 text-slate-600 px-3 py-2 rounded-lg border border-slate-200/80 transition-colors flex items-center justify-between group"
                >
                  <span>&ldquo;{sq}&rdquo;</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!query.trim() || isLoading}
              className="flex items-center gap-2 bg-[#ff4b4b] hover:bg-[#e03a3a] disabled:opacity-50 text-white px-5 py-2 rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Configuring Dashboard...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Apply with AI</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
