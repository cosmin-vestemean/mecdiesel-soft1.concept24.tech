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
        gap: 15px;
        flex-wrap: wrap;
      }
      .controls > div {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .controls label {
        font-weight: 500;
        color: #495057;
        white-space: nowrap;
        font-size: 0.875rem;
      }
      .controls select {
        padding: 6px 10px;
        border: 1px solid #ced4da;
        border-radius: 4px;
        background-color: white;
        font-size: 0.875rem;
        min-width: 140px;
        transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
      }
      .controls select:focus {
        outline: none;
        border-color: #80bdff;
        box-shadow: 0 0 0 2px rgba(0,123,255,.25);
      }
      .controls button {
        padding: 6px 12px;
        background-color: #007bff;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.875rem;
        font-weight: 500;
        transition: background-color 0.15s ease-in-out;
      }
      .controls button:hover {
        background-color: #0056b3;
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
      .period-info {
        background-color: #f8f9fa;
        border: 1px solid #dee2e6;
        border-radius: 6px;
        padding: 12px;
        margin-bottom: 15px;
        color: #495057;
      }
      .period-info strong {
        color: #212529;
      }
      .period-info small {
        color: #6c757d;
        font-size: 0.8rem;
      }
      
      @media (max-width: 768px) {
        .controls {
          flex-direction: column;
          align-items: stretch;
        }
        .controls > div {
          justify-content: space-between;
        }
        .controls select {
          min-width: auto;
          flex: 1;
          margin-left: 10px;
        }
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
    this.paretoDisplayMode = 'smart'; // 'top30', 'smart', 'classA', 'to80percent', 'to95percent', 'adaptive'
    this.maxDisplayItems = 50; // Maximum items to display
    
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
    
    // Determine optimal number of items to display
    const displayCount = this.getOptimalDisplayItems(sortedData);
    
    const labels = [];
    const values = [];
    const cumulativePercentages = [];
    
    // Take the optimal number of items for display
    sortedData.slice(0, displayCount).forEach(item => {
      // Shorten long codes for better display
      const displayCode = this.shortenCode(item.CODE || '');
      labels.push(displayCode);
      values.push(item.VALUE || 0);
      // Use the pre-calculated cumulative percentage from SQL
      cumulativePercentages.push(item.CUMULATIVEPERC || 0);
    });

    // Log the data for debugging
    console.log('Pareto Chart Data:', {
      totalItems: this.data.length,
      displayedItems: labels.length,
      displayMode: this.paretoDisplayMode,
      lastCumulative: cumulativePercentages[cumulativePercentages.length - 1],
      firstItem: sortedData[0] ? {
        code: sortedData[0].CODE,
        value: sortedData[0].VALUE,
        sqlCumulative: sortedData[0].CUMULATIVEPERC
      } : null
    });

    // Use our helper function to create the chart configuration
    const chartConfig = createParetoChartConfig({
      labels: labels,
      values: values,
      cumulativePercentages: cumulativePercentages, // Pass the SQL-calculated values
      title: `Top ABC Analysis - Pareto Chart (${displayCount}/${this.data.length} produse)`,
      xAxisLabel: 'Products',
      yAxisLabel: 'Value'
    });
    
    // Enhance chart configuration for better readability with more items
    this.enhanceChartForMoreItems(chartConfig, displayCount);
    
    // Get detailed information about the display strategy being used
    const displayInfo = this.getDisplayStrategyInfo(sortedData);
    
    // Enhance title with strategy information
    this.updateChartTitle(chartConfig, displayInfo);
    
    this.chartInstance = new Chart(ctx, chartConfig);
  }

  // Shorten product codes for better display
  shortenCode(code) {
    if (!code || code.length <= 12) return code;
    
    // Try to find meaningful abbreviation
    // Remove common prefixes/suffixes or take first and last parts
    if (code.includes('-')) {
      const parts = code.split('-');
      if (parts.length >= 2) {
        return parts[0].substring(0, 6) + '-' + parts[parts.length - 1].substring(0, 4);
      }
    }
    
    // Fallback: first 8 chars + last 4 chars
    return code.substring(0, 8) + '...' + code.substring(code.length - 4);
  }

  // Enhance chart configuration for displaying more items
  enhanceChartForMoreItems(chartConfig, itemCount) {
    if (!chartConfig.options) chartConfig.options = {};
    if (!chartConfig.options.scales) chartConfig.options.scales = {};
    if (!chartConfig.options.scales.x) chartConfig.options.scales.x = {};
    
    // Calculate optimal settings based on item count
    let maxRotation = 45;
    let minRotation = 0;
    let fontSize = 10;
    let chartHeight = '500px';
    let tickFrequency = 1;
    
    // Progressive adjustments based on item count
    if (itemCount > 25) {
      maxRotation = 60;
      minRotation = 30;
      fontSize = 9;
      chartHeight = '550px';
    }
    
    if (itemCount > 35) {
      maxRotation = 90;
      minRotation = 45;
      fontSize = 8;
      chartHeight = '600px';
      // Start showing every other label
      tickFrequency = 2;
    }
    
    if (itemCount > 45) {
      maxRotation = 90;
      minRotation = 90;
      fontSize = 7;
      chartHeight = '650px';
      // Show every third label
      tickFrequency = 3;
    }
    
    if (itemCount > 55) {
      fontSize = 6;
      chartHeight = '700px';
      // Show every fourth label
      tickFrequency = 4;
    }
    
    // Apply label rotation and size settings
    chartConfig.options.scales.x.ticks = {
      ...chartConfig.options.scales.x.ticks,
      maxRotation: maxRotation,
      minRotation: minRotation,
      font: {
        size: fontSize
      },
      callback: function(value, index, ticks) {
        // Show labels based on frequency to avoid overcrowding
        if (index % tickFrequency === 0) {
          return this.getLabelForValue(value);
        }
        return '';
      }
    };
    
    // Adjust chart height dynamically
    const container = this.shadowRoot.querySelector('.chart-container');
    if (container) {
      container.style.height = chartHeight;
    }
    
    // Adjust chart margins for better label visibility
    if (!chartConfig.options.layout) chartConfig.options.layout = {};
    chartConfig.options.layout.padding = {
      bottom: Math.max(20, itemCount > 40 ? 40 : 20)
    };
    
    console.log(`🎨 Chart enhanced for ${itemCount} items: rotation=${maxRotation}°, fontSize=${fontSize}px, height=${chartHeight}, frequency=1/${tickFrequency}`);
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

  // Calculate the analysis period based on reference date and number of weeks
  getAnalysisPeriod() {
    if (!this.params.dataReferinta || !this.params.nrSaptamani) {
      return { startDate: null, endDate: null, periodText: 'Nu sunt definite parametrii de analiză' };
    }

    const referenceDate = new Date(this.params.dataReferinta);
    const weeksAgo = this.params.nrSaptamani;
    
    // Calculate start date (reference date minus number of weeks)
    const startDate = new Date(referenceDate);
    startDate.setDate(startDate.getDate() - (weeksAgo * 7));
    
    // Format dates
    const formatDate = (date) => {
      return date.toLocaleDateString('ro-RO', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
    };

    const startDateStr = formatDate(startDate);
    const endDateStr = formatDate(referenceDate);
    
    const periodText = `Perioada analizată: ${startDateStr} - ${endDateStr} (${weeksAgo} săptămâni)`;
    
    return { 
      startDate: startDate, 
      endDate: referenceDate, 
      periodText: periodText,
      weeks: weeksAgo
    };
  }

  // Determine optimal number of items to display based on various strategies
  getOptimalDisplayItems(sortedData) {
    const strategies = {
      'top30': () => 30,
      'smart': () => this.calculateSmartDisplayCount(sortedData),
      'classA': () => this.getClassACount(sortedData),
      'to80percent': () => this.getItemsToPercentage(sortedData, 80),
      'to95percent': () => this.getItemsToPercentage(sortedData, 95),
      'adaptive': () => this.calculateAdaptiveDisplayCount(sortedData)
    };
    
    const count = strategies[this.paretoDisplayMode] ? strategies[this.paretoDisplayMode]() : strategies['smart']();
    const finalCount = Math.min(count, this.maxDisplayItems, sortedData.length);
    
    console.log(`📊 Display Strategy: ${this.paretoDisplayMode}, Items: ${finalCount}/${sortedData.length} (${(finalCount/sortedData.length*100).toFixed(1)}%)`);
    return finalCount;
  }

  // Adaptive algorithm that combines multiple strategies
  calculateAdaptiveDisplayCount(sortedData) {
    const totalItems = sortedData.length;
    const to80Count = this.getItemsToPercentage(sortedData, 80);
    const to95Count = this.getItemsToPercentage(sortedData, 95);
    const classACount = this.getClassACount(sortedData);
    const smartCount = this.calculateSmartDisplayCount(sortedData);
    
    // Calculate weighted average of different strategies
    const weights = {
      smart: 0.4,
      to80: 0.3,
      classA: 0.2,
      to95: 0.1
    };
    
    const weightedCount = Math.round(
      smartCount * weights.smart +
      to80Count * weights.to80 +
      classACount * weights.classA +
      to95Count * weights.to95
    );
    
    // Ensure reasonable bounds
    return Math.max(20, Math.min(weightedCount, 60, totalItems));
  }

  // Smart algorithm to determine display count based on data distribution
  calculateSmartDisplayCount(sortedData) {
    const totalItems = sortedData.length;
    
    // Find where 80% and 95% thresholds are reached
    const to80Index = this.getItemsToPercentage(sortedData, 80);
    const to95Index = this.getItemsToPercentage(sortedData, 95);
    
    // Determine optimal count based on data distribution and size
    let optimalCount;
    
    if (totalItems <= 20) {
      // Small datasets: show everything
      optimalCount = totalItems;
    } else if (totalItems <= 50) {
      // Medium datasets: focus on 80% threshold with some buffer
      optimalCount = Math.max(to80Index + 5, Math.min(35, totalItems));
    } else if (totalItems <= 100) {
      // Large datasets: balance between 80% and 95% thresholds
      const buffer = Math.ceil((to95Index - to80Index) * 0.3);
      optimalCount = Math.min(to80Index + buffer, 45, totalItems);
    } else if (totalItems <= 200) {
      // Very large datasets: focus on 80% with minimal extension
      const buffer = Math.ceil((to95Index - to80Index) * 0.2);
      optimalCount = Math.min(to80Index + buffer, 50, totalItems);
    } else {
      // Massive datasets: strict Pareto principle
      optimalCount = Math.min(to80Index + 5, 50, totalItems);
    }
    
    // Ensure we show at least the 80% threshold items
    return Math.max(optimalCount, Math.min(to80Index, 30));
  }

  // Get count of items in class A
  getClassACount(sortedData) {
    return sortedData.filter(item => item.ABC === 'A').length;
  }

  // Get number of items needed to reach a specific cumulative percentage
  getItemsToPercentage(sortedData, targetPercentage) {
    for (let i = 0; i < sortedData.length; i++) {
      if (sortedData[i].CUMULATIVEPERC >= targetPercentage) {
        return i + 1;
      }
    }
    return sortedData.length;
  }

  // Get detailed information about the display strategy being used
  getDisplayStrategyInfo(sortedData) {
    const totalItems = sortedData.length;
    const to80Count = this.getItemsToPercentage(sortedData, 80);
    const to95Count = this.getItemsToPercentage(sortedData, 95);
    const classACount = this.getClassACount(sortedData);
    const smartCount = this.calculateSmartDisplayCount(sortedData);
    const adaptiveCount = this.calculateAdaptiveDisplayCount(sortedData);
    
    const strategies = {
      'top30': { count: 30, description: 'Fixed top 30 items' },
      'smart': { count: smartCount, description: 'Smart algorithm based on data distribution' },
      'classA': { count: classACount, description: `All Class A items (${classACount})` },
      'to80percent': { count: to80Count, description: `Items covering 80% of value (${to80Count})` },
      'to95percent': { count: to95Count, description: `Items covering 95% of value (${to95Count})` },
      'adaptive': { count: adaptiveCount, description: 'Multi-strategy weighted approach' }
    };
    
    const current = strategies[this.paretoDisplayMode] || strategies['smart'];
    const finalCount = Math.min(current.count, this.maxDisplayItems, totalItems);
    
    return {
      strategy: this.paretoDisplayMode,
      description: current.description,
      requestedCount: current.count,
      finalCount: finalCount,
      totalItems: totalItems,
      coverage: totalItems > 0 ? (finalCount / totalItems * 100).toFixed(1) : '0',
      allStrategies: strategies
    };
  }

  // Enhanced method to update chart title with strategy information
  updateChartTitle(chartConfig, displayInfo) {
    const baseTitle = 'Top ABC Analysis - Pareto Chart';
    const strategyInfo = `${displayInfo.finalCount}/${displayInfo.totalItems} produse (${displayInfo.coverage}%)`;
    const strategyDesc = displayInfo.description;
    
    if (chartConfig.options && chartConfig.options.plugins && chartConfig.options.plugins.title) {
      chartConfig.options.plugins.title.text = [
        baseTitle,
        `📊 ${strategyInfo}`,
        `🎯 Strategy: ${strategyDesc}`
      ];
      chartConfig.options.plugins.title.font = {
        size: 14
      };
      chartConfig.options.plugins.title.padding = {
        top: 10,
        bottom: 20
      };
    }
  }

  render() {
    const analysisPeriod = this.getAnalysisPeriod();
    
    return html`
      <div class="period-info">
        <strong>📅 ${analysisPeriod.periodText}</strong>
        ${analysisPeriod.weeks ? html`
          <br><small>Data referință: ${this.params.dataReferinta} | Săptămâni analizate: ${analysisPeriod.weeks}</small>
        ` : ''}
      </div>
      
      <div class="controls">
        <div>
          <label for="chartType">Chart Type:</label>
          <select id="chartType" @change="${this.handleChartTypeChange}">
            <option value="pareto" ?selected=${this.chartType === 'pareto'}>Pareto Chart</option>
            <option value="distribution" ?selected=${this.chartType === 'distribution'}>Distribution</option>
            <option value="value" ?selected=${this.chartType === 'value'}>Value Distribution</option>
          </select>
        </div>
        
        ${this.chartType === 'pareto' ? html`
          <div>
            <label for="displayMode">Display Strategy:</label>
            <select id="displayMode" .value="${this.paretoDisplayMode}" @change="${this.handleDisplayModeChange}">
              <option value="smart">Smart (Recommended)</option>
              <option value="adaptive">Adaptive (Multi-strategy)</option>
              <option value="to80percent">80% Threshold</option>
              <option value="classA">Class A Items</option>
              <option value="to95percent">95% Threshold</option>
              <option value="top30">Top 30 Items</option>
            </select>
          </div>
        ` : ''}
        
        <button @click="${this.handleRefreshData}">Refresh Data</button>
      </div>
      
      ${this.error ? html`<div class="error-message">${this.error}</div>` : ''}
      ${this.loading ? html`<div class="loading">Loading...</div>` : ''}
      
      <div class="chart-container">
        <canvas id="abcChart"></canvas>
      </div>
    `;
  }

  // Handle display mode change
  handleDisplayModeChange(e) {
    const oldMode = this.paretoDisplayMode;
    this.paretoDisplayMode = e.target.value;
    
    console.log(`🔄 Display mode changed: ${oldMode} → ${this.paretoDisplayMode}`);
    
    // Re-render chart with new display strategy
    if (this.data && this.data.length > 0 && window.Chart) {
      this.renderChart();
    }
  }
}

// Register the custom element
customElements.define('top-abc-chart', TopAbcChart);