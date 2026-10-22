import React, { useState } from 'react';
import { ColumnMeta } from '../types';
import { Sparkles, BrainCircuit, RefreshCw, Copy, Check, FileText, AlertCircle } from 'lucide-react';

interface AiAnalysisTabProps {
  columns: ColumnMeta[];
  filteredRows: Record<string, any>[];
  targetMetricCol: string;
  timeCol?: string;
}

export const AiAnalysisTab: React.FC<AiAnalysisTabProps> = ({
  columns,
  filteredRows,
  targetMetricCol,
  timeCol,
}) => {
  const [analysisText, setAnalysisText] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userPrompt, setUserPrompt] = useState('');
  const [copied, setCopied] = useState(false);

  const handleGenerateAnalysis = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Prepare compact schema and numeric summary
      const schema = columns.map((c) => ({
        name: c.name,
        type: c.type,
        min: c.min,
        max: c.max,
        mean: c.mean,
        sample: c.sampleValues?.slice(0, 3),
      }));

      const numericCols = columns.filter((c) => c.type === 'number');
      const numericMetrics: Record<string, any> = {};
      numericCols.forEach((c) => {
        const vals = filteredRows.map((r) => Number(r[c.name])).filter((v) => !isNaN(v) && isFinite(v));
        if (vals.length) {
          let sum = 0;
          let min = vals[0];
          let max = vals[0];
          for (let i = 0; i < vals.length; i++) {
            const v = vals[i];
            sum += v;
            if (v < min) min = v;
            if (v > max) max = v;
          }
          numericMetrics[c.name] = {
            count: vals.length,
            sum: Number(sum.toFixed(2)),
            mean: Number((sum / vals.length).toFixed(2)),
            min: Number(min.toFixed(2)),
            max: Number(max.toFixed(2)),
          };
        }
      });

      const summaryStats = {
        rowCount: filteredRows.length,
        numericMetrics,
      };

      const sampleData = filteredRows.slice(0, 6);

      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schema,
          sampleData,
          summaryStats,
          userPrompt: userPrompt.trim() || undefined,
          targetColumn: targetMetricCol,
          timeColumn: timeCol,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Request failed with status ${res.status}`);
      }

      const data = await res.json();
      setAnalysisText(data.text);
    } catch (err: any) {
      setError(err.message || 'Failed to generate trend analysis.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (!analysisText) return;
    navigator.clipboard.writeText(analysisText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Action Header Card */}
      <div className="bg-gradient-to-r from-red-950 via-slate-900 to-slate-900 text-white rounded-xl p-4 sm:p-6 border border-red-900/40 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="max-w-xl">
            <div className="flex items-center gap-2 mb-1.5 sm:mb-2">
              <span className="p-1.5 rounded-lg bg-red-600/30 border border-red-500/40 text-red-400">
                <BrainCircuit className="w-4 h-4 sm:w-5 sm:h-5" />
              </span>
              <h2 className="text-base sm:text-lg font-bold tracking-tight">Gemini AI Trend Intelligence</h2>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Synthesize multi-dimensional patterns, identify inflection points, calculate statistical growth vectors, and detect anomalies across {filteredRows.length.toLocaleString()} active rows.
            </p>
          </div>

          <button
            onClick={handleGenerateAnalysis}
            disabled={isLoading || filteredRows.length === 0}
            className="flex items-center justify-center gap-2 bg-[#ff4b4b] hover:bg-[#e03a3a] disabled:opacity-50 text-white px-4 sm:px-5 py-2.5 rounded-lg font-semibold text-xs transition-all shadow-md cursor-pointer shrink-0 w-full sm:w-auto"
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Synthesizing Insights...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Generate Deep Analysis</span>
              </>
            )}
          </button>
        </div>

        {/* Custom prompt focus bar */}
        <div className="mt-3.5 sm:mt-4 pt-3.5 sm:pt-4 border-t border-slate-800 flex items-center gap-3">
          <input
            type="text"
            placeholder="Optional custom focus (e.g. 'Evaluate churn spike in August' or 'Compare North vs South profitability')..."
            value={userPrompt}
            onChange={(e) => setUserPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleGenerateAnalysis()}
            className="flex-1 bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-400 focus:outline-none focus:border-red-500"
          />
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-start gap-3">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold mb-0.5">Analysis Request Failed</div>
            <div>{error}</div>
          </div>
        </div>
      )}

      {/* Loading state skeleton */}
      {isLoading && (
        <div className="bg-white rounded-xl border border-slate-200 p-8 space-y-4 animate-pulse">
          <div className="h-4 bg-slate-200 rounded w-1/3"></div>
          <div className="h-3 bg-slate-100 rounded w-full"></div>
          <div className="h-3 bg-slate-100 rounded w-5/6"></div>
          <div className="h-4 bg-slate-200 rounded w-1/4 pt-4"></div>
          <div className="h-3 bg-slate-100 rounded w-full"></div>
          <div className="h-3 bg-slate-100 rounded w-4/6"></div>
        </div>
      )}

      {/* Rendered Analysis */}
      {analysisText && !isLoading && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 relative">
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
            <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
              <FileText className="w-4 h-4 text-red-500" />
              <span>Report generated by Gemini 3.8 Flash • {new Date().toLocaleTimeString()}</span>
            </div>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 bg-slate-100 px-3 py-1.5 rounded-lg transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied Markdown' : 'Copy Report'}</span>
            </button>
          </div>

          {/* Formatted Markdown Content */}
          <div className="prose prose-sm max-w-none text-slate-700 leading-relaxed space-y-3">
            {analysisText.split('\n\n').map((paragraph, idx) => {
              if (paragraph.startsWith('###')) {
                return (
                  <h3 key={idx} className="text-base font-bold text-slate-900 border-b border-slate-100 pb-1.5 pt-3">
                    {paragraph.replace(/^###\s*/, '')}
                  </h3>
                );
              }
              if (paragraph.startsWith('##')) {
                return (
                  <h2 key={idx} className="text-lg font-bold text-slate-900 pt-3">
                    {paragraph.replace(/^##\s*/, '')}
                  </h2>
                );
              }
              if (paragraph.startsWith('- ') || paragraph.startsWith('* ')) {
                const items = paragraph.split('\n').filter(Boolean);
                return (
                  <ul key={idx} className="list-disc pl-5 space-y-1 text-xs">
                    {items.map((item, i) => (
                      <li key={i}>{item.replace(/^[-*]\s*/, '')}</li>
                    ))}
                  </ul>
                );
              }
              return (
                <p key={idx} className="text-xs text-slate-700">
                  {paragraph}
                </p>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty State Prompt */}
      {!analysisText && !isLoading && !error && (
        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-8 text-center">
          <Sparkles className="w-8 h-8 text-red-500 mx-auto mb-2 opacity-80" />
          <h3 className="text-sm font-semibold text-slate-800">No Analysis Generated Yet</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4">
            Click &quot;Generate Deep Analysis&quot; above to have Gemini inspect the statistical distribution, regression trends, and anomalies of your current filtered data.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {[
              'Evaluate growth drivers and momentum',
              'Detect negative anomalies and outliers',
              'Predict next period trajectory',
            ].map((preset) => (
              <button
                key={preset}
                onClick={() => {
                  setUserPrompt(preset);
                }}
                className="text-xs bg-white border border-slate-200 hover:border-red-400 text-slate-600 px-3 py-1.5 rounded-full transition-colors cursor-pointer"
              >
                &ldquo;{preset}&rdquo;
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
