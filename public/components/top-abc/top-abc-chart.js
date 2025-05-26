// Top ABC Analysis Chart Component
import { LitElement, html, css } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';
import { client } from '../../socketConfig.js';
import { 
  generateChartColors, 
  formatNumber, 
  createParetoChartConfig,
  getAbcClassColor
} from '../chart-helpers.js';

export class TopAbcChart extends LitElement {
  static get properties() {
    return {
      data: { type: Array },
      token: { type: String },
      loading: { type: Boolean },
      error: { type: String },
      selectedChart: { type: String },
      params: { type: Object },
      chartInstance: { type: Object },
      chartType: { type: String }
    };
  }

  // Use Shadow DOM instead of Light DOM for proper style encapsulation
  static get styles() {
    return css`
      :host {
        display: block;
        font-family: var(--bs-font-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", "Liberation Sans", Arial, sans-serif);
      }
      .chart-container {
        position: relative;
        height: 500px;
        width: 100%;
        margin-top: 20px;
      }
      .controls {
        margin-bottom: 15px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .error-message {
        color: #dc3545;
        margin: 10px 0;
        padding: 0.75rem 1.25rem;
        border: 1px solid #f5c6cb;
        border-radius: 0.25rem;
        background-color: #f8d7da;
      }
      .loading {
        text-align: center;
        margin: 20px 0;
        color: #6c757d;
      }
      select, button {
        padding: 8px;
        border-radius: 4px;
        border: 1px solid #ced4da;
      }
      button {
        background-color: #0d6efd;
        color: white;
        border: none;
        cursor: pointer;
        font-weight: 400;
        text-align: center;
        padding: 0.375rem 0.75rem;
      }
      button:hover {
        background-color: #0b5ed7;
      }
      select {
        background-color: #fff;
        padding: 0.375rem 0.75rem;
      }
    `;
  }

  constructor() {
    super();
    this.data = [];
    this.token = '';
    this.loading = false;
    this.error = '';
    this.selectedChart = 'pareto';
    this.params = {
      dataReferinta: new Date().toISOString().slice(0, 10),
      nrSaptamani: 24,
      seriesL: '',
      branch: '',
      supplier: null,
      mtrl: null,
      cod: '',
      searchType: 1,
      modFiltrareBranch: 'AGENT',
      thresholdA: 80,
      thresholdB: 15
    };
    this.chartInstance = null;
    this.chartType = 'pareto';
    
    // Ensure Chart.js is available
    if (typeof window !== 'undefined' && !window.Chart) {
      this.loadChartJS();
    }
  }
  
  loadChartJS() {
    console.log('Loading Chart.js dynamically...');
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
    script.async = true;
    script.onload = () => {
      console.log('Chart.js loaded successfully');
      if (this.data && this.data.length > 0) {
        this.renderChart();
      }
    };
    script.onerror = () => {
      console.error('Failed to load Chart.js');
      this.error = 'Failed to load chart library. Please try refreshing the page.';
    };
    document.head.appendChild(script);
  }

  connectedCallback() {
    super.connectedCallback();
    
    // Check if Chart.js is available
    if (!window.Chart) {
      this.loadChartJS();
    } else if (this.data && this.data.length > 0) {
      // Chart.js is already loaded, try to render
      this.renderChart();
    }
  }
  
  // This is now triggered from data changes via property change callback
  updated(changedProps) {
    super.updated(changedProps);
    if (changedProps.has('data')) {
      console.log('Data property changed:', this.data ? this.data.length : 0, 'items');
      if (this.data && this.data.length > 0) {
        // Log the first item to see its structure
        console.log('First item properties:', Object.keys(this.data[0]));
        console.log('Sample data item:', this.data[0]);
        
        if (window.Chart) {
          this.renderChart();
        }
      }
    }
  }

  renderChart() {
    if (!this.data || this.data.length === 0) {
      console.log('No data available for chart rendering');
      return;
    }
    
    console.log('Rendering chart with', this.data.length, 'items');
    console.log('Chart type:', this.chartType);
    console.log('Sample item:', this.data[0]);
    
    // Wait for the DOM to be updated
    setTimeout(() => {
      const canvas = this.shadowRoot.querySelector('#abcChart'); // Use shadowRoot for shadow DOM
      if (!canvas) {
        console.error('Canvas element not found for chart rendering');
        return;
      }

      // Destroy previous chart instance if it exists
      if (this.chartInstance) {
        this.chartInstance.destroy();
      }

      const ctx = canvas.getContext('2d');
      
      if (this.chartType === 'pareto') {
        this.renderParetoChart(ctx);
      } else if (this.chartType === 'distribution') {
        this.renderDistributionChart(ctx);
      } else if (this.chartType === 'value') {
        this.renderValueChart(ctx);
      }
    }, 10);
  }

  renderParetoChart(ctx) {
    // Sort data by VALUE in descending order (using exact column names from SQL)
    const sortedData = [...this.data].sort((a, b) => {
      return b.VALUE - a.VALUE;
    });
    
    const labels = [];
    const values = [];
    const cumulativePercentages = [];
    
    // Take only the top 30 items for better readability
    sortedData.slice(0, 30).forEach(item => {
      labels.push(item.CODE || ''); // Use exact SQL column name
      values.push(item.VALUE || 0);
      // Use the pre-calculated cumulative percentage from SQL
      cumulativePercentages.push(item.CUMULATIVEPERC || 0);
    });

    // Log the data for debugging
    console.log('Pareto Chart Data:', {
      totalItems: this.data.length,
      displayedItems: labels.length,
      firstItem: sortedData[0] ? {
        code: sortedData[0].CODE,
        value: sortedData[0].VALUE,
        sqlCumulative: sortedData[0].CUMULATIVEPERC
      } : null,
      lastDisplayedItem: sortedData[29] ? {
        code: sortedData[29].CODE,
        value: sortedData[29].VALUE,
        sqlCumulative: sortedData[29].CUMULATIVEPERC
      } : null
    });

    // Use our helper function to create the chart configuration
    const chartConfig = createParetoChartConfig({
      labels: labels,
      values: values,
      cumulativePercentages: cumulativePercentages, // Pass the SQL-calculated values
      title: 'Top ABC Analysis - Pareto Chart',
      xAxisLabel: 'Products',
      yAxisLabel: 'Value'
    });
    
    this.chartInstance = new Chart(ctx, chartConfig);
  }

  renderDistributionChart(ctx) {
    // Count items in each ABC class
    const abcCounts = this.data.reduce((counts, item) => {
      // Use exact SQL column name
      const abc = item.ABC || 'Unknown';
      counts[abc] = (counts[abc] || 0) + 1;
      return counts;
    }, {});

    const labels = Object.keys(abcCounts);
    const data = labels.map(label => abcCounts[label]);
    
    // Use our helper function to get colors for ABC classes
    const backgroundColors = labels.map(label => getAbcClassColor(label, 0.7));
    const borderColors = labels.map(label => getAbcClassColor(label, 1));

    this.chartInstance = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: labels,
        datasets: [{
          label: 'Items Count',
          data: data,
          backgroundColor: backgroundColors,
          borderColor: borderColors,
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'ABC Analysis - Distribution'
          },
          legend: {
            position: 'top',
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const label = context.label;
                const value = context.parsed;
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const percentage = ((value / total) * 100).toFixed(2);
                return `${label}: ${formatNumber(value)} (${percentage}%)`;
              }
            }
          }
        }
      }
    });
  }

  renderValueChart(ctx) {
    // Calculate total value by ABC class
    const abcValues = this.data.reduce((values, item) => {
      const abc = item.ABC || 'Unknown';
      values[abc] = (values[abc] || 0) + (item.VALUE || 0);
      return values;
    }, {});

    const labels = Object.keys(abcValues);
    const data = labels.map(label => abcValues[label]);
    
    // Use our helper function to get colors for ABC classes
    const backgroundColors = labels.map(label => getAbcClassColor(label, 0.7));
    const borderColors = labels.map(label => getAbcClassColor(label, 1));

    this.chartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          label: 'Total Value',
          data: data,
          backgroundColor: backgroundColors,
          borderColor: borderColors,
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'ABC Analysis - Value Distribution'
          },
          legend: {
            position: 'top',
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const label = context.label;
                const value = context.parsed;
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const percentage = ((value / total) * 100).toFixed(2);
                return `${label}: ${formatNumber(value)} (${percentage}%)`;
              }
            }
          }
        }
      }
    });
  }

  handleChartTypeChange(e) {
    this.chartType = e.target.value;
    this.renderChart();
  }

  handleRefreshData() {
    // Dispatch an event to the parent to request data refresh
    this.dispatchEvent(new CustomEvent('refresh-data', {
      bubbles: true,
      composed: true
    }));
  }

  render() {
    return html`
      <div class="controls">
        <div>
          <label for="chartType">Chart Type:</label>
          <select id="chartType" @change="${this.handleChartTypeChange}">
            <option value="pareto" ?selected=${this.chartType === 'pareto'}>Pareto Chart</option>
            <option value="distribution" ?selected=${this.chartType === 'distribution'}>Distribution</option>
            <option value="value" ?selected=${this.chartType === 'value'}>Value Distribution</option>
          </select>
        </div>
        <button @click="${this.handleRefreshData}">Refresh Data</button>
      </div>
      
      ${this.error ? html`<div class="error-message">${this.error}</div>` : ''}
      ${this.loading ? html`<div class="loading">Loading...</div>` : ''}
      
      <div class="chart-container">
        <canvas id="abcChart"></canvas>
      </div>
    `;
  }
}

// Register the custom element
customElements.define('top-abc-chart', TopAbcChart);