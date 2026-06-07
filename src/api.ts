import type { DataRow, ApiResponse } from './types';

// Static API URL - hardcoded Google Apps Script Web App URL
const STATIC_API_URL = 'https://script.google.com/macros/s/AKfycbxHYH69t12DesJHQQfWb3Yk_cc-LvGRr9fIrKkzRiYNY8NpQxThaHwvV05Xs05PffI/exec';

/**
 * Retrieve the Google Apps Script Web App URL (static/hardcoded).
 */
export function getApiUrl(): string | null {
  return STATIC_API_URL;
}

/**
 * API is always configured since the URL is hardcoded.
 */
export function isApiConfigured(): boolean {
  return true;
}

/**
 * Fetch all records from the Google Apps Script backend.
 */
export async function fetchData(): Promise<ApiResponse<DataRow[]>> {
  const url = getApiUrl();
  if (!url) {
    return {
      status: 'error',
      message: 'Google Apps Script URL is not configured.'
    };
  }

  try {
    // Add a cache buster timestamp query parameter to prevent caching issues
    const separator = url.includes('?') ? '&' : '?';
    const fetchUrl = `${url}${separator}t=${Date.now()}`;

    // Google Apps Script requires redirect: 'follow' because it redirects to Google User Content servers
    const response = await fetch(fetchUrl, {
      method: 'GET',
      mode: 'cors',
      redirect: 'follow',
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
    }

    const data = await response.json();

    // Validate response structure
    if (!data || typeof data !== 'object') {
      return {
        status: 'error',
        message: 'Invalid API response format. Expected a valid JSON object.'
      };
    }

    if (data.status === 'error') {
      return {
        status: 'error',
        message: data.message || 'API returned an error status.'
      };
    }

    if (!Array.isArray(data.data)) {
      return {
        status: 'error',
        message: 'Invalid API response format. Expected an array of records in the data field.'
      };
    }

    return data as ApiResponse<DataRow[]>;
  } catch (error) {
    console.error('API Fetch Error:', error);
    return {
      status: 'error',
      message: error instanceof Error
        ? error.message
        : 'Failed to connect to Google Apps Script. Please verify the URL is correct and deployed as "Anyone".'
    };
  }
}

/**
 * Submit a new data row to the Google Apps Script backend.
 */
export async function submitData(row: Omit<DataRow, 'timestamp'>): Promise<ApiResponse<DataRow>> {
  const url = getApiUrl();
  if (!url) {
    return {
      status: 'error',
      message: 'Google Apps Script URL is not configured.'
    };
  }

  try {
    // CRITICAL: We send POST body as 'text/plain' to perform a "simple request"
    // and avoid the browser triggering a CORS preflight OPTIONS request,
    // which is not supported properly by Google Apps Script web apps.
    // The Apps Script handles this by calling JSON.parse on the request body.
    const response = await fetch(url, {
      method: 'POST',
      mode: 'cors',
      redirect: 'follow',
      headers: {
        'Content-Type': 'text/plain'
      },
      body: JSON.stringify(row)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
    }

    const data = await response.json();

    // Validate response structure
    if (!data || typeof data !== 'object') {
      return {
        status: 'error',
        message: 'Invalid API response format.'
      };
    }

    return data as ApiResponse<DataRow>;
  } catch (error) {
    console.error('API Submission Error:', error);
    return {
      status: 'error',
      message: error instanceof Error
        ? error.message
        : 'Failed to submit data. Please check your network connection.'
    };
  }
}
