import React, { useState, useMemo } from 'react';
import { ColumnMeta, ChartConfig, FilterState } from '../types';
import { generateStreamlitPythonScript } from '../utils/stats';
import { exportRowsToCsv } from '../utils/csvParser';
import {
  Code,
  Copy,
  Check,
  Download,
  Terminal,
  Sparkles,
  FileCode,
  FileSpreadsheet,
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Wand2,
} from 'lucide-react';

interface StreamlitCodeTabProps {
  datasetName: string;
  columns: ColumnMeta[];
  config: ChartConfig;
  filters: FilterState;
  filteredRows: Record<string, any>[];
  rawCsv?: string;
}

export const StreamlitCodeTab: React.FC<StreamlitCodeTabProps> = ({
  datasetName,
  columns,
  config,
  filters,
  filteredRows,
  rawCsv,
}) => {
  const [activeCodeMode, setActiveCodeMode] = useState<'standard' | 'ai'>('standard');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedReqs, setCopiedReqs] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const [aiGeneratedCode, setAiGeneratedCode] = useState<string | null>(null);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const activeFilterCount = useMemo(() => {
    return (
      (filters.searchQuery ? 1 : 0) +
      Object.keys(filters.numericRanges).length +
      Object.keys(filters.categoricalSelections).length +
      filters.customRules.length
    );
  }, [filters]);

  // Generate 100% error-free standard Streamlit script
  const standardPythonCode = useMemo(() => {
    return generateStreamlitPythonScript({
      datasetName,
      xAxis: config.xAxis,
      yAxis: config.yAxis,
      chartType: config.type,
      movingAverageWindow: config.movingAverageWindow,
      anomalyThreshold: config.anomalyThreshold,
      filterCount: activeFilterCount,
      sampleRows: filteredRows.slice(0, 50),
      rawCsv,
    });
  }, [datasetName, config, activeFilterCount, filteredRows, rawCsv]);

  // Code currently displayed based on active tab
  const activeCode = activeCodeMode === 'ai' && aiGeneratedCode ? aiGeneratedCode : standardPythonCode;

  const requirementsTxt = `streamlit>=1.35.0
pandas>=2.2.0
numpy>=1.26.0
plotly>=5.22.0
statsmodels>=0.14.0`;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(activeCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyReqs = () => {
    navigator.clipboard.writeText(requirementsTxt);
    setCopiedReqs(true);
    setTimeout(() => setCopiedReqs(false), 2000);
  };

  const handleDownloadApp = () => {
    const blob = new Blob([activeCode], { type: 'text/x-python;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'app.py';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadReqs = () => {
    const blob = new Blob([requirementsTxt], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'requirements.txt';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadCsv = () => {
    const csvStr = rawCsv || exportRowsToCsv(filteredRows);
    const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'dataset.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  // Generate customized Streamlit app using Gemini AI
  const handleGenerateAiCode = async (instructions?: string) => {
    const promptToUse = instructions || customPrompt;
    setIsGeneratingAi(true);
    setAiError(null);

    try {
      const res = await fetch('/api/ai/generate-streamlit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          datasetName,
          columns,
          currentConfig: config,
          sampleRows: filteredRows.slice(0, 10),
          userInstructions: promptToUse.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP error ${res.status}`);
      }

      const data = await res.json();
      if (!data.code) throw new Error('No code returned from AI');

      setAiGeneratedCode(data.code);
      setActiveCodeMode('ai');
    } catch (err: any) {
      setAiError(err.message || 'Failed to generate custom Streamlit code.');
    } finally {
      setIsGeneratingAi(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Intro Header & Action Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200/90 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-50 text-[#ff4b4b] flex items-center justify-center font-bold shrink-0">
            <FileCode className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span>Streamlit Python Code Generator</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-red-100 text-red-700 font-mono font-bold">
                app.py
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              100% executable Python code. Embedded sample data runs instantly with zero configuration.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <button
            onClick={handleCopyCode}
            className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors cursor-pointer"
          >
            {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedCode ? 'Copied' : 'Copy app.py'}</span>
          </button>

          <button
            onClick={handleDownloadApp}
            className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#ff4b4b] hover:bg-red-600 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download app.py</span>
          </button>

          <button
            onClick={handleDownloadCsv}
            className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-semibold transition-colors cursor-pointer"
            title="Download CSV dataset to use locally"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>dataset.csv</span>
          </button>
        </div>
      </div>

      {/* Code Version Switcher (Standard vs AI Customized) */}
      <div className="bg-white p-3 rounded-xl border border-slate-200/90 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveCodeMode('standard')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeCodeMode === 'standard'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:text-slate-900'
            }`}
          >
            ⚡ Pure Standalone App (Guaranteed Error-Free)
          </button>
          <button
            onClick={() => {
              if (!aiGeneratedCode) {
                handleGenerateAiCode();
              } else {
                setActiveCodeMode('ai');
              }
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeCodeMode === 'ai'
                ? 'bg-[#ff4b4b] text-white shadow-xs'
                : 'bg-red-50 text-[#ff4b4b] hover:bg-red-100'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>🤖 AI-Customized App</span>
            {aiGeneratedCode && <span className="w-1.5 h-1.5 rounded-full bg-white ml-0.5"></span>}
          </button>
        </div>

        <div className="flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Python 3.10+ verified • No external file required</span>
        </div>
      </div>

      {/* AI Custom Prompt Bar (Expands when customizing) */}
      <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/90">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="relative flex-1">
            <Wand2 className="w-4 h-4 text-[#ff4b4b] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Ask Gemini to customize code (e.g. 'Add forecasting model', 'Add Excel export', 'Use dark theme')..."
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleGenerateAiCode()}
              className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-red-500 focus:outline-none"
            />
          </div>

          <button
            onClick={() => handleGenerateAiCode()}
            disabled={isGeneratingAi}
            className="flex items-center justify-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white rounded-lg text-xs font-semibold transition-all cursor-pointer"
          >
            {isGeneratingAi ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Generating...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-red-400" />
                <span>Generate with AI</span>
              </>
            )}
          </button>
        </div>

        {/* Quick Suggestion Pills */}
        <div className="flex flex-wrap items-center gap-1.5 mt-2.5 pt-2 border-t border-slate-200/60 text-[11px]">
          <span className="text-slate-400 font-medium">Quick Prompts:</span>
          {[
            'Add Excel (.xlsx) export button',
            'Add linear regression future forecasting',
            'Add sidebar date range filter',
            'Add dark mode Plotly theme',
          ].map((prompt, i) => (
            <button
              key={i}
              onClick={() => {
                setCustomPrompt(prompt);
                handleGenerateAiCode(prompt);
              }}
              className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300 transition-colors cursor-pointer"
            >
              {prompt}
            </button>
          ))}
        </div>

        {aiError && (
          <div className="mt-2 text-xs text-red-600 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{aiError}</span>
          </div>
        )}
      </div>

      {/* Code Editor Window */}
      <div className="bg-slate-950 rounded-xl border border-slate-800 shadow-md overflow-hidden">
        {/* Terminal Header */}
        <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-red-500 inline-block"></span>
              <span className="w-3 h-3 rounded-full bg-amber-500 inline-block"></span>
              <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block"></span>
            </div>
            <span className="text-xs font-mono text-slate-300 ml-2 font-semibold">app.py</span>
            <span className="text-[10px] font-mono px-2 py-0.2 rounded bg-slate-800 text-slate-400">
              {activeCodeMode === 'ai' ? 'AI Enhanced' : 'Standard Standalone'}
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono text-slate-400">
            <span>Python 3.10+</span>
            <span>Streamlit 1.35+</span>
          </div>
        </div>

        {/* Code Content */}
        <div className="p-4 overflow-x-auto max-h-[520px] custom-scrollbar">
          <pre className="text-xs font-mono text-emerald-400/90 leading-relaxed whitespace-pre selection:bg-emerald-800 selection:text-white">
            {activeCode}
          </pre>
        </div>
      </div>

      {/* Run Instructions & requirements.txt */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Run in Terminal */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2 text-slate-800 font-bold text-xs">
              <Terminal className="w-4 h-4 text-[#ff4b4b]" />
              <span>How to Run Locally (2 Steps)</span>
            </div>
            <div className="space-y-2.5 text-xs text-slate-600">
              <div>
                <p className="font-medium text-slate-700 mb-1">1. Install dependencies:</p>
                <div className="bg-slate-900 text-slate-200 font-mono text-[11px] px-3 py-2 rounded-lg flex items-center justify-between">
                  <code>pip install streamlit pandas numpy plotly</code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText('pip install streamlit pandas numpy plotly');
                      alert('Command copied!');
                    }}
                    className="text-slate-400 hover:text-white p-0.5 cursor-pointer"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <div>
                <p className="font-medium text-slate-700 mb-1">2. Launch your Streamlit application:</p>
                <div className="bg-slate-900 text-slate-200 font-mono text-[11px] px-3 py-2 rounded-lg flex items-center justify-between">
                  <code>streamlit run app.py</code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText('streamlit run app.py');
                      alert('Command copied!');
                    }}
                    className="text-slate-400 hover:text-white p-0.5 cursor-pointer"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-500">
            💡 The script automatically embeds demo data so it runs immediately even without local files!
          </div>
        </div>

        {/* requirements.txt */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2 text-slate-800 font-bold text-xs">
              <span className="flex items-center gap-2">
                <Code className="w-4 h-4 text-sky-500" />
                <span>requirements.txt</span>
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleCopyReqs}
                  className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded cursor-pointer"
                  title="Copy requirements.txt"
                >
                  {copiedReqs ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={handleDownloadReqs}
                  className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded cursor-pointer"
                  title="Download requirements.txt"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <pre className="bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-xs font-mono text-slate-700">
              {requirementsTxt}
            </pre>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-500">
            📦 Tested with Streamlit 1.35+ and Pandas 2.2+.
          </div>
        </div>
      </div>
    </div>
  );
};
