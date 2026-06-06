/**
 * Data row interface representing a record saved to/retrieved from Google Sheets
 */
export interface DataRow {
  timestamp: string; // ISO string representation
  fieldA: string;    // Required Text
  fieldB: number;    // Required Number
  fieldC?: string;   // Optional Text
}

/**
 * Summary statistics computed from the data set
 */
export interface AnalyticsSummary {
  totalRecords: number;
  avgFieldB: number;
  maxFieldB: number;
  minFieldB: number;
}

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T> {
  status: 'success' | 'error';
  message?: string;
  data?: T;
}

/**
 * Navigation page identifiers
 */
export type ViewPage = 'form' | 'dashboard';
