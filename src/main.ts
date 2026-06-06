import './style.css';
import { isApiConfigured, getApiUrl, setApiUrl } from './api';
import { renderFormPage } from './pages/form';
import { renderDashboardPage } from './pages/dashboard';
import type { ViewPage } from './types';

// Theme Storage Key
const THEME_KEY = 'google_sheets_dashboard_theme';

// Active View Cleanup Reference (for timer clearing and chart destructions)
let activeViewCleanup: (() => void) | null = null;

// ==========================================================================
// 1. Toast Notification System
// ==========================================================================
export function showToast(
  title: string, 
  msg: string, 
  type: 'success' | 'error' | 'warning' = 'success'
): void {
  const container = document.getElementById('global-toast-container');
  if (!container) return;

  // Icons
  const icons = {
    success: `
      <svg class="toast-icon toast-icon-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    `,
    error: `
      <svg class="toast-icon toast-icon-error" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    `,
    warning: `
      <svg class="toast-icon toast-icon-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    `
  };

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    ${icons[type]}
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      <div class="toast-message">${msg}</div>
    </div>
    <button class="toast-close" aria-label="Dismiss message">
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" width="14" height="14">
        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  `;

  container.appendChild(toast);

  // Close Action
  const closeBtn = toast.querySelector('.toast-close');
  const dismiss = () => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-8px)';
    setTimeout(() => toast.remove(), 300);
  };
  closeBtn?.addEventListener('click', dismiss);

  // Auto Dismiss Timer
  setTimeout(dismiss, 4000);
}

// ==========================================================================
// 2. Settings Modal Control
// ==========================================================================
const settingsOverlay = document.getElementById('settings-modal-overlay') as HTMLElement;
const settingsForm = document.getElementById('settings-modal-form') as HTMLFormElement;
const inputApiUrl = document.getElementById('settings-api-url') as HTMLInputElement;

export function openSettingsModal(): void {
  const currentUrl = getApiUrl();
  if (currentUrl) {
    inputApiUrl.value = currentUrl;
  }
  settingsOverlay.classList.add('active');
  inputApiUrl.focus();
}

function closeSettingsModal(): void {
  settingsOverlay.classList.remove('active');
  settingsForm.reset();
}

// Setup Settings Handlers
document.getElementById('sidebar-btn-settings')?.addEventListener('click', openSettingsModal);
document.getElementById('mobile-btn-settings')?.addEventListener('click', (e) => {
  e.preventDefault();
  openSettingsModal();
});
document.getElementById('btn-close-settings-x')?.addEventListener('click', closeSettingsModal);
document.getElementById('btn-close-settings')?.addEventListener('click', closeSettingsModal);

settingsForm?.addEventListener('submit', (e) => {
  e.preventDefault();
  const url = inputApiUrl.value.trim();
  
  if (!url.startsWith('https://script.google.com/macros/')) {
    showToast('Invalid URL', 'Please paste a valid Google Apps Script Web App URL.', 'error');
    return;
  }

  setApiUrl(url);
  updateApiStatusIndicator();
  closeSettingsModal();
  showToast('Connection Saved', 'Google Sheets endpoint updated successfully.', 'success');
  
  // Reload current page to pull new data
  handleRouting();
});

// Close modal if user clicks background overlay
settingsOverlay?.addEventListener('click', (e) => {
  if (e.target === settingsOverlay) {
    closeSettingsModal();
  }
});

// ==========================================================================
// 3. Theme Manager (Dark / Light Theme Toggle)
// ==========================================================================
const sidebarBtnTheme = document.getElementById('sidebar-btn-theme') as HTMLButtonElement;
const mobileBtnTheme = document.getElementById('mobile-btn-theme') as HTMLElement;
const themeText = document.getElementById('theme-btn-text') as HTMLElement;

function applyTheme(theme: 'light' | 'dark'): void {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_KEY, theme);
  
  // Update UI Elements
  const sunIcon = sidebarBtnTheme?.querySelector('.theme-icon-light') as HTMLElement;
  const moonIcon = sidebarBtnTheme?.querySelector('.theme-icon-dark') as HTMLElement;

  if (theme === 'dark') {
    if (sunIcon) sunIcon.style.display = 'block';
    if (moonIcon) moonIcon.style.display = 'none';
    if (themeText) themeText.textContent = 'Light Mode';
  } else {
    if (sunIcon) sunIcon.style.display = 'none';
    if (moonIcon) moonIcon.style.display = 'block';
    if (themeText) themeText.textContent = 'Dark Mode';
  }

  // Dispatch custom event for Chart.js to react and refresh styling if open
  window.dispatchEvent(new CustomEvent('themechanged', { detail: { theme } }));
}

function toggleTheme(): void {
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  applyTheme(newTheme);
}

// Attach Theme Click Handlers
sidebarBtnTheme?.addEventListener('click', toggleTheme);
mobileBtnTheme?.addEventListener('click', (e) => {
  e.preventDefault();
  toggleTheme();
});

// Sync with system preferences change
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
  // If user hasn't explicitly set a preference, follow system
  if (!localStorage.getItem(THEME_KEY)) {
    applyTheme(e.matches ? 'dark' : 'light');
  }
});

// ==========================================================================
// 4. API Connection Badge Sync
// ==========================================================================
function updateApiStatusIndicator(): void {
  const badge = document.getElementById('header-api-status-badge') as HTMLElement;
  if (!badge) return;

  if (isApiConfigured()) {
    badge.className = 'api-status status-connected';
    badge.textContent = 'Connected';
  } else {
    badge.className = 'api-status status-unconfigured';
    badge.textContent = 'Not Connected';
  }
}

// ==========================================================================
// 5. Hash Router
// ==========================================================================
const appContent = document.getElementById('app-content') as HTMLElement;
const viewTitle = document.getElementById('active-view-title') as HTMLElement;

function handleRouting(): void {
  // Run cleanup of existing page view
  if (activeViewCleanup) {
    activeViewCleanup();
    activeViewCleanup = null;
  }

  // Parse page hash (defaults to #dashboard)
  let hash = window.location.hash.slice(1) || 'dashboard';
  
  // Clean settings route override on mobile
  if (hash === 'settings' || hash === 'theme') {
    window.location.hash = '#dashboard';
    return;
  }

  const validPages: ViewPage[] = ['dashboard', 'form'];
  let activePage: ViewPage = 'dashboard';
  
  if (validPages.includes(hash as ViewPage)) {
    activePage = hash as ViewPage;
  }

  // Update Navigation Active classes (Sidebar & Mobile)
  document.querySelectorAll('.sidebar-item, .mobile-item').forEach(item => {
    if (item.getAttribute('data-page') === activePage) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // Switch rendering context
  if (activePage === 'form') {
    if (viewTitle) viewTitle.textContent = 'Data Entry Form';
    renderFormPage(appContent, showToast, openSettingsModal);
  } else {
    if (viewTitle) viewTitle.textContent = 'Dashboard';
    // Dashboard page returns a cleanup function (which contains refresh timers)
    activeViewCleanup = renderDashboardPage(
      appContent, 
      () => { window.location.hash = '#form'; }
    );
  }
}

// Bind Router Events
window.addEventListener('hashchange', handleRouting);

// ==========================================================================
// 6. Application Initializer
// ==========================================================================
function init(): void {
  // Apply initial theme
  const savedTheme = localStorage.getItem(THEME_KEY);
  if (savedTheme === 'dark' || savedTheme === 'light') {
    applyTheme(savedTheme);
  } else {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(prefersDark ? 'dark' : 'light');
  }

  // Sync initial API connection status indicator
  updateApiStatusIndicator();

  // Run Router
  handleRouting();

  // Prompt settings modal on first start if unconfigured
  if (!isApiConfigured()) {
    setTimeout(() => {
      showToast(
        'Welcome to SheetSync', 
        'Please configure your Google Apps Script URL in settings to fetch or save spreadsheet data.', 
        'warning'
      );
      openSettingsModal();
    }, 1200);
  }
}

// Start
document.addEventListener('DOMContentLoaded', init);
