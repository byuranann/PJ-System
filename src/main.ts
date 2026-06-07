import './style.css';
import './api';
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
// 2. Language & Theme Manager
// ==========================================================================
const sidebarBtnTheme = document.getElementById('sidebar-btn-theme') as HTMLButtonElement;
const mobileBtnTheme = document.getElementById('mobile-btn-theme') as HTMLElement;
const themeText = document.getElementById('theme-btn-text') as HTMLElement;

// Language Storage Key
const LANGUAGE_KEY = 'google_sheets_dashboard_language';

// Translation Dictionary
const translations = {
  en: {
    // Common
    appName: 'PJ System',
    dashboard: 'Dashboard',
    form: 'Data Entry Form',
    theme: 'Theme',
    lightMode: 'Light Mode',
    darkMode: 'Dark Mode',
    english: 'English',
    thai: 'Thai',

    // Header
    activeViewTitle: 'Dashboard',
    connected: 'Connected',

    // Sidebar
    sidebarTitle: 'PJ System',
    collectNewData: 'Collect New Data',
    submitEntries: 'Submit entries directly to your connected Google Sheet.',

    // Form Page
    formTitle: 'Collect New Data',
    formDescription: 'Submit entries directly to your connected Google Sheet.',
    fieldALabel: 'Product Type',
    fieldBLabel: 'Weight',
    fieldCLabel: 'Name',
    fieldAPlaceholder: 'e.g. Sales, Marketing, Project Alpha',
    fieldBPlaceholder: 'e.g. 150.50, 42',
    fieldCPlaceholder: 'e.g. Quarterly review notes (optional)',
    fieldAError: 'Product Type is required and cannot be empty.',
    fieldBError: 'Weight is required and must be a valid number.',
    fieldCError: 'Name cannot exceed 500 characters.',
    fieldAHint: 'Enter the main label or category name (max 250 characters).',
    fieldBHint: 'Enter any positive or negative numeric value.',
    fieldCHint: 'Add any additional notes (max 500 characters, optional).',
    btnClear: 'Reset Form',
    btnSubmit: 'Submit Entry',

    // Toast Messages
    toastSuccessTitle: 'Success',
    toastErrorTitle: 'Error',
    toastWarningTitle: 'Warning',
    validationError: 'Validation Error',
    validationErrorMsg: 'Please check the highlighted fields and try again.',
    submissionFailed: 'Submission Failed',
    submissionFailedMsg: 'Could not connect to Google Apps Script. Please verify your connection and URL.',

    // Dashboard
    realTimeAnalytics: 'Real-time analytics and data summary from Google Sheets.',
    refresh: 'Refresh',
    refreshingIn: 'Refreshing in',
    seconds: 's',
    noRecordsFound: 'No Records Found',
    noRecordsDesc: 'The connected Google Sheet is currently empty. Start by submitting entries via the Data Entry form.',
    addFirstEntry: 'Add First Entry',
    apiRetrieveFailure: 'API Retrieve Failure:',
    retry: 'Retry',
    totalRecords: 'Total Records',
    averageValue: 'Average Value (B)',
    maxValue: 'Max Value (B)',
    minValue: 'Min Value (B)',
    searchPlaceholder: 'Search rows...',
    showEntries: 'Show',
    entries: 'entries',
    showing: 'Showing',
    to: 'to',
    of: 'of',
    prev: 'Prev',
    next: 'Next',
    trendAnalysis: 'Values Trend & Analysis',
    categoryDistribution: 'Category Distribution',
    lineChart: 'Line Chart (Trend Over Time)',
    barChart: 'Bar Chart (Averages by Category)',
    dataRecords: 'Data Records',
    timestamp: 'Timestamp',
    fieldAHeader: 'Field A',
    fieldBHeader: 'Field B',
    fieldCHeader: 'Field C'
  },
  th: {
    // Common
    appName: 'ระบบ PJ',
    dashboard: 'แดชบอร์ด',
    form: 'ฟอร์มกรอกข้อมูล',
    theme: 'ธีม',
    lightMode: 'โหมดสว่าง',
    darkMode: 'โหมดมืด',
    english: 'ภาษาอังกฤษ',
    thai: 'ภาษาไทย',

    // Header
    activeViewTitle: 'แดชบอร์ด',
    connected: 'เชื่อมต่อแล้ว',

    // Sidebar
    sidebarTitle: 'ระบบ PJ',
    collectNewData: 'เก็บข้อมูลใหม่',
    submitEntries: 'ส่งรายการโดยตรงไปยัง Google Sheet ที่เชื่อมต่อของคุณ',

    // Form Page
    formTitle: 'เก็บข้อมูลใหม่',
    formDescription: 'ส่งรายการโดยตรงไปยัง Google Sheet ที่เชื่อมต่อของคุณ.',
    fieldALabel: 'ชนิดสินค้า',
    fieldBLabel: 'น้ำหนัก',
    fieldCLabel: 'ชื่อ',
    fieldAPlaceholder: 'เช่น ยอดขาย การตลาด โครงการอัลฟ่า',
    fieldBPlaceholder: 'เช่น 150.50, 42',
    fieldCPlaceholder: 'เช่น โน้ตรายไตรมาส (ตัวเลือก)',
    fieldAError: 'ชนิดสินค้าเป็นสิ่งจำเป็นและไม่สามารถเว้นว่างได้.',
    fieldBError: 'น้ำหนักเป็นสิ่งจำเป็นและต้องเป็นตัวเลขที่ถูกต้อง.',
    fieldCError: 'ชื่อไม่สามารถเกิน 500 ตัวอักษรได้.',
    fieldAHint: 'ป้อนป้ายกำกับหรือหมวดหมู่หลัก (สูงสุด 250 ตัวอักษร).',
    fieldBHint: 'ป้อนค่าตัวเลขบวกหรือลบใดๆ ก็ได้.',
    fieldCHint: 'เพิ่มหมายเหตุเพิ่มเติม (สูงสุด 500 ตัวอักษร, ตัวเลือก).',
    btnClear: 'รีเซ็ตฟอร์ม',
    btnSubmit: 'ส่งรายการ',

    // Toast Messages
    toastSuccessTitle: 'สำเร็จ',
    toastErrorTitle: 'ข้อผิดพลาด',
    toastWarningTitle: 'คำเตือน',
    validationError: 'ข้อผิดพลาดในการตรวจสอบ',
    validationErrorMsg: 'กรุณาตรวจสอบฟิลด์ที่ไฮไลต์และลองอีกครั้ง.',
    submissionFailed: 'การส่งล้มเหลว',
    submissionFailedMsg: 'ไม่สามารถเชื่อมต่อกับ Google Apps Script ได้ กรุณาตรวจสอบการเชื่อมต่อและ URL ของคุณ.',

    // Dashboard
    realTimeAnalytics: 'การวิเคราะห์และสรุปข้อมูลแบบเรียลไทม์จาก Google Sheets.',
    refresh: 'รีเฟรช',
    refreshingIn: 'กำลังรีเฟรชในอีก',
    seconds: 'วินาที',
    noRecordsFound: 'ไม่พบรายการ',
    noRecordsDesc: 'Google Sheet ที่เชื่อมต่อว่างเปล่าในขณะนี้. เริ่มต้นโดยส่งรายการผ่านฟอร์มกรอกข้อมูล.',
    addFirstEntry: 'เพิ่มรายการแรก',
    apiRetrieveFailure: 'ความล้มเหลวในการดึงข้อมูล API:',
    retry: 'ลองใหม่',
    totalRecords: 'จำนวนรายการทั้งหมด',
    averageValue: 'ค่าเฉลี่ย (B)',
    maxValue: 'ค่าสูงสุด (B)',
    minValue: 'ค่าต่ำสุด (B)',
    searchPlaceholder: 'ค้นหาแถว...',
    showEntries: 'แสดง',
    entries: 'รายการ',
    showing: 'แสดง',
    to: 'ถึง',
    of: 'จากทั้งหมด',
    prev: 'ก่อนหน้า',
    next: 'ถัดไป',
    trendAnalysis: 'แนวโน้มและการวิเคราะห์ค่า',
    categoryDistribution: 'การกระจายประเภท',
    lineChart: 'กราฟเส้น (แนวโน้มตามเวลา)',
    barChart: 'กราฟแท่ง (ค่าเฉลี่ยตามหมวดหมู่)',
    dataRecords: 'รายการข้อมูล',
    timestamp: 'เวลาที่บันทึก',
    fieldAHeader: 'ฟิลด์ A',
    fieldBHeader: 'ฟิลด์ B',
    fieldCHeader: 'ฟิลด์ C'
  }
};

function applyTheme(theme: 'light' | 'dark'): void {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_KEY, theme);

  // Update UI Elements
  const sunIcon = sidebarBtnTheme?.querySelector('.theme-icon-light') as HTMLElement;
  const moonIcon = sidebarBtnTheme?.querySelector('.theme-icon-dark') as HTMLElement;
  const lang = translations[(localStorage.getItem(LANGUAGE_KEY) as keyof typeof translations) || 'en'];

  if (theme === 'dark') {
    if (sunIcon) sunIcon.style.display = 'block';
    if (moonIcon) moonIcon.style.display = 'none';
    if (themeText) themeText.textContent = lang.lightMode;
  } else {
    if (sunIcon) sunIcon.style.display = 'none';
    if (moonIcon) moonIcon.style.display = 'block';
    if (themeText) themeText.textContent = lang.darkMode;
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

// Apply language to all translatable elements
const applyLanguage = (languageCode: 'en' | 'th'): void => {
  localStorage.setItem(LANGUAGE_KEY, languageCode);
  const lang = translations[languageCode as keyof typeof translations];

  // Update document title
  document.title = `${lang.appName} - ${lang.dashboard}`;

  // Update app name in sidebar
  const sidebarTitles = document.querySelectorAll('.sidebar-title');
  sidebarTitles.forEach(title => {
    title.textContent = lang.sidebarTitle;
  });

  // Update theme button text based on current theme
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
  if (themeText) {
    themeText.textContent = currentTheme === 'dark' ? lang.lightMode : lang.darkMode;
  }

  // Update language button text
  const langBtnText = document.getElementById('language-btn-text');
  if (langBtnText) {
    langBtnText.textContent = languageCode === 'en' ? 'EN/TH' : 'ENG/ไทย';
  }

  // Update mobile language button text
  const mobileLangItem = document.getElementById('mobile-btn-language');
  if (mobileLangItem) {
    const span = mobileLangItem.querySelector('span');
    if (span) span.textContent = languageCode === 'en' ? 'EN/TH' : 'ENG/ไทย';
  }

  // Update all elements with data-translate attribute
  document.querySelectorAll('[data-translate]').forEach(element => {
    const key = element.getAttribute('data-translate') as keyof typeof lang;
    if (lang[key]) {
      element.textContent = lang[key];
    }
  });

  // Update placeholder attributes
  document.querySelectorAll('[data-translate-placeholder]').forEach(element => {
    const key = element.getAttribute('data-translate-placeholder') as keyof typeof lang;
    if (lang[key]) {
      (element as HTMLInputElement).placeholder = lang[key];
    }
  });

  // Update aria-label attributes
  document.querySelectorAll('[data-translate-aria-label]').forEach(element => {
    const key = element.getAttribute('data-translate-aria-label') as keyof typeof lang;
    if (lang[key]) {
      element.setAttribute('aria-label', lang[key]);
    }
  });

  // Update button values
  document.querySelectorAll('[data-translate-value]').forEach(element => {
    const key = element.getAttribute('data-translate-value') as keyof typeof lang;
    if (lang[key]) {
      (element as HTMLInputElement).value = lang[key];
    }
  });

  // Update specific elements that need special handling
  if (viewTitle) {
    viewTitle.textContent = lang.activeViewTitle;
  }

  // API status badge (always connected since URL is hardcoded)
  const apiBadge = document.getElementById('header-api-status-badge');
  if (apiBadge) {
    apiBadge.textContent = lang.connected;
    apiBadge.setAttribute('title', lang.connected);
  }
};

// Initialize language on load
const initLanguage = () => {
  const savedLanguage = localStorage.getItem(LANGUAGE_KEY);
  console.log('[Language] initLanguage called, savedLanguage:', savedLanguage);
  if (savedLanguage === 'en' || savedLanguage === 'th') {
    console.log('[Language] Using saved language:', savedLanguage);
    applyLanguage(savedLanguage);
  } else {
    // Default to Thai
    console.log('[Language] No saved language, defaulting to TH');
    applyLanguage('th');
  }
};

// ==========================================================================
// 3. API Connection Badge Sync
// ==========================================================================
function updateApiStatusIndicator(): void {
  const badge = document.getElementById('header-api-status-badge') as HTMLElement;
  if (!badge) return;

  // Always connected since URL is hardcoded
  badge.className = 'api-status status-connected';
  const lang = translations[(localStorage.getItem(LANGUAGE_KEY) as keyof typeof translations) || 'en'];
  badge.textContent = lang.connected;
  badge.setAttribute('title', lang.connected);
}

// ==========================================================================
// 4. Hash Router
// ==========================================================================
const appContent = document.getElementById('app-content') as HTMLElement;
const viewTitle = document.getElementById('active-view-title') as HTMLElement;

function handleRouting(): void {
  console.log('[Routing] handleRouting called');
  // Run cleanup of existing page view
  if (activeViewCleanup) {
    activeViewCleanup();
    activeViewCleanup = null;
  }

  // Parse page hash (defaults to #dashboard)
  let hash = window.location.hash.slice(1) || 'dashboard';

  // Clean theme/language route override on mobile
  if (hash === 'theme' || hash === 'language') {
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

  // Remember current language before rendering
  const currentLang = (localStorage.getItem(LANGUAGE_KEY) as 'en' | 'th') || 'th';
  const lang = translations[currentLang];

  // Switch rendering context
  if (activePage === 'form') {
    if (viewTitle) viewTitle.textContent = lang.form;
    renderFormPage(appContent, showToast);
  } else {
    if (viewTitle) viewTitle.textContent = lang.dashboard;
    // Dashboard page returns a cleanup function (which contains refresh timers)
    activeViewCleanup = renderDashboardPage(
      appContent,
      () => { window.location.hash = '#form'; }
    );
  }

  // Re-apply current language to all translatable elements (including newly rendered ones)
  applyLanguage(currentLang);
}

// Bind Router Events
window.addEventListener('hashchange', handleRouting);

// ==========================================================================
// 5. Application Initializer
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

  // Initialize language
  initLanguage();

  // Attach Language Toggle handlers (must be after DOM ready)
  const sidebarLangBtn = document.getElementById('sidebar-btn-language');
  sidebarLangBtn?.addEventListener('click', () => {
    console.log('[Language] Sidebar language button clicked');
    const currentLang = localStorage.getItem(LANGUAGE_KEY) || 'th';
    console.log('[Language] Current language before toggle:', currentLang);
    const newLang = currentLang === 'en' ? 'th' : 'en';
    console.log('[Language] New language:', newLang);
    applyLanguage(newLang as 'en' | 'th');
  });

  const mobileLangBtn = document.getElementById('mobile-btn-language');
  mobileLangBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    console.log('[Language] Mobile language button clicked');
    const currentLang = localStorage.getItem(LANGUAGE_KEY) || 'th';
    console.log('[Language] Current language before toggle:', currentLang);
    const newLang = currentLang === 'en' ? 'th' : 'en';
    console.log('[Language] New language:', newLang);
    applyLanguage(newLang as 'en' | 'th');
  });

  // Sync initial API connection status indicator
  updateApiStatusIndicator();

  // Run Router
  handleRouting();
}

// Start
document.addEventListener('DOMContentLoaded', init);
