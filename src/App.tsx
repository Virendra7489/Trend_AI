/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { Dataset, FilterState, ChartConfig } from './types';
import { SAMPLE_DATASETS, SampleDatasetDefinition } from './data/sampleDatasets';
import { parseCsvContent, applyFiltersToDataset, exportRowsToCsv } from './utils/csvParser';
import { Sidebar } from './components/Sidebar';
import { MetricCards } from './components/MetricCards';
import { TrendVisualizer } from './components/TrendVisualizer';
import { DataTableTab } from './components/DataTableTab';
import { AiAnalysisTab } from './components/AiAnalysisTab';
import { CorrelationTab } from './components/CorrelationTab';
import { AiChatDrawer } from './components/AiChatDrawer';
import { MultiMetricDashboard } from './components/MultiMetricDashboard';
import { StreamlitCodeTab } from './components/StreamlitCodeTab';
import { NaturalQueryModal } from './components/NaturalQueryModal';
import {
  TrendingUp,
  Table,
  Sparkles,
  GitCompare,
  MessageSquare,
  CheckCircle2,
  X,
  Menu,
  SlidersHorizontal,
  ChevronRight,
  ChevronLeft,
  BarChart2,
  FileCode,
  Zap,
  Activity,
  Layers,
} from 'lucide-react';

const INITIAL_FILTERS: FilterState = {
  searchQuery: '',
  numericRanges: {},
  categoricalSelections: {},
  dateRanges: {},
  customRules: [],
};

export default function App() {
  // Initialize with SaaS sample dataset
  const [dataset, setDataset] = useState<Dataset>(() => {
    return parseCsvContent(SAMPLE_DATASETS[0].csv, SAMPLE_DATASETS[0].name);
  });

  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);

  // Chart configuration state
  const [chartConfig, setChartConfig] = useState<ChartConfig>(() => {
    const ds = SAMPLE_DATASETS[0];
    return {
      type: 'line',
      xAxis: ds.defaultX,
      yAxis: ds.defaultY,
      groupBy: ds.defaultGroupBy,
      aggregation: 'none',
      showTrendline: true,
      showMovingAverage: true,
      movingAverageWindow: 7,
      showConfidenceBand: true,
      detectAnomalies: true,
      anomalyThreshold: 2.0,
    };
  });

  const [activeTab, setActiveTab] = useState<'visualizer' | 'multi_metrics' | 'data' | 'ai' | 'correlations' | 'code'>('visualizer');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isNlModalOpen, setIsNlModalOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [appliedAiQueryMessage, setAppliedAiQueryMessage] = useState<string | null>(null);
  const [hasApiKey, setHasApiKey] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [lastExecutionTimeMs, setLastExecutionTimeMs] = useState(0.8);

  // Auto-adapt sidebar state for initial screen width
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Performance timer simulating Streamlit reactive calculation runner
  useEffect(() => {
    const t0 = performance.now();
    setIsRunning(true);
    const timer = setTimeout(() => {
      const elapsed = Math.max(0.4, Number((performance.now() - t0).toFixed(1)));
      setLastExecutionTimeMs(elapsed);
      setIsRunning(false);
    }, 120);
    return () => clearTimeout(timer);
  }, [filters, dataset, chartConfig.yAxis, chartConfig.xAxis]);

  // Check health and API key on mount
  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => {
        setHasApiKey(data.hasApiKey !== false);
      })
      .catch(() => {});
  }, []);

  // Quick Preset Filter Handler
  const handleApplyPreset = (preset: 'all' | 'top10' | 'above_avg') => {
    if (preset === 'all') {
      setFilters(INITIAL_FILTERS);
      setAppliedAiQueryMessage(null);
      return;
    }

    const targetCol = dataset.columns.find((c) => c.name === chartConfig.yAxis && c.type === 'number');
    if (!targetCol) return;

    const values = dataset.rows
      .map((r) => Number(r[targetCol.name]))
      .filter((v) => !isNaN(v) && isFinite(v))
      .sort((a, b) => a - b);
    if (!values.length) return;

    if (preset === 'top10') {
      const p90 = values[Math.floor(values.length * 0.9)] || values[0];
      const maxVal = values[values.length - 1];
      setFilters((prev) => ({
        ...prev,
        numericRanges: {
          ...prev.numericRanges,
          [targetCol.name]: [p90, maxVal],
        },
      }));
    } else if (preset === 'above_avg') {
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      const maxVal = values[values.length - 1];
      setFilters((prev) => ({
        ...prev,
        numericRanges: {
          ...prev.numericRanges,
          [targetCol.name]: [Number(avg.toFixed(2)), maxVal],
        },
      }));
    }
  };

  // Real-time filtered rows
  const filteredRows = useMemo(() => {
    return applyFiltersToDataset(dataset.rows, filters, dataset.columns);
  }, [dataset.rows, filters, dataset.columns]);

  // Active filters count
  const activeFilterCount = useMemo(() => {
    return (
      (filters.searchQuery ? 1 : 0) +
      Object.values(filters.numericRanges).filter(Boolean).length +
      Object.values(filters.categoricalSelections).filter((s) => s && s.length > 0).length +
      Object.values(filters.dateRanges).filter(Boolean).length +
      filters.customRules.length
    );
  }, [filters]);

  // Handle uploaded CSV file
  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) return;
      try {
        const parsed = parseCsvContent(text, file.name);
        setDataset(parsed);
        setFilters(INITIAL_FILTERS);
        setAppliedAiQueryMessage(null);

        // Pick smart default axes
        const dateCol = parsed.columns.find((c) => c.type === 'date');
        const numCol = parsed.columns.find((c) => c.type === 'number');
        const strCol = parsed.columns.find((c) => c.type === 'string' && c.uniqueValues && c.uniqueValues.length <= 15);

        setChartConfig((prev) => ({
          ...prev,
          xAxis: dateCol ? dateCol.name : parsed.columns[0]?.name || '',
          yAxis: numCol ? numCol.name : parsed.columns[1]?.name || '',
          groupBy: strCol ? strCol.name : undefined,
        }));
      } catch (err: any) {
        alert(`Error loading CSV: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  // Switch to a preloaded sample dataset
  const handleSelectSampleDataset = (sample: SampleDatasetDefinition) => {
    const parsed = parseCsvContent(sample.csv, sample.name);
    setDataset(parsed);
    setFilters(INITIAL_FILTERS);
    setAppliedAiQueryMessage(null);
    setChartConfig((prev) => ({
      ...prev,
      xAxis: sample.defaultX,
      yAxis: sample.defaultY,
      groupBy: sample.defaultGroupBy,
    }));
  };

  // Reset all filters
  const handleResetFilters = () => {
    setFilters(INITIAL_FILTERS);
    setAppliedAiQueryMessage(null);
  };

  // Export filtered rows to CSV
  const handleExportCsv = () => {
    const csvStr = exportRowsToCsv(filteredRows);
    const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `filtered_${dataset.name.replace(/\.csv$/, '')}_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Natural Language query applied callback
  const handleApplyAiQuery = ({
    filters: newFilters,
    chartConfig: newChartConfig,
    explanation,
  }: {
    filters: Partial<FilterState>;
    chartConfig?: Partial<ChartConfig>;
    explanation: string;
  }) => {
    setFilters((prev) => ({
      ...prev,
      ...newFilters,
      customRules: [...(newFilters.customRules || prev.customRules)],
      categoricalSelections: {
        ...prev.categoricalSelections,
        ...(newFilters.categoricalSelections || {}),
      },
      numericRanges: {
        ...prev.numericRanges,
        ...(newFilters.numericRanges || {}),
      },
    }));

    if (newChartConfig) {
      setChartConfig((prev) => ({ ...prev, ...newChartConfig }));
    }

    setAppliedAiQueryMessage(explanation);
  };

  const timeCol = useMemo(() => {
    return dataset.columns.find((c) => c.type === 'date')?.name;
  }, [dataset.columns]);

  return (
    <div className="flex min-h-screen bg-slate-100/70 font-sans text-slate-800 antialiased selection:bg-red-500 selection:text-white">
      {/* Streamlit Reactive Responsive Sidebar */}
      <Sidebar
        currentDatasetName={dataset.name}
        totalRowCount={dataset.rowCount}
        filteredRowCount={filteredRows.length}
        columns={dataset.columns}
        filters={filters}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onFilterChange={setFilters}
        onResetFilters={handleResetFilters}
        onFileUpload={handleFileUpload}
        onSelectSampleDataset={handleSelectSampleDataset}
        onExportCsv={handleExportCsv}
        onOpenAiQueryModal={() => setIsNlModalOpen(true)}
        isAiAvailable={hasApiKey}
      />

      {/* Main Workspace Area (Adapts dynamically to collapsed/open sidebar on all screen sizes) */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto custom-scrollbar">
        {/* Streamlit Top Accent Bar */}
        <div className="h-1 bg-gradient-to-r from-[#ff4b4b] via-amber-500 to-[#ff4b4b] shrink-0" />

        {/* Top Navbar */}
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/90 px-3.5 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {/* Sidebar toggle button (Mobile & Desktop) */}
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors shrink-0 flex items-center gap-1.5 border border-slate-200/80 sm:border-transparent cursor-pointer"
              title={isSidebarOpen ? "Collapse sidebar" : "Open sidebar"}
            >
              {isSidebarOpen ? (
                <ChevronLeft className="w-5 h-5 hidden lg:block text-slate-500" />
              ) : (
                <ChevronRight className="w-5 h-5 hidden lg:block text-slate-500" />
              )}
              <Menu className="w-5 h-5 lg:hidden text-slate-700" />
              {activeFilterCount > 0 && (
                <span className="lg:hidden w-4 h-4 rounded-full bg-red-600 text-[10px] font-bold text-white flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>

            <div className="flex items-center gap-2 min-w-0">
              <span className="text-lg sm:text-xl shrink-0">📊</span>
              <div className="min-w-0">
                <h1 className="text-xs sm:text-base font-bold text-slate-900 tracking-tight flex items-center gap-1.5 sm:gap-2 truncate">
                  <span className="truncate">{dataset.name}</span>
                  <span className="text-[10px] sm:text-[11px] font-normal px-1.5 sm:px-2 py-0.2 sm:py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 shrink-0 hidden md:inline">
                    {dataset.columns.length} cols • {dataset.rowCount} rows
                  </span>
                </h1>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {/* Streamlit Reactive Calculation Runner Status */}
            <div className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-full text-[11px] font-mono border border-slate-200/90 bg-slate-50/80 shrink-0">
              {isRunning ? (
                <div className="flex items-center gap-1.5 text-red-600 font-bold">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
                  <span className="text-[10px] sm:text-[11px]">RUNNING...</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-slate-500 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  <span className="hidden sm:inline text-[10px]">READY ({lastExecutionTimeMs}ms)</span>
                  <span className="sm:hidden text-[10px]">READY</span>
                </div>
              )}
            </div>

            {/* Natural language AI query trigger */}
            <button
              onClick={() => setIsNlModalOpen(true)}
              className="flex items-center gap-1 sm:gap-1.5 text-xs font-semibold px-2.5 sm:px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-[#ff4b4b] border border-red-200/60 transition-colors shadow-2xs cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Prompt AI</span>
              <span className="sm:hidden">AI</span>
            </button>

            {/* Chat drawer button */}
            <button
              onClick={() => setIsChatOpen(!isChatOpen)}
              className={`flex items-center gap-1 sm:gap-1.5 text-xs font-semibold px-2.5 sm:px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                isChatOpen
                  ? 'bg-slate-900 text-white'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/80 shadow-2xs'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5 text-[#ff4b4b]" />
              <span className="hidden sm:inline">Ask TrendAI</span>
              <span className="sm:hidden">Chat</span>
            </button>
          </div>
        </header>

        {/* AI Query Applied Notification Banner */}
        {appliedAiQueryMessage && (
          <div className="bg-red-50 border-b border-red-100 px-4 sm:px-6 py-2 text-xs text-red-900 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <CheckCircle2 className="w-4 h-4 text-red-600 shrink-0" />
              <span className="truncate">
                <strong>AI Filter Applied:</strong> {appliedAiQueryMessage}
              </span>
            </div>
            <button
              onClick={() => setAppliedAiQueryMessage(null)}
              className="text-red-500 hover:text-red-700 shrink-0 p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="p-3.5 sm:p-5 md:p-6 max-w-7xl w-full mx-auto space-y-4 sm:space-y-6">
          {/* Quick Filter Presets Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-white px-3.5 sm:px-4 py-2.5 rounded-xl border border-slate-200/80 shadow-2xs text-xs">
            <div className="flex items-center gap-1.5 text-slate-500">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span className="font-semibold text-slate-700">Quick Presets:</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={() => handleApplyPreset('all')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                  activeFilterCount === 0
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                All Rows ({dataset.rowCount})
              </button>
              <button
                onClick={() => handleApplyPreset('top10')}
                className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-red-50 hover:bg-red-100 text-[#ff4b4b] border border-red-200/60 transition-colors cursor-pointer"
                title={`Filter ${chartConfig.yAxis} >= 90th percentile`}
              >
                🔥 Top 10% Peak
              </button>
              <button
                onClick={() => handleApplyPreset('above_avg')}
                className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200/60 transition-colors cursor-pointer"
                title={`Filter ${chartConfig.yAxis} >= Average`}
              >
                📈 Above Average
              </button>
              {activeFilterCount > 0 && (
                <button
                  onClick={handleResetFilters}
                  className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  Reset ({activeFilterCount} active)
                </button>
              )}
            </div>
          </div>

          {/* Streamlit Metric Cards (2x2 on mobile, 4-col on desktop) */}
          <MetricCards
            totalRows={dataset.rowCount}
            filteredRows={filteredRows}
            targetMetricCol={chartConfig.yAxis}
            columns={dataset.columns}
          />

          {/* Streamlit Navigation Tabs (st.tabs) - Horizontally scrollable on mobile */}
          <div className="border-b border-slate-200 overflow-x-auto no-scrollbar flex items-center gap-1 sm:gap-2 text-xs sm:text-sm whitespace-nowrap">
            <button
              onClick={() => setActiveTab('visualizer')}
              className={`flex items-center gap-1.5 sm:gap-2 pb-2.5 sm:pb-3 px-2.5 sm:px-3 font-semibold transition-all relative shrink-0 cursor-pointer ${
                activeTab === 'visualizer'
                  ? 'text-[#ff4b4b] border-b-2 border-[#ff4b4b]'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>Trend Visualizer</span>
            </button>

            <button
              onClick={() => setActiveTab('multi_metrics')}
              className={`flex items-center gap-1.5 sm:gap-2 pb-2.5 sm:pb-3 px-2.5 sm:px-3 font-semibold transition-all relative shrink-0 cursor-pointer ${
                activeTab === 'multi_metrics'
                  ? 'text-[#ff4b4b] border-b-2 border-[#ff4b4b]'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>Multi-Metric Dashboard</span>
            </button>

            <button
              onClick={() => setActiveTab('data')}
              className={`flex items-center gap-1.5 sm:gap-2 pb-2.5 sm:pb-3 px-2.5 sm:px-3 font-semibold transition-all relative shrink-0 cursor-pointer ${
                activeTab === 'data'
                  ? 'text-[#ff4b4b] border-b-2 border-[#ff4b4b]'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Table className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>Data Explorer ({filteredRows.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('correlations')}
              className={`flex items-center gap-1.5 sm:gap-2 pb-2.5 sm:pb-3 px-2.5 sm:px-3 font-semibold transition-all relative shrink-0 cursor-pointer ${
                activeTab === 'correlations'
                  ? 'text-[#ff4b4b] border-b-2 border-[#ff4b4b]'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <GitCompare className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>Correlations & Heatmap</span>
            </button>

            <button
              onClick={() => setActiveTab('ai')}
              className={`flex items-center gap-1.5 sm:gap-2 pb-2.5 sm:pb-3 px-2.5 sm:px-3 font-semibold transition-all relative shrink-0 cursor-pointer ${
                activeTab === 'ai'
                  ? 'text-[#ff4b4b] border-b-2 border-[#ff4b4b]'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-500" />
              <span>AI Trend Intelligence</span>
            </button>

            <button
              onClick={() => setActiveTab('code')}
              className={`flex items-center gap-1.5 sm:gap-2 pb-2.5 sm:pb-3 px-2.5 sm:px-3 font-semibold transition-all relative shrink-0 cursor-pointer ${
                activeTab === 'code'
                  ? 'text-[#ff4b4b] border-b-2 border-[#ff4b4b]'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <FileCode className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#ff4b4b]" />
              <span>Streamlit App Code</span>
            </button>
          </div>

          {/* Active Tab View */}
          {activeTab === 'visualizer' && (
            <TrendVisualizer
              rows={filteredRows}
              columns={dataset.columns}
              config={chartConfig}
              onConfigChange={(newConf) => setChartConfig((prev) => ({ ...prev, ...newConf }))}
            />
          )}

          {activeTab === 'multi_metrics' && (
            <MultiMetricDashboard
              columns={dataset.columns}
              filteredRows={filteredRows}
              totalRows={dataset.rows}
              timeCol={timeCol}
              onSelectMetricForVisualizer={(metricName) => {
                setChartConfig((prev) => ({ ...prev, yAxis: metricName }));
                setActiveTab('visualizer');
              }}
            />
          )}

          {activeTab === 'data' && (
            <DataTableTab
              columns={dataset.columns}
              filteredRows={filteredRows}
              onExportCsv={handleExportCsv}
            />
          )}

          {activeTab === 'correlations' && (
            <CorrelationTab
              columns={dataset.columns}
              filteredRows={filteredRows}
              targetMetricCol={chartConfig.yAxis}
              timeCol={timeCol}
            />
          )}

          {activeTab === 'ai' && (
            <AiAnalysisTab
              columns={dataset.columns}
              filteredRows={filteredRows}
              targetMetricCol={chartConfig.yAxis}
              timeCol={timeCol}
            />
          )}

          {activeTab === 'code' && (
            <StreamlitCodeTab
              datasetName={dataset.name}
              columns={dataset.columns}
              config={chartConfig}
              filters={filters}
              filteredRows={filteredRows}
              rawCsv={dataset.rawCsv}
            />
          )}
        </div>

        {/* Mobile Floating Filter Button (Shown when sidebar is closed on mobile) */}
        {!isSidebarOpen && (
          <div className="fixed bottom-4 left-4 z-30 lg:hidden">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="flex items-center gap-2 bg-slate-900 text-white px-3.5 py-2.5 rounded-full shadow-lg border border-slate-700 text-xs font-semibold hover:bg-slate-800 transition-all cursor-pointer"
            >
              <SlidersHorizontal className="w-4 h-4 text-red-400" />
              <span>Filters</span>
              {activeFilterCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-red-600 text-[10px] font-bold text-white flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        )}
      </main>

      {/* Interactive AI Chat Drawer */}
      <AiChatDrawer
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        columns={dataset.columns}
        filteredRows={filteredRows}
        targetMetricCol={chartConfig.yAxis}
      />

      {/* Natural Language Query Modal */}
      <NaturalQueryModal
        isOpen={isNlModalOpen}
        onClose={() => setIsNlModalOpen(false)}
        columns={dataset.columns}
        onApplyQuery={handleApplyAiQuery}
      />
    </div>
  );
}
