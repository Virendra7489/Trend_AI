import React, { useState, useMemo, useEffect } from 'react';
import { ColumnMeta } from '../types';
import { formatDataValue } from '../utils/stats';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Download,
  Search,
  Hash,
  Calendar,
  Type,
  ToggleLeft,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface DataTableTabProps {
  columns: ColumnMeta[];
  filteredRows: Record<string, any>[];
  onExportCsv: () => void;
}

export const DataTableTab: React.FC<DataTableTabProps> = ({
  columns,
  filteredRows,
  onExportCsv,
}) => {
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [tableSearch, setTableSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Clear stale sort column if no longer present in dataset
  useEffect(() => {
    if (sortCol && !columns.some((c) => c.name === sortCol)) {
      setSortCol(null);
    }
  }, [columns, sortCol]);

  // Reset page when dataset or row count changes significantly
  useEffect(() => {
    setCurrentPage(1);
  }, [columns, filteredRows.length]);

  const handleSort = (colName: string) => {
    if (sortCol === colName) {
      if (sortDir === 'asc') setSortDir('desc');
      else {
        setSortCol(null);
        setSortDir('asc');
      }
    } else {
      setSortCol(colName);
      setSortDir('asc');
    }
  };

  // Filtered and sorted rows for table
  const processedRows = useMemo(() => {
    let result = [...filteredRows];

    if (tableSearch.trim()) {
      const q = tableSearch.toLowerCase();
      result = result.filter((row) =>
        Object.values(row).some((val) => val !== null && String(val).toLowerCase().includes(q))
      );
    }

    if (sortCol) {
      result.sort((a, b) => {
        const valA = a[sortCol];
        const valB = b[sortCol];
        if (valA === valB) return 0;
        if (valA === null || valA === undefined) return 1;
        if (valB === null || valB === undefined) return -1;

        if (typeof valA === 'number' && typeof valB === 'number') {
          return sortDir === 'asc' ? valA - valB : valB - valA;
        }
        return sortDir === 'asc'
          ? String(valA).localeCompare(String(valB))
          : String(valB).localeCompare(String(valA));
      });
    }

    return result;
  }, [filteredRows, tableSearch, sortCol, sortDir]);

  const totalPages = Math.max(1, Math.ceil(processedRows.length / pageSize));
  const pageRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return processedRows.slice(start, start + pageSize);
  }, [processedRows, currentPage, pageSize]);

  const getColIcon = (type: ColumnMeta['type']) => {
    switch (type) {
      case 'number':
        return <Hash className="w-3 h-3 text-red-500" />;
      case 'date':
        return <Calendar className="w-3 h-3 text-sky-500" />;
      case 'boolean':
        return <ToggleLeft className="w-3 h-3 text-emerald-500" />;
      default:
        return <Type className="w-3 h-3 text-slate-400" />;
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden flex flex-col">
      {/* Table Toolbar */}
      <div className="p-3 sm:p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          <div className="relative flex-1 sm:flex-initial">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Filter current view..."
              value={tableSearch}
              onChange={(e) => {
                setTableSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-white border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:border-red-500 w-full sm:w-56"
            />
          </div>

          <span className="text-[11px] sm:text-xs text-slate-500 font-mono">
            {processedRows.length.toLocaleString()} matching
          </span>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-2.5 sm:gap-3 text-xs">
          <div className="flex items-center gap-1.5 text-slate-500 text-[11px] sm:text-xs">
            <span>Rows:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-white border border-slate-200 rounded px-2 py-1 text-xs text-slate-700 focus:outline-none focus:border-red-500"
            >
              <option value={15}>15</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          <button
            onClick={onExportCsv}
            className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg transition-colors font-medium text-[11px] sm:text-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto flex-1 max-h-[540px] custom-scrollbar">
        <table className="w-full text-xs text-left border-collapse">
          <thead className="sticky top-0 bg-slate-100 text-slate-700 border-b border-slate-200 z-10 shadow-xs">
            <tr>
              <th className="p-3 text-[11px] font-semibold text-slate-400 w-12 text-center">#</th>
              {columns.map((col) => {
                const isSorted = sortCol === col.name;
                return (
                  <th
                    key={col.name}
                    onClick={() => handleSort(col.name)}
                    className="p-3 text-xs font-semibold cursor-pointer hover:bg-slate-200/60 transition-colors select-none whitespace-nowrap"
                  >
                    <div className="flex items-center gap-1.5">
                      {getColIcon(col.type)}
                      <span>{col.name}</span>
                      {isSorted ? (
                        sortDir === 'asc' ? (
                          <ArrowUp className="w-3 h-3 text-red-600" />
                        ) : (
                          <ArrowDown className="w-3 h-3 text-red-600" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-40 group-hover:opacity-100" />
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pageRows.map((row, rowIdx) => {
              const globalIndex = (currentPage - 1) * pageSize + rowIdx + 1;
              return (
                <tr key={rowIdx} className="hover:bg-red-50/20 transition-colors group">
                  <td className="p-3 text-center text-slate-400 font-mono text-[11px]">
                    {globalIndex}
                  </td>
                  {columns.map((col) => {
                    const val = row[col.name];
                    const isNum = col.type === 'number';
                    return (
                      <td
                        key={col.name}
                        className={`p-3 whitespace-nowrap ${
                          isNum ? 'font-mono text-slate-800' : 'text-slate-600'
                        }`}
                      >
                        {formatDataValue(val, col.name)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="p-3 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between text-xs text-slate-500">
        <div>
          Showing {(currentPage - 1) * pageSize + 1} to{' '}
          {Math.min(currentPage * pageSize, processedRows.length)} of {processedRows.length} records
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="p-1 rounded bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="font-mono text-slate-700">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="p-1 rounded bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
