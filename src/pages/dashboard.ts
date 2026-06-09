import { Chart, registerables } from 'chart.js';
import { fetchData } from '../api';
import type { DataRow } from '../types';
import { calculateSummary, formatDate, formatNumber, sanitize } from '../utils/helpers';

// Language key for translations
const LANGUAGE_KEY = 'google_sheets_dashboard_language';

// Translation Dictionary (local copy for dashboard)
const translations = {
  en: {
    totalRecords: 'Total Records',
    averageValue: 'Average Value (B)',
    maxValue: 'Max Value (B)',
    minValue: 'Min Value (B)',
    timestamp: 'Timestamp',
    fieldAHeader: 'Field A',
    fieldBHeader: 'Field B',
    fieldCHeader: 'Field C',
    noRecordsFound: 'No Records Found',
    apiRetrieveFailure: 'API Retrieve Failure:',
    showEntries: 'Show',
    entries: 'entries',
    showing: 'Showing',
    to: 'to',
    of: 'of',
    prev: 'Prev',
    next: 'Next',
    refresh: 'Refresh',
    refreshingIn: 'Refreshing in',
    seconds: 's',
    retry: 'Retry',
    searchPlaceholder: 'Search rows...'
  },
  th: {
    totalRecords: 'จำนวนรายการทั้งหมด',
    averageValue: 'ค่าเฉลี่ย (B)',
    maxValue: 'ค่าสูงสุด (B)',
    minValue: 'ค่าต่ำสุด (B)',
    timestamp: 'เวลาที่บันทึก',
    fieldAHeader: 'ฟิลด์ A',
    fieldBHeader: 'ฟิลด์ B',
    fieldCHeader: 'ฟิลด์ C',
    noRecordsFound: 'ไม่พบรายการ',
    apiRetrieveFailure: 'ความล้มเหลวในการดึงข้อมูล API:',
    showEntries: 'แสดง',
    entries: 'รายการ',
    showing: 'แสดง',
    to: 'ถึง',
    of: 'จากทั้งหมด',
    prev: 'ก่อนหน้า',
    next: 'ถัดไป',
    refresh: 'รีเฟรช',
    refreshingIn: 'กำลังรีเฟรชในอีก',
    seconds: 'วินาที',
    retry: 'ลองใหม่',
    searchPlaceholder: 'ค้นหาแถว...'
  }
};

// Register Chart.js components
Chart.register(...registerables);

/**
 * Render and initialize the Analytics Dashboard Page
 *
 * @param container The DOM element where the page should be rendered
 * @param showToast Callback to trigger global toast notifications
 * @param navigateToForm Callback to switch to the data entry form view
 * @returns Cleanup function to clear intervals and destroy chart instances
 */
export function renderDashboardPage(
  container: HTMLElement,
  showToast: (title: string, msg: string, type: 'success' | 'error' | 'warning') => void,
  navigateToForm: () => void
): () => void {

  // Page State
  let globalData: DataRow[] = [];
  let filteredData: DataRow[] = [];

  // Table Interactivity State
  let searchQuery = '';
  let sortColumn: keyof DataRow = 'timestamp';
  let sortDirection: 'asc' | 'desc' = 'desc';
  let currentPage = 1;
  let pageSize = 5;

  // Chart Instances
  let barChartInstance: Chart | null = null;
  let lineChartInstance: Chart | null = null;
  let pieChartInstance: Chart | null = null;

  // Chart Configuration State
  let chartType: 'line' | 'bar' = 'line'; // Default to line chart

  // Timers & Intervals
  let refreshTimerInterval: number | null = null;
  let countdownTimer = 60;

  // Performance optimization: throttle rapid updates
  let renderTableTimeout: number | null = null;
  let renderChartsTimeout: number | null = null;

  // 1. Render Dashboard Layout Shell
  container.innerHTML = `
    <div class="dashboard-layout">
      <!-- Toolbar: Manual Refresh and Auto Refresh Status -->
      <div class="table-toolbar" style="margin-bottom: 24px;">
        <div>
          <p style="color: var(--text-muted); font-size: 0.9rem;" data-translate="realTimeAnalytics">Real-time analytics and data summary from Google Sheets.</p>
        </div>
        <div class="header-actions">
          <div class="refresh-countdown" id="refresh-countdown-container">
            <span class="countdown-text" data-translate="refreshingIn">Refreshing in</span> <strong id="countdown-sec">60</strong><span data-translate="seconds">s</span>
          </div>
          <button id="btn-manual-refresh" class="btn btn-secondary" style="min-height: 40px; padding: 0 16px;" data-translate-value="btnRefresh">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" width="16" height="16" id="refresh-icon">
              <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0013.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            <span class="btn-text" data-translate-value="btnRefresh">Refresh</span>
          </button>
        </div>
      </div>

      <!-- Error State Container -->
      <div id="dashboard-error-container"></div>

      <!-- Summary Cards Grid -->
      <div class="grid-cols-4" id="summary-cards-container" style="margin-bottom: 24px;">
        <!-- Dynamically rendered metric cards or skeletons -->
      </div>

      <!-- Charts Grid -->
      <div class="charts-grid" id="charts-layout-container" style="margin-bottom: 24px;">
        <!-- Left: Line / Bar combo card -->
        <div class="card chart-card">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <h3 style="font-size: 1rem;" data-translate="trendAnalysis">Values Trend & Analysis</h3>
            <div class="page-size-selector" style="font-size: 0.8rem;">
              <select id="chart-type-selector" aria-label="Select chart type">
                <option value="line" data-translate="lineChart">Line Chart (Trend Over Time)</option>
                <option value="bar" data-translate="barChart">Bar Chart (Averages by Category)</option>
              </select>
            </div>
          </div>
          <div class="chart-container">
            <canvas id="trend-analysis-chart"></canvas>
          </div>
        </div>

        <!-- Right: Pie share distribution card -->
        <div class="card chart-card">
          <h3 style="font-size: 1rem; margin-bottom: 16px;" data-translate="categoryDistribution">Category Distribution</h3>
          <div class="chart-container">
            <canvas id="category-distribution-chart"></canvas>
          </div>
        </div>
      </div>

      <!-- Data Table Card -->
      <div class="card" style="padding: 0; overflow: hidden; border-radius: var(--radius-lg);" id="table-card-container">
        <div style="padding: 24px 24px 8px 24px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
          <h3 style="font-size: 1.1rem;" data-translate="dataRecords">Data Records</h3>
          <div class="search-wrapper" style="position: relative; flex-grow: 1; max-width: 360px;">
            <svg class="search-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input type="text" id="table-search" class="search-input" placeholder="" data-translate-placeholder="searchPlaceholder" aria-label="Search records">
          </div>
        </div>

        <!-- Table container wrapper -->
        <div id="table-responsive-wrapper" style="margin-top: 16px;">
          <!-- Table element is loaded here -->
        </div>

        <!-- Add Entry Button (for empty states) -->
        <div style="padding: 24px; text-align: center;" id="add-entry-container">
          <button id="btn-add-entry" class="btn btn-primary" style="min-height: 48px; padding: 0 24px;" data-translate-value="btnEmptyAdd">
            Add First Entry
          </button>
        </div>
      </div>
    </div>
  `;

  // Get UI Containers
  const summaryContainer = document.getElementById('summary-cards-container') as HTMLElement;
  const tableWrapper = document.getElementById('table-responsive-wrapper') as HTMLElement;
  const errorContainer = document.getElementById('dashboard-error-container') as HTMLElement;
  const btnRefresh = document.getElementById('btn-manual-refresh') as HTMLButtonElement;
  const refreshIcon = document.getElementById('refresh-icon') as HTMLElement;
  const chartTypeSelector = document.getElementById('chart-type-selector') as HTMLSelectElement;
  const searchInput = document.getElementById('table-search') as HTMLInputElement;
  const addEntryContainer = document.getElementById('add-entry-container') as HTMLElement;
  const btnAddEntry = document.getElementById('btn-add-entry') as HTMLButtonElement;

  // 2. Render Loading Skeletons
  const renderSkeletons = () => {
    // Metric cards skeletons
    summaryContainer.innerHTML = Array(4).fill(0).map(() => `
      <div class="card metric-card">
        <div class="skeleton skeleton-text" style="width: 50%;"></div>
        <div class="skeleton skeleton-metric" style="width: 70%; margin-top: 10px;"></div>
      </div>
    `).join('');

    // Table skeleton
    tableWrapper.innerHTML = `
      <div style="padding: 24px;">
        <div class="skeleton skeleton-row" style="height: 32px; width: 100%; margin-bottom: 16px;"></div>
        ${Array(5).fill(0).map(() => `<div class="skeleton skeleton-row"></div>`).join('')}
      </div>
    `;

    // Chart skeletons
    const trendCtx = document.getElementById('trend-analysis-chart') as HTMLCanvasElement;
    const pieCtx = document.getElementById('category-distribution-chart') as HTMLCanvasElement;

    if (trendCtx) {
      trendCtx.parentElement?.classList.add('chart-loading');
      trendCtx.parentElement?.insertAdjacentHTML('beforeend', `
        <div class="skeleton skeleton-chart"></div>
      `);
    }

    if (pieCtx) {
      pieCtx.parentElement?.classList.add('chart-loading');
      pieCtx.parentElement?.insertAdjacentHTML('beforeend', `
        <div class="skeleton skeleton-chart"></div>
      `);
    }

    // Disable buttons
    btnRefresh.disabled = true;
    btnRefresh.setAttribute('aria-busy', 'true');
    refreshIcon.classList.add('spin-icon');
    chartTypeSelector.disabled = true;
    searchInput.disabled = true;
  };

  // 3. Destroy all chart instances and clean up
  const destroyCharts = () => {
    if (barChartInstance) {
      barChartInstance.destroy();
      barChartInstance = null;
    }
    if (lineChartInstance) {
      lineChartInstance.destroy();
      lineChartInstance = null;
    }
    if (pieChartInstance) {
      pieChartInstance.destroy();
      pieChartInstance = null;
    }

    // Remove chart loading overlays
    document.querySelectorAll('.chart-loading-overlay').forEach(el => el.remove());
    document.querySelectorAll('.chart-loading').forEach(el => el.classList.remove('chart-loading'));
  };

  // 4. Fetch and Load Data
  const loadData = async (silent = false) => {
    if (!silent) {
      destroyCharts();
      renderSkeletons();
    } else {
      btnRefresh.disabled = true;
      btnRefresh.setAttribute('aria-busy', 'true');
      refreshIcon.classList.add('spin-icon');
    }

    errorContainer.innerHTML = ''; // clear error
    addEntryContainer.style.display = 'none'; // hide add entry button during loading

    try {
      const response = await fetchData();

      if (response.status === 'success' && response.data) {
        globalData = response.data;
        filteredData = [...globalData];

        if (globalData.length === 0) {
          renderEmptyState();
        } else {
          // Render statistics and components
          updateSummaryMetrics(globalData);
          applyFiltersAndSorting();
          renderCharts(globalData);

          // Show add entry button only if we have data (alternative navigation)
          addEntryContainer.style.display = 'block';
          btnAddEntry.focus();
        }
      } else {
        renderErrorState(response.message || 'API failed to retrieve data records.');
      }
    } catch (err) {
      renderErrorState('A network connectivity error occurred. Please check settings and retry.');
    } finally {
      btnRefresh.disabled = false;
      btnRefresh.removeAttribute('aria-busy');
      refreshIcon.classList.remove('spin-icon');
      chartTypeSelector.disabled = false;
      searchInput.disabled = false;
      resetCountdown();
    }
  };

  // 5. Update Metrics Cards with Animations
  const updateSummaryMetrics = (data: DataRow[]) => {
    const stats = calculateSummary(data);

    // Animate metric values if they changed
    summaryContainer.innerHTML = `
      <div class="card metric-card">
        <span class="metric-label" data-translate="totalRecords">Total Records</span>
        <span class="metric-value" id="metric-total">${stats.totalRecords}</span>
      </div>
      <div class="card metric-card">
        <span class="metric-label" data-translate="averageValue">Average Value (B)</span>
        <span class="metric-value" id="metric-average">${formatNumber(stats.avgFieldB)}</span>
      </div>
      <div class="card metric-card">
        <span class="metric-label" data-translate="maxValue">Max Value (B)</span>
        <span class="metric-value" id="metric-maximum">${formatNumber(stats.maxFieldB)}</span>
      </div>
      <div class="card metric-card">
        <span class="metric-label" data-translate="minValue">Min Value (B)</span>
        <span class="metric-value" id="metric-minimum">${formatNumber(stats.minFieldB)}</span>
      </div>
    `;

    // Add subtle animation to metric values
    const metricValues = summaryContainer.querySelectorAll<HTMLElement>('.metric-value');
    metricValues.forEach((el, index) => {
      el.style.opacity = '0';
      setTimeout(() => {
        el.style.transition = 'opacity 0.3s ease';
        el.style.opacity = '1';
      }, index * 100);
    });
  };

  // 6. Data Filtering, Sorting, and Table Rendering with Performance Optimization
  const applyFiltersAndSorting = () => {
    // Clear existing timeout
    if (renderTableTimeout) {
      clearTimeout(renderTableTimeout);
    }

    // Throttle rapid updates
    renderTableTimeout = window.setTimeout(() => {
      _applyFiltersAndSorting();
    }, 100);
  };

  const _applyFiltersAndSorting = () => {
    // A. Apply Search Filter
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase().trim();
      filteredData = globalData.filter(row => {
        return (
          row.fieldA.toLowerCase().includes(query) ||
          row.fieldB.toString().toLowerCase().includes(query) ||
          (row.fieldC && row.fieldC.toLowerCase().includes(query)) ||
          formatDate(row.timestamp).toLowerCase().includes(query)
        );
      });
    } else {
      filteredData = [...globalData];
    }

    // B. Apply Sort
    filteredData.sort((a, b) => {
      let valA = a[sortColumn];
      let valB = b[sortColumn];

      if (sortColumn === 'timestamp') {
        valA = new Date(a.timestamp).getTime();
        valB = new Date(b.timestamp).getTime();
      }

      if (valA === undefined || valA === null) return 1;
      if (valB === undefined || valB === null) return -1;

      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortDirection === 'asc'
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA);
      } else {
        // Numbers
        return sortDirection === 'asc'
          ? (valA as number) - (valB as number)
          : (valB as number) - (valA as number);
      }
    });

    renderTable();
  };

  // Render HTML Table with Enhanced Features
  const renderTable = () => {
    const totalRecords = filteredData.length;
    const totalPages = Math.ceil(totalRecords / pageSize) || 1;

    // Bounds check
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const startIdx = (currentPage - 1) * pageSize;
    const endIdx = Math.min(startIdx + pageSize, totalRecords);
    const paginatedData = filteredData.slice(startIdx, endIdx);

    const getSortIndicator = (col: keyof DataRow) => {
      if (sortColumn !== col) {
        return `
          <span class="sort-icon" style="opacity: 0.3;">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M3 7.5L7.5 3m0 0L12 7.5M7.5 3v13.5m13.5 0L16.5 21m0 0L12 16.5m4.5 4.5V7.5" />
            </svg>
          </span>
        `;
      }
      return sortDirection === 'asc'
        ? `
          <span class="sort-icon" style="color: var(--color-brand);">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
            </svg>
          </span>
        `
        : `
          <span class="sort-icon" style="color: var(--color-brand);">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </span>
        `;
    };

    if (totalRecords === 0) {
      const lang = translations[localStorage.getItem(LANGUAGE_KEY) as keyof typeof translations || 'en'];
      tableWrapper.innerHTML = `
        <div style="padding: 40px; text-align: center; color: var(--text-muted);">
          ${lang.noRecordsFound}
        </div>
      `;

      // Show add entry button for empty table
      addEntryContainer.style.display = 'block';
      btnAddEntry.focus();
      return;
    }

    // Hide add entry button when we have data
    addEntryContainer.style.display = 'none';

    tableWrapper.innerHTML = `
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th class="sortable" data-col="timestamp" data-translate="timestamp" aria-label="Sort by timestamp">${formatDate(new Date().toISOString())} ${getSortIndicator('timestamp')}</th>
              <th class="sortable" data-col="fieldA" data-translate="fieldAHeader" aria-label="Sort by field A">Field A ${getSortIndicator('fieldA')}</th>
              <th class="sortable" data-col="fieldB" data-translate="fieldBHeader" aria-label="Sort by field B">Field B ${getSortIndicator('fieldB')}</th>
              <th class="sortable" data-col="fieldC" data-translate="fieldCHeader" aria-label="Sort by field C">Field C ${getSortIndicator('fieldC')}</th>
            </tr>
          </thead>
          <tbody>
            ${paginatedData.map(row => `
              <tr data-index="${startIdx + paginatedData.indexOf(row)}">
                <td style="color: var(--text-muted); font-size: 0.85rem;">${formatDate(row.timestamp)}</td>
                <td style="font-weight: 500;">${sanitize(row.fieldA)}</td>
                <td style="font-family: monospace; font-weight: 600;">${formatNumber(row.fieldB)}</td>
                <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-muted);" title="${sanitize(row.fieldC || '')}">
                  ${sanitize(row.fieldC || '-')}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="pagination">
          <div class="page-size-selector">
            <span data-translate="showEntries">Show</span>
            <select id="select-page-size" aria-label="Select rows per page">
              <option value="5" ${pageSize === 5 ? 'selected' : ''}>5</option>
              <option value="10" ${pageSize === 10 ? 'selected' : ''}>10</option>
              <option value="20" ${pageSize === 20 ? 'selected' : ''}>20</option>
              <option value="50" ${pageSize === 50 ? 'selected' : ''}>50</option>
            </select>
            <span data-translate="entries">entries</span>
          </div>
          <div>
            <span data-translate="showing">Showing</span> ${startIdx + 1} <span data-translate="to">to</span> ${endIdx} <span data-translate="of">of</span> ${totalRecords} <span data-translate="entries">entries</span>
          </div>
          <div class="pagination-controls">
            <button id="btn-page-prev" class="pagination-btn" ${currentPage === 1 ? 'disabled' : ''} data-translate-value="btnPrev" aria-label="Previous page">
              Prev
            </button>
            <button id="btn-page-next" class="pagination-btn" ${currentPage === totalPages ? 'disabled' : ''} data-translate-value="btnNext" aria-label="Next page">
              Next
            </button>
          </div>
        </div>
      </div>
    `;

    // Event listeners inside table
    // Header Sorting
    const headers = tableWrapper.querySelectorAll('th.sortable');
    headers.forEach(header => {
      header.addEventListener('click', () => {
        const col = header.getAttribute('data-col') as keyof DataRow;
        if (sortColumn === col) {
          sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
          sortColumn = col;
          sortDirection = 'desc'; // default to desc
        }
        currentPage = 1; // reset page
        applyFiltersAndSorting();

        // Update ARIA label to reflect current sort state
        headers.forEach(h => {
          const hCol = h.getAttribute('data-col') as keyof DataRow;
          if (hCol === col) {
            h.setAttribute('aria-label', `Sort by ${hCol} ${sortDirection === 'asc' ? 'ascending' : 'descending'}`);
          } else {
            h.removeAttribute('aria-label');
          }
        });
      });
    });

    // Pagination Click
    const btnPrev = document.getElementById('btn-page-prev') as HTMLButtonElement;
    const btnNext = document.getElementById('btn-page-next') as HTMLButtonElement;

    btnPrev?.addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage--;
        applyFiltersAndSorting();
      }
    });

    btnNext?.addEventListener('click', () => {
      if (currentPage < totalPages) {
        currentPage++;
        applyFiltersAndSorting();
      }
    });

    // Page Size Select Changer
    const selectPageSize = document.getElementById('select-page-size') as HTMLSelectElement;
    selectPageSize?.addEventListener('change', () => {
      pageSize = Number(selectPageSize.value);
      currentPage = 1;
      applyFiltersAndSorting();
    });

    // Enhanced table row interactions
    const rows = tableWrapper.querySelectorAll<HTMLElement>('tbody tr');
    rows.forEach(row => {
      row.addEventListener('click', () => {
        // Toggle row selection
        const isSelected = row.getAttribute('data-selected') === 'true';
        row.setAttribute('data-selected', String(!isSelected));

        // Visual feedback
        row.style.backgroundColor = isSelected
          ? 'var(--bg-card)'
          : 'var(--color-brand-light)';

        // Optional: show row details in a sidebar or modal
      });

      row.addEventListener('mouseenter', () => {
        if (row.getAttribute('data-selected') !== 'true') {
          row.style.backgroundColor = 'var(--color-brand-light)';
        }
      });

      row.addEventListener('mouseleave', () => {
        if (row.getAttribute('data-selected') !== 'true') {
          row.style.backgroundColor = 'var(--bg-card)';
        }
      });
    });
  };

  // 7. Enhanced Visualizations rendering with Chart.js
  const renderCharts = (data: DataRow[]) => {
    // Clear existing timeout
    if (renderChartsTimeout) {
      clearTimeout(renderChartsTimeout);
    }

    // Throttle rapid chart updates
    renderChartsTimeout = window.setTimeout(() => {
      _renderCharts(data);
    }, 150);
  };

  const _renderCharts = (data: DataRow[]) => {
    destroyCharts();

    const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark' ||
      (!document.documentElement.hasAttribute('data-theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);

    // Common Chart Styling Options
    const gridColor = isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)';
    const textColor = isDarkMode ? 'hsl(215, 20%, 65%)' : 'hsl(215, 16%, 47%)';
    const displayFont = { family: 'Outfit, sans-serif', size: 11 };

    // --- CHART 1: Trend Line Chart & Bar aggregations ---
    const trendCtx = document.getElementById('trend-analysis-chart') as HTMLCanvasElement;
    if (trendCtx) {
      renderTrendChart(trendCtx, data, gridColor, textColor, displayFont, isDarkMode);
    }

    // --- CHART 2: Category distribution (Pie Chart) ---
    const pieCtx = document.getElementById('category-distribution-chart') as HTMLCanvasElement;
    if (pieCtx) {
      renderCategoryPieChart(pieCtx, data, isDarkMode);
    }
  };

  // Helper to render the Trend Chart (either line or bar based on dropdown selector)
  const renderTrendChart = (
    canvas: HTMLCanvasElement,
    data: DataRow[],
    gridColor: string,
    textColor: string,
    displayFont: any,
    isDarkMode: boolean
  ) => {

    // Get current chart type from selector
    chartType = chartTypeSelector.value as 'line' | 'bar';

    // Sort chronologically for time plot
    const chronologicalData = [...data].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    if (chartType === 'line') {
      // 1. Line Chart: Field B Value trends over time
      const labels = chronologicalData.map(row => {
        const d = new Date(row.timestamp);
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      });
      const values = chronologicalData.map(row => row.fieldB);

      lineChartInstance = new Chart(canvas, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [{
            label: 'Field B Value',
            data: values,
            borderColor: 'hsl(243, 75%, 59%)',
            backgroundColor: 'rgba(99, 102, 241, 0.1)',
            fill: true,
            tension: 0.3,
            borderWidth: 3,
            pointRadius: 4,
            pointBackgroundColor: 'hsl(243, 75%, 59%)',
            pointHoverRadius: 6,
            pointHoverBackgroundColor: 'hsl(243, 75%, 50%)'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              padding: 12,
              titleFont: { family: 'Outfit', weight: 'bold' },
              bodyFont: { family: 'Inter' },
              backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.8)',
              titleColor: '#fff',
              bodyColor: '#fff',
              borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)',
              borderWidth: 1,
              cornerRadius: 4,
              
              callbacks: {
                label: (context) => {
                  const value = context.parsed.y ?? 0;
                  return `Value: ${formatNumber(value)}`;
                },
                title: (context) => {
                  if (context[0].label) {
                    return `Time: ${context[0].label}`;
                  }
                  return '';
                }
              }
            }
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { color: textColor, font: displayFont, padding: 8 }
            },
            y: {
              grid: { color: gridColor },
              ticks: { color: textColor, font: displayFont, padding: 8 }
            }
          }
        }
      });
    } else {
      // 2. Bar Chart: Average of Field B grouped by Field A Categories
      const categories: { [key: string]: { sum: number, count: number } } = {};

      data.forEach(row => {
        const cat = row.fieldA.trim() || 'Uncategorized';
        if (!categories[cat]) {
          categories[cat] = { sum: 0, count: 0 };
        }
        categories[cat].sum += row.fieldB;
        categories[cat].count += 1;
      });

      // Sort categories by average value (descending)
      const sortedCategories = Object.entries(categories)
        .sort(([,a], [,b]) => (b.sum / b.count) - (a.sum / a.count))
        .map(([key]) => key);

      const labels = sortedCategories;
      const averages = labels.map(label => categories[label].sum / categories[label].count);

      barChartInstance = new Chart(canvas, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [{
            label: 'Average Value',
            data: averages,
            backgroundColor: 'hsl(243, 75%, 59%)',
            hoverBackgroundColor: 'hsl(243, 75%, 53%)',
            borderRadius: 6,
            borderWidth: 0,
            barThickness: 24,
            barPercentage: 0.6,
            categoryPercentage: 0.8
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              padding: 12,
              titleFont: { family: 'Outfit', weight: 'bold' },
              bodyFont: { family: 'Inter' },
              backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.8)',
              titleColor: '#fff',
              bodyColor: '#fff',
              borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)',
              borderWidth: 1,
              cornerRadius: 4,
              
              callbacks: {
                label: (context) => {
                  const value = context.parsed.y ?? 0;
                  const label = context.label || '';
                  return `${label}: ${formatNumber(value)}`;
                }
              }
            }
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { color: textColor, font: displayFont, padding: 8 }
            },
            y: {
              grid: { color: gridColor },
              ticks: { color: textColor, font: displayFont, padding: 8 }
            }
          }
        }
      });
    }
  };

  // Helper to render Category Distribution (Pie Chart)
  const renderCategoryPieChart = (canvas: HTMLCanvasElement, data: DataRow[], isDarkMode: boolean) => {
    const counts: { [key: string]: number } = {};
    data.forEach(row => {
      const cat = row.fieldA.trim() || 'Uncategorized';
      counts[cat] = (counts[cat] || 0) + 1;
    });

    // Sort categories by frequency and limit to top 5, group rest as "Other"
    const sortedCats = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
    let labels: string[] = [];
    let values: number[] = [];

    if (sortedCats.length <= 5) {
      labels = sortedCats;
      values = sortedCats.map(cat => counts[cat]);
    } else {
      labels = sortedCats.slice(0, 4);
      values = labels.map(cat => counts[cat]);

      const otherCount = sortedCats.slice(4).reduce((sum, cat) => sum + counts[cat], 0);
      labels.push('Other Categories');
      values.push(otherCount);
    }

    // Cohesive palettes with better contrast
    const backgroundColors = [
      'hsl(243, 75%, 59%)',
      'hsl(175, 75%, 45%)',
      'hsl(38, 92%, 50%)',
      'hsl(0, 72%, 51%)',
      'hsl(280, 70%, 55%)'
    ];

    // Adjust colors for dark mode
    const adjustedBgColors = isDarkMode
      ? backgroundColors.map(color => {
          // Lighten colors slightly for better visibility in dark mode
          return color.replace(')', ', 0.9)').replace('hsl', 'hsla');
        })
      : backgroundColors;

    pieChartInstance = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: values,
          backgroundColor: adjustedBgColors,
          borderWidth: isDarkMode ? 2 : 1,
          borderColor: isDarkMode ? 'hsl(222, 47%, 13%)' : 'white',
          hoverOffset: 8,
          hoverBorderWidth: 2,
          hoverBorderColor: isDarkMode ? 'hsl(222, 47%, 20%)' : 'hsl(0, 0%, 100%)'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: isDarkMode ? 'hsl(215, 20%, 65%)' : 'hsl(215, 16%, 47%)',
              font: { family: 'Inter', size: 11 },
              padding: 20,
              usePointStyle: true,
              pointStyle: 'circle'
            }

          },
          tooltip: {
            padding: 12,
            titleFont: { family: 'Outfit', weight: 'bold' },
            bodyFont: { family: 'Inter' },
            backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.8)',
            titleColor: '#fff',
            bodyColor: '#fff',
            borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)',
            borderWidth: 1,
            cornerRadius: 4,
            
            callbacks: {
              label: (context) => {
                const value = context.parsed;
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const percentage = ((value as number) / total * 100).toFixed(1);
                return `${context.label}: ${value} (${percentage}%)`;
              },
              title: (context) => {
                if (context[0].label) {
                  return `Category: ${context[0].label}`;
                }
                return '';
              }
            }
          }
        }
      }
    });
  };

  // 8. Custom State Renderers
  const renderEmptyState = () => {
    summaryContainer.innerHTML = '';
    destroyCharts();
    tableWrapper.innerHTML = `
      <div class="empty-state">
        <svg class="empty-state-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h3 class="empty-state-title" data-translate="noRecordsFound">No Records Found</h3>
        <p class="empty-state-desc" data-translate="noRecordsDesc">The connected Google Sheet is currently empty. Start by submitting entries via the Data Entry form.</p>
        <div style="margin-top: 24px;">
          <button id="btn-empty-add" class="btn btn-primary" data-translate-value="btnEmptyAdd" style="min-height: 48px; padding: 0 24px;">
            Add First Entry
          </button>
        </div>
      </div>
    `;

    document.getElementById('btn-empty-add')?.addEventListener('click', navigateToForm);

    // Focus the add entry button
    setTimeout(() => {
      document.getElementById('btn-empty-add')?.focus();
    }, 300);
  };

  const renderErrorState = (msg: string) => {
    summaryContainer.innerHTML = '';
    destroyCharts();
    errorContainer.innerHTML = `
      <div class="error-banner">
        <div class="error-banner-content">
          <div class="error-banner-icon">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" width="20" height="20">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <div>
            <strong data-translate="apiRetrieveFailure">API Retrieve Failure:</strong> ${sanitize(msg)}
          </div>
        </div>
        <button id="btn-error-retry" class="btn btn-secondary" style="min-height: 36px; padding: 0 12px; font-size: 0.8rem;" data-translate-value="btnRetry" aria-label="Retry data fetch">
          Retry
        </button>
      </div>
    `;

    document.getElementById('btn-error-retry')?.addEventListener('click', () => loadData(false));

    // Focus the retry button
    setTimeout(() => {
      document.getElementById('btn-error-retry')?.focus();
    }, 300);
  };

  // 9. Auto Refresh Timers & Controls with Enhanced UX
  const startRefreshCountdown = () => {
    stopRefreshCountdown(); // prevent duplicates
    const countdownEl = document.getElementById('countdown-sec') as HTMLElement;

    // Set initial value
    if (countdownEl) {
      countdownEl.textContent = countdownTimer.toString();
    }

    refreshTimerInterval = window.setInterval(() => {
      countdownTimer--;
      if (countdownEl) {
        countdownEl.textContent = countdownTimer.toString();

        // Add visual urgency when low
        if (countdownTimer <= 10) {
          countdownEl.style.color = 'var(--color-danger)'
          countdownEl.style.fontWeight = '600';
        } else {
          countdownEl.style.color = 'var(--text-muted)'
          countdownEl.style.fontWeight = '400';
        }
      }

      if (countdownTimer <= 0) {
        // Time's up! Reload silently
        loadData(true);
        resetCountdown();
      }
    }, 1000);
  };

  const stopRefreshCountdown = () => {
    if (refreshTimerInterval) {
      clearInterval(refreshTimerInterval);
      refreshTimerInterval = null;
    }
  };

  const resetCountdown = () => {
    countdownTimer = 60;
    const countdownEl = document.getElementById('countdown-sec') as HTMLElement;
    if (countdownEl) {
      countdownEl.textContent = '60';
      countdownEl.style.color = 'var(--text-muted)';
      countdownEl.style.fontWeight = '400';
    }
  };

  // 10. Wiring Main Events
  // Manual refresh click with enhanced feedback
  btnRefresh.addEventListener('click', async () => {
    // Add ripple effect
    btnRefresh.style.transform = 'scale(0.95)';
    setTimeout(() => {
      btnRefresh.style.transform = 'scale(1)';
    }, 100);

    loadData(false);

    // Show temporary toast for manual refresh
    setTimeout(() => {
      showToast('Refreshing', 'Fetching latest data...', 'warning');
    }, 300);
  });

  // Chart type dropdown selector with improved UX
  chartTypeSelector.addEventListener('change', () => {
    if (globalData.length > 0) {
      const trendCtx = document.getElementById('trend-analysis-chart') as HTMLCanvasElement;
      if (trendCtx) {
        // Clear previous instances of Line and Bar on this canvas
        if (lineChartInstance) { lineChartInstance.destroy(); lineChartInstance = null; }
        if (barChartInstance) { barChartInstance.destroy(); barChartInstance = null; }

        const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark' ||
          (!document.documentElement.hasAttribute('data-theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
        const gridColor = isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)';
        const textColor = isDarkMode ? 'hsl(215, 20%, 65%)' : 'hsl(215, 16%, 47%)';
        const displayFont = { family: 'Outfit, sans-serif', size: 11 };

        renderTrendChart(trendCtx, globalData, gridColor, textColor, displayFont, isDarkMode);

        // Show feedback
        const selectedOption = chartTypeSelector.selectedOptions[0];
        showToast('Chart Updated', `Switched to ${selectedOption.text} view`, 'success');
      }
    }
  });

  // Table Searching with debounce and enhanced UX
  let searchDebounceTimeout: number;
  searchInput.addEventListener('input', () => {
    // Clear placeholder when typing
    if (searchInput.value.length > 0) {
      searchInput.placeholder = '';
    } else {
      searchInput.placeholder = translations[localStorage.getItem(LANGUAGE_KEY) as keyof typeof translations || 'en'].searchPlaceholder;
    }

    searchQuery = searchInput.value;
    clearTimeout(searchDebounceTimeout);

    // Add typing animation
    searchInput.style.boxShadow = '0 0 0 2px var(--color-brand-glow)';
    setTimeout(() => {
      searchInput.style.boxShadow = '';
    }, 300);

    searchDebounceTimeout = window.setTimeout(() => {
      currentPage = 1; // reset page on search
      applyFiltersAndSorting();

      // Show search results count
      if (filteredData.length !== globalData.length) {
        showToast('Search Results', `${filteredData.length} of ${globalData.length} records match`, 'success');
      }
    }, 300);
  });

  // Clear search on escape key
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      searchInput.value = '';
      searchQuery = '';
      applyFiltersAndSorting();

      // Restore placeholder
      searchInput.placeholder = translations[localStorage.getItem(LANGUAGE_KEY) as keyof typeof translations || 'en'].searchPlaceholder;
    }
  });

  // Add entry button click handler
  btnAddEntry.addEventListener('click', () => {
    navigateToForm();
    // Focus first field in form after navigation
    setTimeout(() => {
      const inputA = document.getElementById('field-a');
      if (inputA) {
        (inputA as HTMLInputElement).focus();
      }
    }, 500);
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Ctrl+R for manual refresh
    if (e.ctrlKey && e.key.toLowerCase() === 'r' && !e.shiftKey) {
      e.preventDefault();
      btnRefresh.click();
    }

    // Ctrl+F for search focus
    if (e.ctrlKey && e.key.toLowerCase() === 'f') {
      e.preventDefault();
      searchInput.focus();
    }

    // Ctrl+N for new entry
    if (e.ctrlKey && e.key.toLowerCase() === 'n') {
      e.preventDefault();
      navigateToForm();
    }
  });

  // 11. Initial Page Load Execution
  loadData(false);
  startRefreshCountdown();

  // 12. Return Cleanup function
  return () => {
    stopRefreshCountdown();
    destroyCharts();

    // Clear timeouts
    if (renderTableTimeout) clearTimeout(renderTableTimeout);
    if (renderChartsTimeout) clearTimeout(renderChartsTimeout);
    if (searchDebounceTimeout) clearTimeout(searchDebounceTimeout);
  };
}
