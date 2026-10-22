import React, { useRef, useState, useEffect, useMemo } from 'react';
import { ColumnMeta, FilterState, CustomFilterRule } from '../types';
import { SAMPLE_DATASETS, SampleDatasetDefinition } from '../data/sampleDatasets';
import {
  UploadCloud,
  Filter,
  RotateCcw,
  Search,
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  Download,
  Database,
  Sparkles,
  X,
  ChevronLeft,
} from 'lucide-react';

interface SidebarProps {
  currentDatasetName: string;
  totalRowCount: number;
  filteredRowCount: number;
  columns: ColumnMeta[];
  filters: FilterState;
  isOpen: boolean;
  onClose: () => void;
  onFilterChange: (updater: (prev: FilterState) => FilterState) => void;
  onResetFilters: () => void;
  onFileUpload: (file: File) => void;
  onSelectSampleDataset: (sample: SampleDatasetDefinition) => void;
  onExportCsv: () => void;
  onOpenAiQueryModal: () => void;
  isAiAvailable: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentDatasetName,
  totalRowCount,
  filteredRowCount,
  columns,
  filters,
  isOpen,
  onClose,
  onFilterChange,
  onResetFilters,
  onFileUpload,
  onSelectSampleDataset,
  onExportCsv,
  onOpenAiQueryModal,
  isAiAvailable,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [newRuleCol, setNewRuleCol] = useState(columns[0]?.name || '');
  const [newRuleOp, setNewRuleOp] = useState<CustomFilterRule['operator']>('>=');
  const [newRuleVal, setNewRuleVal] = useState('');

  // Keep newRuleCol valid when dataset or columns change
  useEffect(() => {
    if (columns.length > 0 && (!newRuleCol || !columns.some((c) => c.name === newRuleCol))) {
      setNewRuleCol(columns[0]?.name || '');
    }
  }, [columns, newRuleCol]);

  const toggleSection = (id: string) => {
    setCollapsedSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const numericCols = useMemo(() => {
    return (columns || []).filter(
      (c) =>
        c.type === 'number' &&
        c.min !== undefined &&
        c.max !== undefined &&
        !isNaN(c.min) &&
        !isNaN(c.max) &&
        isFinite(c.min) &&
        isFinite(c.max)
    );
  }, [columns]);

  const categoricalCols = useMemo(() => {
    return (columns || []).filter(
      (c) => c.type === 'string' && c.uniqueValues && c.uniqueValues.length > 1 && c.uniqueValues.length <= 25
    );
  }, [columns]);

  const dateCols = useMemo(() => {
    return (columns || []).filter((c) => c.type === 'date');
  }, [columns]);

  // Handle Drag & Drop
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleAddRule = () => {
    if (!newRuleCol || newRuleVal.trim() === '') return;
    const rule: CustomFilterRule = {
      id: Math.random().toString(36).substring(2, 9),
      column: newRuleCol,
      operator: newRuleOp,
      value: newRuleVal,
    };
    onFilterChange((prev) => ({
      ...prev,
      customRules: [...prev.customRules, rule],
    }));
    setNewRuleVal('');
  };

  const handleRemoveRule = (id: string) => {
    onFilterChange((prev) => ({
      ...prev,
      customRules: prev.customRules.filter((r) => r.id !== id),
    }));
  };

  const handleToggleCategory = (colName: string, val: string) => {
    onFilterChange((prev) => {
      const current = prev.categoricalSelections[colName] || [];
      const updated = current.includes(val)
        ? current.filter((v) => v !== val)
        : [...current, val];
      return {
        ...prev,
        categoricalSelections: {
          ...prev.categoricalSelections,
          [colName]: updated,
        },
      };
    });
  };

  const handleSelectAllCategories = (colName: string, allVals: string[]) => {
    onFilterChange((prev) => {
      const current = prev.categoricalSelections[colName] || [];
      const isAllSelected = current.length === allVals.length;
      return {
        ...prev,
        categoricalSelections: {
          ...prev.categoricalSelections,
          [colName]: isAllSelected ? [] : [...allVals],
        },
      };
    });
  };

  const activeFilterCount =
    (filters.searchQuery ? 1 : 0) +
    Object.values(filters.numericRanges).filter(Boolean).length +
    Object.values(filters.categoricalSelections).filter((s) => s && s.length > 0).length +
    Object.values(filters.dateRanges).filter(Boolean).length +
    filters.customRules.length;

  return (
    <>
      {/* Mobile Backdrop overlay (active when sidebar is open on screens < lg) */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 lg:hidden transition-opacity"
          aria-hidden="true"
        />
      )}

      {/* Sidebar Panel: Fixed off-canvas on mobile/tablet, docked or collapsed on desktop */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-50 lg:z-20 h-screen w-80 max-w-[85vw] sm:max-w-sm shrink-0 bg-slate-900 text-slate-200 border-r border-slate-800 flex flex-col transition-transform duration-300 ease-in-out select-none shadow-2xl lg:shadow-none ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Streamlit Top Header Brand */}
        <div className="p-3.5 sm:p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-[#ff4b4b] flex items-center justify-center font-bold text-white shadow-xs">
              🎈
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-white tracking-tight text-sm">Streamlit</span>
                <span className="text-[10px] px-1.5 py-0.2 bg-red-950/80 text-red-400 font-mono font-medium rounded border border-red-800/40">
                  TrendAI
                </span>
              </div>
              <span className="text-[10px] text-slate-400 block -mt-0.5">Real-Time CSV Analyzer</span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* Mobile / Desktop Close & Collapse button */}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              title="Close filters"
            >
              <X className="w-5 h-5 lg:hidden" />
              <ChevronLeft className="w-5 h-5 hidden lg:block" />
            </button>
          </div>
        </div>

        <div className="p-3.5 sm:p-4 space-y-5 flex-1 overflow-y-auto custom-scrollbar">
          {/* Upload CSV Section */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-2 flex items-center justify-between">
              <span>Upload Dataset</span>
              <span className="text-[10px] text-slate-400 font-mono">.csv only</span>
            </label>

            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-700 hover:border-red-500 rounded-xl p-3.5 text-center cursor-pointer transition-colors bg-slate-800/40 hover:bg-slate-800/80 group"
            >
              <input
                type="file"
                ref={fileInputRef}
                accept=".csv,text/csv"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    onFileUpload(file);
                    e.target.value = '';
                    if (window.innerWidth < 1024) onClose();
                  }
                }}
                className="hidden"
              />
              <UploadCloud className="w-5 h-5 mx-auto mb-1.5 text-slate-400 group-hover:text-red-400 transition-colors" />
              <p className="text-xs font-medium text-slate-200">
                Drag & drop CSV or <span className="text-red-400 underline">browse</span>
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">Automatic type detection & trends</p>
            </div>
          </div>

          {/* Preloaded Sample Datasets */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-2 flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5" />
              <span>Sample Datasets</span>
            </label>

            <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
              {SAMPLE_DATASETS.map((ds) => (
                <button
                  key={ds.id}
                  onClick={() => {
                    if (fileInputRef.current) fileInputRef.current.value = '';
                    onSelectSampleDataset(ds);
                    if (window.innerWidth < 1024) onClose();
                  }}
                  className={`text-left p-2 sm:p-2.5 rounded-lg border text-xs transition-all ${
                    currentDatasetName === ds.name
                      ? 'bg-red-950/60 border-red-500/60 text-white font-medium shadow-xs'
                      : 'bg-slate-800/60 border-slate-700/60 hover:bg-slate-800 text-slate-300'
                  }`}
                >
                  <div className="font-semibold truncate">{ds.name}</div>
                  <div className="text-[10px] text-slate-400 truncate mt-0.5">{ds.category}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Filter Toolbar / Status */}
          <div className="pt-2 border-t border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Filter className="w-3.5 h-3.5 text-red-400" />
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                  Interactive Filters
                </span>
                {activeFilterCount > 0 && (
                  <span className="w-4 h-4 rounded-full bg-red-600 text-[10px] font-bold text-white flex items-center justify-center">
                    {activeFilterCount}
                  </span>
                )}
              </div>

              {activeFilterCount > 0 && (
                <button
                  onClick={onResetFilters}
                  className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 transition-colors"
                  title="Reset all filters"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset</span>
                </button>
              )}
            </div>

            {/* Quick Global Search */}
            <div className="relative mb-3.5">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search all records..."
                value={filters.searchQuery}
                onChange={(e) =>
                  onFilterChange((prev) => ({ ...prev, searchQuery: e.target.value }))
                }
                className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-red-500"
              />
            </div>

            {/* Categorical Filters (Pill Checkboxes) */}
            {categoricalCols.length > 0 && (
              <div className="space-y-2.5 mb-3.5">
                {categoricalCols.slice(0, 3).map((col: ColumnMeta) => {
                  const unique = col.uniqueValues || [];
                  const selected = filters.categoricalSelections[col.name] || [];
                  const isCollapsed = collapsedSections[col.name];

                  return (
                    <div key={col.name} className="bg-slate-800/40 rounded-lg p-2.5 border border-slate-800">
                      <div
                        className="flex items-center justify-between cursor-pointer"
                        onClick={() => toggleSection(col.name)}
                      >
                        <span className="text-xs font-medium text-slate-300 truncate">
                          {col.name}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectAllCategories(col.name, unique);
                            }}
                            className="text-[10px] text-slate-400 hover:text-red-400"
                          >
                            {selected.length === unique.length ? 'Clear' : 'All'}
                          </button>
                          {isCollapsed ? (
                            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                          )}
                        </div>
                      </div>

                      {!isCollapsed && (
                        <div className="mt-2 space-y-1 max-h-36 overflow-y-auto pr-1 custom-scrollbar">
                          {unique.map((val: string) => {
                            return (
                              <label
                                key={val}
                                className="flex items-center gap-2 text-xs text-slate-300 hover:text-white cursor-pointer py-1"
                              >
                                <input
                                  type="checkbox"
                                  checked={selected.includes(val)}
                                  onChange={() => handleToggleCategory(col.name, val)}
                                  className="rounded bg-slate-900 border-slate-700 text-red-500 focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5"
                                />
                                <span className="truncate">{val || '(Empty)'}</span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Numeric Range Sliders */}
            {numericCols.length > 0 && (
              <div className="space-y-2.5 mb-3.5">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                  Numeric Range Sliders
                </label>

                {numericCols.slice(0, 3).map((col: ColumnMeta) => {
                  if (col.min === undefined || col.max === undefined || isNaN(col.min) || isNaN(col.max)) return null;
                  const activeRange = filters.numericRanges[col.name] || [col.min, col.max];
                  const rMin = typeof activeRange[0] === 'number' && !isNaN(activeRange[0]) ? activeRange[0] : col.min;
                  const rMax = typeof activeRange[1] === 'number' && !isNaN(activeRange[1]) ? activeRange[1] : col.max;

                  return (
                    <div key={col.name} className="bg-slate-800/40 rounded-lg p-2.5 border border-slate-800 text-xs">
                      <div className="flex items-center justify-between text-slate-300 font-medium mb-1">
                        <span className="truncate">{col.name}</span>
                        <span className="text-[10px] font-mono text-red-400">
                          {rMin} - {rMax}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min={col.min}
                          max={Math.max(col.min + 0.0001, col.max)}
                          value={rMin}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            onFilterChange((prev) => ({
                              ...prev,
                              numericRanges: {
                                ...prev.numericRanges,
                                [col.name]: [Math.min(val, rMax), rMax],
                              },
                            }));
                          }}
                          className="w-full accent-red-500 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                        />
                        <input
                          type="range"
                          min={col.min}
                          max={Math.max(col.min + 0.0001, col.max)}
                          value={rMax}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            onFilterChange((prev) => ({
                              ...prev,
                              numericRanges: {
                                ...prev.numericRanges,
                                [col.name]: [rMin, Math.max(val, rMin)],
                              },
                            }));
                          }}
                          className="w-full accent-red-500 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Date Range Picker */}
            {dateCols.length > 0 && (
              <div className="mb-3.5">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-1.5">
                  Date Range Filter
                </label>
                {dateCols.slice(0, 1).map((col: ColumnMeta) => {
                  const range = filters.dateRanges[col.name] || ['', ''];
                  return (
                    <div key={col.name} className="bg-slate-800/40 rounded-lg p-2.5 border border-slate-800 space-y-2 text-xs">
                      <div className="text-slate-300 font-medium">{col.name}</div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-[10px] text-slate-400 block mb-0.5">Start</span>
                          <input
                            type="date"
                            value={range[0]}
                            onChange={(e) =>
                              onFilterChange((prev) => ({
                                ...prev,
                                dateRanges: {
                                ...prev.dateRanges,
                                [col.name]: [e.target.value, range[1]],
                              },
                            }))
                          }
                          className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-slate-200 text-xs focus:outline-none focus:border-red-500"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block mb-0.5">End</span>
                        <input
                          type="date"
                          value={range[1]}
                          onChange={(e) =>
                            onFilterChange((prev) => ({
                              ...prev,
                              dateRanges: {
                                ...prev.dateRanges,
                                [col.name]: [range[0], e.target.value],
                              },
                            }))
                          }
                          className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-slate-200 text-xs focus:outline-none focus:border-red-500"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Custom Rule Builder */}
          <div className="bg-slate-800/30 rounded-lg p-2.5 sm:p-3 border border-slate-800 text-xs">
            <span className="text-slate-300 font-medium block mb-2">Custom Filter Rule</span>
            <div className="grid grid-cols-3 gap-1.5 mb-2">
              <select
                value={newRuleCol}
                onChange={(e) => setNewRuleCol(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded px-1 py-1 text-slate-200 text-[11px]"
              >
                {columns.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>

              <select
                value={newRuleOp}
                onChange={(e) => setNewRuleOp(e.target.value as any)}
                className="bg-slate-900 border border-slate-700 rounded px-1 py-1 text-slate-200 text-[11px]"
              >
                <option value=">=">&gt;=</option>
                <option value="<=">&lt;=</option>
                <option value=">">&gt;</option>
                <option value="<">&lt;</option>
                <option value="==">==</option>
                <option value="!=">!=</option>
                <option value="contains">contains</option>
              </select>

              <input
                type="text"
                placeholder="Value"
                value={newRuleVal}
                onChange={(e) => setNewRuleVal(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-slate-200 text-[11px]"
              />
            </div>

            <button
              onClick={handleAddRule}
              disabled={!newRuleVal}
              className="w-full bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 py-1 rounded text-xs flex items-center justify-center gap-1 transition-colors"
            >
              <Plus className="w-3 h-3" /> Add Rule
            </button>

            {/* Active custom rules list */}
            {filters.customRules.length > 0 && (
              <div className="mt-2 space-y-1">
                {filters.customRules.map((rule) => (
                  <div
                    key={rule.id}
                    className="flex items-center justify-between bg-slate-900/80 px-2 py-1 rounded border border-slate-700/60 font-mono text-[11px]"
                  >
                    <span className="truncate text-red-400">
                      {rule.column} {rule.operator} {rule.value}
                    </span>
                    <button
                      onClick={() => handleRemoveRule(rule.id)}
                      className="text-slate-500 hover:text-red-400 ml-2"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sidebar Footer with Export CSV */}
      <div className="p-3 sm:p-4 border-t border-slate-800 bg-slate-950/60 space-y-2 text-xs">
        <button
          onClick={onExportCsv}
          className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-2 rounded-lg flex items-center justify-center gap-2 transition-colors shadow-xs"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export Filtered CSV</span>
        </button>
        <div className="text-center text-[10px] text-slate-400">
          Showing {(filteredRowCount ?? 0).toLocaleString()} of {(totalRowCount ?? 0).toLocaleString()} rows
        </div>
      </div>
    </aside>
    </>
  );
};
