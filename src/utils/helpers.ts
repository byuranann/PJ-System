import type { DataRow, AnalyticsSummary } from '../types';

/**
 * Sanitize HTML characters in a string to prevent Cross-Site Scripting (XSS) attacks.
 */
export function sanitize(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Format timestamp string into a readable date-time string.
 */
export function formatDate(isoString: string): string {
  if (!isoString) return '-';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '-';
    
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  } catch (error) {
    return '-';
  }
}

/**
 * Format a number to a readable decimal format.
 */
export function formatNumber(num: number, decimals: number = 2): string {
  if (num === null || num === undefined || isNaN(num)) return '0';
  
  // Try to use standard international number formatter
  try {
    return new Intl.NumberFormat(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals
    }).format(num);
  } catch (error) {
    return num.toFixed(decimals);
  }
}

/**
 * Calculate dashboard summary statistics (total, average, max, min) for Field B.
 */
export function calculateSummary(data: DataRow[]): AnalyticsSummary {
  if (!data || data.length === 0) {
    return {
      totalRecords: 0,
      avgFieldB: 0,
      maxFieldB: 0,
      minFieldB: 0
    };
  }

  const values = data.map(row => row.fieldB).filter(val => !isNaN(val));
  
  if (values.length === 0) {
    return {
      totalRecords: data.length,
      avgFieldB: 0,
      maxFieldB: 0,
      minFieldB: 0
    };
  }

  const total = data.length;
  const sum = values.reduce((acc, val) => acc + val, 0);
  const avg = sum / values.length;
  const max = Math.max(...values);
  const min = Math.min(...values);

  return {
    totalRecords: total,
    avgFieldB: avg,
    maxFieldB: max,
    minFieldB: min
  };
}
