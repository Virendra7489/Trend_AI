export type ColumnType = 'number' | 'string' | 'date' | 'boolean';

export interface ColumnMeta {
  name: string;
  type: ColumnType;
  min?: number;
  max?: number;
  mean?: number;
  median?: number;
  stdDev?: number;
  uniqueValues?: string[];
  distinctCount: number;
  nullCount: number;
  sampleValues: any[];
}

export interface Dataset {
  name: string;
  rowCount: number;
  columns: ColumnMeta[];
  rows: Record<string, any>[];
  rawCsv?: string;
  fileSize?: string;
}

export type ChartType = 'line' | 'bar' | 'scatter' | 'area' | 'histogram';

export type AggregationType = 'none' | 'sum' | 'mean' | 'count' | 'median' | 'min' | 'max';

export interface ChartConfig {
  type: ChartType;
  xAxis: string;
  yAxis: string;
  secondaryYAxis?: string;
  groupBy?: string;
  aggregation: AggregationType;
  showTrendline: boolean;
  showMovingAverage: boolean;
  movingAverageWindow: number;
  showConfidenceBand: boolean;
  detectAnomalies: boolean;
  anomalyThreshold: number; // in standard deviations, e.g. 2.0 or 2.5
  sortBy?: 'x-asc' | 'x-desc' | 'y-asc' | 'y-desc';
}

export interface CustomFilterRule {
  id: string;
  column: string;
  operator: '==' | '!=' | '>' | '>=' | '<' | '<=' | 'contains' | 'startsWith';
  value: string | number;
}

export interface FilterState {
  searchQuery: string;
  numericRanges: Record<string, [number, number]>;
  categoricalSelections: Record<string, string[]>;
  dateRanges: Record<string, [string, string]>;
  customRules: CustomFilterRule[];
}

export interface AnomalyPoint {
  index: number;
  xValue: any;
  yValue: number;
  zScore: number;
  expectedValue: number;
  row: Record<string, any>;
}

export interface CorrelationItem {
  colA: string;
  colB: string;
  r: number;
}
