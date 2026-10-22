import Papa from 'papaparse';
import { ColumnMeta, ColumnType, Dataset, FilterState } from '../types';
import { calculateBasicStats } from './stats';

/**
 * Checks if a string represents a valid date
 */
function isDateString(val: string): boolean {
  if (!val || val.length < 4) return false;
  // If it's pure numbers like "1234", don't treat as date
  if (/^\d+$/.test(val) && val.length !== 8) return false;

  // Common date formats: 2024-01-15, 01/15/2024, 2024/01/15, Jan 15 2024
  const dateRegex =
    /^(\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|\w{3}\s+\d{1,2},?\s+\d{4})/;
  if (dateRegex.test(val)) {
    const parsed = Date.parse(val);
    return !isNaN(parsed);
  }
  return false;
}

/**
 * Cleans string into number if possible
 */
function parseNumberClean(raw: any): number | null {
  if (typeof raw === 'number') return isNaN(raw) ? null : raw;
  if (typeof raw !== 'string') return null;

  const cleaned = raw.trim().replace(/^[$€£¥]/, '').replace(/%$/, '').replace(/,/g, '');
  if (cleaned === '' || cleaned === '-' || cleaned === 'N/A' || cleaned === 'null') return null;

  const num = Number(cleaned);
  return isNaN(num) ? null : num;
}

/**
 * Infer the best column type from sample values
 */
function inferColumnType(values: any[]): ColumnType {
  const nonNull = values.filter((v) => v !== null && v !== undefined && v !== '');
  if (nonNull.length === 0) return 'string';

  let numCount = 0;
  let dateCount = 0;
  let boolCount = 0;

  for (const v of nonNull) {
    const s = String(v).trim().toLowerCase();
    if (s === 'true' || s === 'false' || s === 'yes' || s === 'no') {
      boolCount++;
    }
    if (parseNumberClean(v) !== null) {
      numCount++;
    }
    if (isDateString(String(v))) {
      dateCount++;
    }
  }

  const threshold = nonNull.length * 0.7; // 70% match threshold
  if (boolCount >= threshold) return 'boolean';
  if (dateCount >= threshold && dateCount >= numCount) return 'date';
  if (numCount >= threshold) return 'number';
  return 'string';
}

/**
 * Parses raw CSV string into structured Dataset
 */
export function parseCsvContent(rawCsv: string, datasetName = 'dataset.csv'): Dataset {
  const parsed = Papa.parse(rawCsv.trim(), {
    header: true,
    dynamicTyping: false,
    skipEmptyLines: true,
  });

  const rawRows = parsed.data as Record<string, any>[];
  if (!rawRows || rawRows.length === 0) {
    throw new Error('CSV file is empty or could not be parsed.');
  }

  const columnHeaders = Object.keys(rawRows[0] || {}).filter((h) => h.trim() !== '');

  // Determine column types & stats
  const columns: ColumnMeta[] = columnHeaders.map((header) => {
    const sampleRawValues = rawRows.slice(0, 500).map((r) => r[header]);
    const inferredType = inferColumnType(sampleRawValues);

    const allValues = rawRows.map((r) => r[header]);
    const uniqueValSet = new Set<string>();
    const numericValues: number[] = [];
    let nullCount = 0;

    allValues.forEach((val) => {
      if (val === null || val === undefined || val === '') {
        nullCount++;
        return;
      }
      uniqueValSet.add(String(val).trim());

      if (inferredType === 'number') {
        const num = parseNumberClean(val);
        if (num !== null) numericValues.push(num);
      }
    });

    const meta: ColumnMeta = {
      name: header,
      type: inferredType,
      distinctCount: uniqueValSet.size,
      nullCount,
      uniqueValues: uniqueValSet.size <= 100 ? Array.from(uniqueValSet).sort() : undefined,
      sampleValues: Array.from(uniqueValSet).slice(0, 5),
    };

    if (inferredType === 'number' && numericValues.length > 0) {
      const stats = calculateBasicStats(numericValues);
      meta.min = stats.min;
      meta.max = stats.max;
      meta.mean = stats.mean;
      meta.median = stats.median;
      meta.stdDev = stats.stdDev;
    }

    return meta;
  });

  // Normalize parsed row objects with properly cast types
  const rows = rawRows.map((row) => {
    const formattedRow: Record<string, any> = {};
    for (const col of columns) {
      const val = row[col.name];
      if (val === null || val === undefined || val === '') {
        formattedRow[col.name] = null;
        continue;
      }

      if (col.type === 'number') {
        const num = parseNumberClean(val);
        formattedRow[col.name] = num;
      } else if (col.type === 'boolean') {
        const s = String(val).trim().toLowerCase();
        formattedRow[col.name] = s === 'true' || s === 'yes' || s === '1';
      } else {
        formattedRow[col.name] = String(val).trim();
      }
    }
    return formattedRow;
  });

  return {
    name: datasetName,
    rowCount: rows.length,
    columns,
    rows,
    rawCsv,
    fileSize: `${(rawCsv.length / 1024).toFixed(1)} KB`,
  };
}

/**
 * Filter engine: returns subset of rows matching all active filter criteria
 */
export function applyFiltersToDataset(
  rows: Record<string, any>[],
  filters: FilterState,
  columns: ColumnMeta[]
): Record<string, any>[] {
  if (!Array.isArray(rows) || !rows.length) return [];
  if (!Array.isArray(columns) || !columns.length) return rows;
  const colMap = new Map(columns.map((c) => [c.name, c]));
  const query = (filters?.searchQuery || '').trim().toLowerCase();

  return rows.filter((row) => {
    if (!row || typeof row !== 'object') return false;

    // 1. Global search query across all row fields
    if (query) {
      const matchesSearch = Object.values(row).some((val) => {
        if (val === null || val === undefined) return false;
        return String(val).toLowerCase().includes(query);
      });
      if (!matchesSearch) return false;
    }

    // 2. Numeric Range Filters
    for (const [colName, range] of Object.entries(filters.numericRanges)) {
      if (!range) continue;
      const val = row[colName];
      if (val === null || val === undefined) continue;
      const [min, max] = range;
      if (val < min || val > max) return false;
    }

    // 3. Categorical Multi-select Filters
    for (const [colName, selected] of Object.entries(filters.categoricalSelections)) {
      if (!selected || selected.length === 0) continue;
      const val = row[colName];
      const strVal = val === null || val === undefined ? '' : String(val);
      if (!selected.includes(strVal)) return false;
    }

    // 4. Date Range Filters
    for (const [colName, range] of Object.entries(filters.dateRanges)) {
      if (!range || !range[0] || !range[1]) continue;
      const val = row[colName];
      if (!val) continue;
      const rowDate = new Date(val).getTime();
      const startDate = new Date(range[0]).getTime();
      const endDate = new Date(range[1]).getTime() + 86400000; // inclusive full day
      if (isNaN(rowDate)) continue;
      if (rowDate < startDate || rowDate > endDate) return false;
    }

    // 5. Custom Filter Rules
    for (const rule of filters.customRules) {
      const val = row[rule.column];
      const colMeta = colMap.get(rule.column);
      const isNum = colMeta?.type === 'number';

      const rowVal = isNum ? Number(val) : String(val || '').toLowerCase();
      const testVal = isNum ? Number(rule.value) : String(rule.value || '').toLowerCase();

      switch (rule.operator) {
        case '==':
          if (rowVal != testVal) return false;
          break;
        case '!=':
          if (rowVal == testVal) return false;
          break;
        case '>':
          if (!(rowVal > testVal)) return false;
          break;
        case '>=':
          if (!(rowVal >= testVal)) return false;
          break;
        case '<':
          if (!(rowVal < testVal)) return false;
          break;
        case '<=':
          if (!(rowVal <= testVal)) return false;
          break;
        case 'contains':
          if (!String(rowVal).includes(String(testVal))) return false;
          break;
        case 'startsWith':
          if (!String(rowVal).startsWith(String(testVal))) return false;
          break;
      }
    }

    return true;
  });
}

/**
 * Exports rows back into a CSV file string for download
 */
export function exportRowsToCsv(rows: Record<string, any>[]): string {
  if (!rows.length) return '';
  return Papa.unparse(rows);
}
