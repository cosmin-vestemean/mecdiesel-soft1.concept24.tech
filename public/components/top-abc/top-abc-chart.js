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

  constructor() {
    super();
    this.data = [];
    this.token = '';
    this.loading = false;
    this.error = '';
    this.selectedChart = 'pareto';
    this.params = {
      dataReferinta: new Date().toISOString().slice(0, 10),
      nrSaptamani: 52,
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
  }

  connectedCallback() {
    super.connectedCallback();
    // Load Chart.js dynamically
    if (!window.Chart) {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
      script.onload = () => {
        // Once Chart.js is loaded, we can fetch data
        this.fetchData();
      };
      document.head.appendChild(script);
    } else {
      this.fetchData();
    }
  }

  async fetchData() {
    if (!this.token) {
      this.token = sessionStorage.getItem('s1Token');
      if (!this.token) {
        this.error = 'No token found. Please log in.';
        return;
      }
    }

    try {
      this.loading = true;
      this.error = '';

      // Create a copy of params and ensure date is properly quoted for SQL
      const params = { ...this.params };
      
      // Ensure dataReferinta is correctly formatted for SQL (needs to be quoted)
      if (params.dataReferinta) {
        // Make sure we're sending the date in quotes (SQL format)
        params.dataReferinta = `'${params.dataReferinta}'`;
      }
      
      const response = await client.service('top-abc').getTopAbcAnalysis({
        token: this.token,
        ...params
      });

        console.log('API Response:', response);

      if (response.success) {
        this.data = response.rows || [];
        this.renderChart();
      } else {
        this.error = response.message || 'An error occurred while fetching data';
        console.error('Error fetching data:', response);
      }
    } catch (error) {
      this.error = `Error: ${error.message}`;
      console.error('Exception:', error);
    } finally {
      this.loading = false;
    }
  }

  renderChart() {
    if (!this.data || this.data.length === 0) return;
    
    // Wait for the DOM to be updated
    setTimeout(() => {
      const canvas = this.renderRoot.querySelector('#abcChart');
      if (!canvas) return;

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
    // Sort data by Value in descending order
    const sortedData = [...this.data].sort((a, b) => b.Value - a.Value);
    
    const labels = [];
    const values = [];
    
    // Take only the top 30 items for better readability
    sortedData.slice(0, 30).forEach(item => {
      labels.push(item.Code || item.Cod); // Adjust property name as needed
      values.push(item.Value);
    });

    // Use our helper function to create the chart configuration
    const chartConfig = createParetoChartConfig({
      labels: labels,
      values: values,
      title: 'Top ABC Analysis - Pareto Chart',
      xAxisLabel: 'Products',
      yAxisLabel: 'Value'
    });
    
    this.chartInstance = new Chart(ctx, chartConfig);
  }

  renderDistributionChart(ctx) {
    // Count items in each ABC class
    const abcCounts = this.data.reduce((counts, item) => {
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
      values[abc] = (values[abc] || 0) + (item.Value || 0);
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

  async handleRefreshData() {
    await this.fetchData();
  }

  render() {
    return html`
      <style>
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
          color: red;
          margin: 10px 0;
        }
        .loading {
          text-align: center;
          margin: 20px 0;
        }
        select, button {
          padding: 8px;
          border-radius: 4px;
          border: 1px solid #ccc;
        }
        button {
          background-color: #4CAF50;
          color: white;
          border: none;
          cursor: pointer;
          transition: background-color 0.3s;
        }
        button:hover {
          background-color: #45a049;
        }
      </style>
      
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
      ${this.loading ? html`<div class="loading">Loading data...</div>` : ''}
      
      <div class="chart-container">
        <canvas id="abcChart"></canvas>
      </div>
    `;
  }
}

// Register the custom element
customElements.define('top-abc-chart', TopAbcChart);