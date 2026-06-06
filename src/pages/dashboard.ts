import { Chart, registerables } from 'chart.js';
import { fetchData, isApiConfigured } from '../api';
import type { DataRow } from '../types';
import { calculateSummary, formatDate, formatNumber, sanitize } from '../utils/helpers';

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

  // Timers & Intervals
  let refreshTimerInterval: number | null = null;
  let countdownTimer = 60;

  // 1. Render Dashboard Layout Shell
  container.innerHTML = `
    <div class="dashboard-layout">
      <!-- Toolbar: Manual Refresh and Auto Refresh Status -->
      <div class="table-toolbar" style="margin-bottom: 24px;">
        <div>
          <p style="color: var(--text-muted); font-size: 0.9rem;">Real-time analytics and data summary from Google Sheets.</p>
        </div>
        <div class="header-actions">
          <div class="refresh-countdown" id="refresh-countdown-container">
            <span class="countdown-text">Refreshing in <strong id="countdown-sec">60</strong>s</span>
          </div>
          <button id="btn-manual-refresh" class="btn btn-secondary" style="min-height: 40px; padding: 0 16px;">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" width="16" height="16" id="refresh-icon">
              <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            Refresh
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
            <h3 style="font-size: 1rem;">Values Trend & Analysis</h3>
            <div class="page-size-selector" style="font-size: 0.8rem;">
              <select id="chart-type-selector">
                <option value="line">Line Chart (Trend Over Time)</option>
                <option value="bar">Bar Chart (Averages by Category)</option>
              </select>
            </div>
          </div>
          <div class="chart-container">
            <canvas id="trend-analysis-chart"></canvas>
          </div>
        </div>
        
        <!-- Right: Pie share distribution card -->
        <div class="card chart-card">
          <h3 style="font-size: 1rem; margin-bottom: 16px;">Category Distribution</h3>
          <div class="chart-container">
            <canvas id="category-distribution-chart"></canvas>
          </div>
        </div>
      </div>

      <!-- Data Table Card -->
      <div class="card" style="padding: 0; overflow: hidden;" id="table-card-container">
        <div style="padding: 24px 24px 8px 24px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
          <h3 style="font-size: 1.1rem;">Data Records</h3>
          <div class="search-wrapper">
            <svg class="search-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input type="text" id="table-search" class="search-input" placeholder="Search rows...">
          </div>
        </div>
        
        <!-- Table container wrapper -->
        <div id="table-responsive-wrapper">
          <!-- Table element is loaded here -->
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

    // Disable buttons
    btnRefresh.disabled = true;
    refreshIcon.classList.add('spin-icon');
  };

  // 3. Destroy all chart instances
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
  };

  // 4. Fetch and Load Data
  const loadData = async (silent = false) => {
    if (!isApiConfigured()) {
      renderUnconfiguredState();
      return;
    }

    if (!silent) {
      destroyCharts();
      renderSkeletons();
    } else {
      btnRefresh.disabled = true;
      refreshIcon.classList.add('spin-icon');
    }

    errorContainer.innerHTML = ''; // clear error
    
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
        }
      } else {
        renderErrorState(response.message || 'API failed to retrieve data records.');
      }
    } catch (err) {
      renderErrorState('A network connectivity error occurred. Please check settings and retry.');
    } finally {
      btnRefresh.disabled = false;
      refreshIcon.classList.remove('spin-icon');
      resetCountdown();
    }
  };

  // 5. Update Metrics Cards
  const updateSummaryMetrics = (data: DataRow[]) => {
    const stats = calculateSummary(data);
    summaryContainer.innerHTML = `
      <div class="card metric-card">
        <span class="metric-label">Total Records</span>
        <span class="metric-value">${stats.totalRecords}</span>
      </div>
      <div class="card metric-card">
        <span class="metric-label">Average Value (B)</span>
        <span class="metric-value">${formatNumber(stats.avgFieldB)}</span>
      </div>
      <div class="card metric-card">
        <span class="metric-label">Max Value (B)</span>
        <span class="metric-value">${formatNumber(stats.maxFieldB)}</span>
      </div>
      <div class="card metric-card">
        <span class="metric-label">Min Value (B)</span>
        <span class="metric-value">${formatNumber(stats.minFieldB)}</span>
      </div>
    `;
  };

  // 6. Data Filtering, Sorting, and Table Rendering
  const applyFiltersAndSorting = () => {
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

  // Render HTML Table with pagination
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
          <span class="sort-icon" style="color: var(--color-brand)">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
            </svg>
          </span>
        `
        : `
          <span class="sort-icon" style="color: var(--color-brand)">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </span>
        `;
    };

    if (totalRecords === 0) {
      tableWrapper.innerHTML = `
        <div style="padding: 40px; text-align: center; color: var(--text-muted);">
          No matching records found for search queries.
        </div>
      `;
      return;
    }

    tableWrapper.innerHTML = `
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th class="sortable" data-col="timestamp">Timestamp ${getSortIndicator('timestamp')}</th>
              <th class="sortable" data-col="fieldA">Field A ${getSortIndicator('fieldA')}</th>
              <th class="sortable" data-col="fieldB">Field B ${getSortIndicator('fieldB')}</th>
              <th class="sortable" data-col="fieldC">Field C ${getSortIndicator('fieldC')}</th>
            </tr>
          </thead>
          <tbody>
            ${paginatedData.map(row => `
              <tr>
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
            Show 
            <select id="select-page-size">
              <option value="5" ${pageSize === 5 ? 'selected' : ''}>5</option>
              <option value="10" ${pageSize === 10 ? 'selected' : ''}>10</option>
              <option value="20" ${pageSize === 20 ? 'selected' : ''}>20</option>
              <option value="50" ${pageSize === 50 ? 'selected' : ''}>50</option>
            </select>
            entries
          </div>
          <div>
            Showing ${startIdx + 1} to ${endIdx} of ${totalRecords} entries
          </div>
          <div class="pagination-controls">
            <button id="btn-page-prev" class="pagination-btn" ${currentPage === 1 ? 'disabled' : ''}>
              Prev
            </button>
            <button id="btn-page-next" class="pagination-btn" ${currentPage === totalPages ? 'disabled' : ''}>
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
  };

  // 7. Visualizations rendering with Chart.js
  const renderCharts = (data: DataRow[]) => {
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
      renderTrendChart(trendCtx, data, gridColor, textColor, displayFont);
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
    displayFont: any
  ) => {
    // Sort chronologically for time plot
    const chronologicalData = [...data].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const isLineType = chartTypeSelector.value === 'line';

    if (isLineType) {
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
              bodyFont: { family: 'Inter' }
            }
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { color: textColor, font: displayFont }
            },
            y: {
              grid: { color: gridColor },
              ticks: { color: textColor, font: displayFont }
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

      const labels = Object.keys(categories);
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
            barThickness: 24
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
              bodyFont: { family: 'Inter' }
            }
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { color: textColor, font: displayFont }
            },
            y: {
              grid: { color: gridColor },
              ticks: { color: textColor, font: displayFont }
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

    // Cohesive palettes
    const backgroundColors = [
      'hsl(243, 75%, 59%)',
      'hsl(175, 75%, 45%)',
      'hsl(38, 92%, 50%)',
      'hsl(0, 72%, 51%)',
      'hsl(280, 70%, 55%)'
    ];

    pieChartInstance = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: values,
          backgroundColor: backgroundColors,
          borderWidth: isDarkMode ? 2 : 1,
          borderColor: isDarkMode ? 'hsl(222, 47%, 13%)' : 'white',
          hoverOffset: 6
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
              padding: 12,
              usePointStyle: true,
              pointStyle: 'circle'
            }
          },
          tooltip: {
            padding: 10,
            titleFont: { family: 'Outfit', weight: 'bold' },
            bodyFont: { family: 'Inter' }
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
        <h3 class="empty-state-title">No Records Found</h3>
        <p class="empty-state-desc">The connected Google Sheet is currently empty. Start by submitting entries via the Data Entry form.</p>
        <button id="btn-empty-add" class="btn btn-primary">
          Add First Entry
        </button>
      </div>
    `;

    document.getElementById('btn-empty-add')?.addEventListener('click', navigateToForm);
  };

  const renderErrorState = (msg: string) => {
    summaryContainer.innerHTML = '';
    destroyCharts();
    errorContainer.innerHTML = `
      <div class="error-banner">
        <div class="error-banner-content">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" width="20" height="20">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <strong>API Retrieve Failure:</strong> ${sanitize(msg)}
        </div>
        <button id="btn-error-retry" class="btn btn-secondary" style="min-height: 36px; padding: 0 12px; font-size: 0.8rem;">
          Retry
        </button>
      </div>
    `;

    document.getElementById('btn-error-retry')?.addEventListener('click', () => loadData(false));
  };

  const renderUnconfiguredState = () => {
    summaryContainer.innerHTML = '';
    destroyCharts();
    tableWrapper.innerHTML = `
      <div class="empty-state" style="border-style: solid; border-color: var(--color-warning);">
        <svg class="empty-state-icon" style="color: var(--color-warning);" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <h3 class="empty-state-title" style="color: var(--color-warning);">API Endpoint Unconfigured</h3>
        <p class="empty-state-desc">The dashboard is missing a Google Apps Script Web App URL. Please click the button below to paste your URL.</p>
        <button id="btn-configure-now" class="btn btn-primary" style="background-color: var(--color-warning); box-shadow: 0 4px 12px rgba(245,158,11,0.2);">
          Open Settings Modal
        </button>
      </div>
    `;

    document.getElementById('btn-configure-now')?.addEventListener('click', () => {
      // Find settings btn in sidebar and click it
      const settingsBtn = document.getElementById('sidebar-btn-settings') || document.getElementById('mobile-btn-settings');
      if (settingsBtn) {
        settingsBtn.click();
      }
    });
  };

  // 9. Auto Refresh Timers & Controls
  const startRefreshCountdown = () => {
    stopRefreshCountdown(); // prevent duplicates
    const countdownEl = document.getElementById('countdown-sec') as HTMLElement;
    
    refreshTimerInterval = window.setInterval(() => {
      countdownTimer--;
      if (countdownEl) {
        countdownEl.textContent = countdownTimer.toString();
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
    }
  };

  // 10. Wiring Main Events
  // Manual refresh click
  btnRefresh.addEventListener('click', () => {
    loadData(false);
  });

  // Chart type dropdown selector
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
        
        renderTrendChart(trendCtx, globalData, gridColor, textColor, displayFont);
      }
    }
  });

  // Table Searching with debounce
  let searchDebounceTimeout: number;
  searchInput.addEventListener('input', () => {
    searchQuery = searchInput.value;
    clearTimeout(searchDebounceTimeout);
    
    searchDebounceTimeout = window.setTimeout(() => {
      currentPage = 1; // reset page on search
      applyFiltersAndSorting();
    }, 250);
  });

  // 11. Initial Page Load Execution
  loadData(false);
  startRefreshCountdown();

  // 12. Return Cleanup function
  return () => {
    stopRefreshCountdown();
    destroyCharts();
  };
}
