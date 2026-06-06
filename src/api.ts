import type { DataRow, ApiResponse } from './types';

// Key for storage
const API_URL_KEY = 'google_sheets_api_url';

/**
 * Retrieve the active Google Apps Script Web App URL from localStorage or build environment.
 */
export function getApiUrl(): string | null {
  return localStorage.getItem(API_URL_KEY) || (import.meta.env.VITE_API_URL as string) || null;
}

/**
 * Store the Google Apps Script Web App URL in localStorage.
 */
export function setApiUrl(url: string): void {
  // Trim whitespaces
  const cleanedUrl = url.trim();
  if (cleanedUrl) {
    localStorage.setItem(API_URL_KEY, cleanedUrl);
  } else {
    localStorage.removeItem(API_URL_KEY);
  }
}

/**
 * Check if the API URL is configured and has a valid Apps Script macro structure.
 */
export function isApiConfigured(): boolean {
  const url = getApiUrl();
  return !!url && url.startsWith('https://script.google.com/macros/');
}

/**
 * Fetch all records from the Google Apps Script backend.
 */
export async function fetchData(): Promise<ApiResponse<DataRow[]>> {
  const url = getApiUrl();
  if (!url) {
    return { 
      status: 'error', 
      message: 'Google Apps Script URL is not configured. Please click the Settings gear icon to configure it.' 
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
      message: 'Google Apps Script URL is not configured. Please configure it in settings.' 
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
    return data as ApiResponse<DataRow>;
  } catch (error) {
    console.error('API Submission Error:', error);
    return {
      status: 'error',
      message: error instanceof Error 
        ? error.message 
        : 'Failed to submit data. Please check your network connection and API configuration.'
    };
  }
}
