import { LitElement, html, css } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';
import { connectToS1 } from '../dataFetching.js';
import { client } from '../socketConfig.js';

export class TopAbc extends LitElement {
  static get properties() {
    return {
      // Filter parameters
      filterColumnName: { type: String },
      doarStocZero: { type: Boolean },
      doarDeblocate: { type: Boolean },
      valTxt: { type: String },
      signTxt: { type: Number },

      // Branch selection
      branches: { type: Object },
      selectedBranches: { type: Array },
      branchSearchTerm: { type: String },
      showBranchDropdown: { type: Boolean },

      // Supplier selection
      suppliers: { type: Array },
      selectedSuppliers: { type: Array },
      supplierSearchTerm: { type: String },
      showSupplierDropdown: { type: Boolean },

      // Config parameters
      overstockBehavior: { type: Number },
      salesHistoryMonths: { type: Number },
      adjustOrderWithPending: { type: Boolean },

      // Saved search configuration
      searchConfig: { type: Object },

      // UI state
      step: { type: Number },
      loading: { type: Boolean },
      error: { type: String },
      filteredItems: { type: Array },
      selectedItems: { type: Array },
      calculatedResults: { type: Array },
      searchTerm: { type: String },

      // Sales history modal
      showSalesHistoryModal: { type: Boolean },
      salesHistoryData: { type: Object },
      currentMaterial: { type: Object },
      salesHistoryLoading: { type: Boolean },
      chartType: { type: String }
    };
  }

  createRenderRoot() {
    return this; // Disable Shadow DOM for simplicity
  }

  constructor() {
    super();
    this.filterColumnName = "CODE";
    this.doarStocZero = false;
    this.doarDeblocate = false;
    this.valTxt = "";
    this.signTxt = 1;
    this.branches = {
      '1000': 'HQ',
      '1200': 'CLUJ',
      '1300': 'CONSTANTA',
      '1400': 'GALATI',
      '1500': 'PLOIESTI',
      '1600': 'IASI',
      '1700': 'SIBIU',
      '1800': 'CRAIOVA',
      '1900': 'ORADEA',
      '2000': 'PITESTI',
      '2100': 'BRASOV',
      '2200': 'BUCURESTI',
      '2300': 'ARAD',
      '2400': 'VOLUNTARI',
      '2600': 'MIHAILESTI',
      '2700': 'TG. MURES',
      '2800': 'TIMISOARA',
      '2900': 'RAMNICU VALCEA'
    };
    this.selectedBranches = [];
    this.branchSearchTerm = "";
    this.showBranchDropdown = false;
    this.suppliers = [];
    this.selectedSuppliers = [];
    this.supplierSearchTerm = "";
    this.showSupplierDropdown = false;
    this.overstockBehavior = 0;
    this.salesHistoryMonths = 6;
    this.adjustOrderWithPending = false;
    this.step = 1;
    this.loading = false;
    this.error = '';
    this.filteredItems = [];
    this.selectedItems = [];
    this.calculatedResults = [];
    this.searchTerm = '';
    this.searchConfig = {};

    // Sales history modal properties
    this.showSalesHistoryModal = false;
    this.salesHistoryData = null;
    this.currentMaterial = null;
    this.salesHistoryLoading = false;
    this.chartType = 'sideBySide'; // Default chart type (options: 'total', 'stacked', 'sideBySide')
  }

  // Get branches as a comma separated string
  getBranchesString() {
    return this.selectedBranches.join(',');
  }

  // Get display text for branches
  getBranchesDisplayText() {
    if (this.selectedBranches.length === 0) {
      return 'Select branches';
    }
    if (this.selectedBranches.length === 1) {
      return `${this.selectedBranches[0]} - ${this.branches[this.selectedBranches[0]]}`;
    }
    return `${this.selectedBranches.length} branches selected`;
  }

  // Get display text for suppliers
  getSupplierDisplayText() {
    if (this.selectedSuppliers.length === 0) {
      return 'Select suppliers';
    }
    if (this.selectedSuppliers.length === 1) {
      const supplier = this.suppliers.find(s => s.TRDR === this.selectedSuppliers[0]);
      return supplier ? `${supplier.CODE} - ${supplier.NAME}` : 'Select suppliers';
    }
    return `${this.selectedSuppliers.length} suppliers selected`;
  }

  toggleBranchDropdown(e) {
    this.showBranchDropdown = !this.showBranchDropdown;
    if (this.showBranchDropdown) {
      document.addEventListener('click', this.closeBranchDropdown);
    } else {
      document.removeEventListener('click', this.closeBranchDropdown);
    }
    e.stopPropagation();
  }

  closeBranchDropdown = () => {
    this.showBranchDropdown = false;
    document.removeEventListener('click', this.closeBranchDropdown);
  }

  toggleBranch(branch, e) {
    e.stopPropagation();
    const index = this.selectedBranches.indexOf(branch);
    if (index === -1) {
      this.selectedBranches = [...this.selectedBranches, branch];
    } else {
      this.selectedBranches = this.selectedBranches.filter(b => b !== branch);
    }
  }

  selectAllBranches(e) {
    e.stopPropagation();
    this.selectedBranches = Object.keys(this.branches);
  }

  clearBranches(e) {
    e.stopPropagation();
    this.selectedBranches = [];
  }

  toggleSupplierDropdown(e) {
    this.showSupplierDropdown = !this.showSupplierDropdown;
    if (this.showSupplierDropdown) {
      document.addEventListener('click', this.closeSupplierDropdown);
    } else {
      document.removeEventListener('click', this.closeSupplierDropdown);
    }
    e.stopPropagation();
  }

  closeSupplierDropdown = () => {
    this.showSupplierDropdown = false;
    document.removeEventListener('click', this.closeSupplierDropdown);
  }

  toggleSupplier(supplierId, e) {
    e.stopPropagation();
    const index = this.selectedSuppliers.indexOf(supplierId);
    if (index === -1) {
      this.selectedSuppliers = [...this.selectedSuppliers, supplierId];
    } else {
      this.selectedSuppliers = this.selectedSuppliers.filter(id => id !== supplierId);
    }
  }

  selectAllSuppliers(e) {
    e.stopPropagation();
    this.selectedSuppliers = this.suppliers.map(s => s.TRDR);
  }

  clearSuppliers(e) {
    e.stopPropagation();
    this.selectedSuppliers = [];
  }

  handleDropdownClick(e) {
    e.stopPropagation();
  }

  async searchArticles() {
    this.loading = true;
    this.error = '';
    this.filteredItems = [];

    try {
      if (this.selectedBranches.length === 0) {
        throw new Error('Please select at least one branch');
      }

      const token = await new Promise((resolve, reject) => {
        connectToS1((token) => {
          if (!token) {
            reject(new Error('Failed to get token'));
            return;
          }
          resolve(token);
        });
      });

      const response = await client.service('top-abc').getArticoleCfFiltre({
        token,
        filterColumnName: this.filterColumnName,
        doarStocZero: this.doarStocZero,
        doarDeblocate: this.doarDeblocate,
        valTxt: this.valTxt,
        signTxt: this.signTxt,
        sucursalaSqlInCondition: this.getBranchesString(),
        selectedSuppliersSqlClause: this.selectedSuppliers.length > 0 ? ` AND m.mtrsup IN (${this.selectedSuppliers.join(',')})` : ''
      });

      console.log('Response from getArticoleCfFiltre:', response);

      if (response.success) {
        // Add a selected flag to each item
        this.filteredItems = response.items.map(item => ({
          ...item,
          selected: true
        }));
        this.selectedItems = [...this.filteredItems];

        // Store search configuration for subsequent steps
        this.storeSearchConfig();

        this.step = 2;
      } else {
        throw new Error(response.messages.join('. '));
      }
    } catch (error) {
      console.error('Error searching articles:', error);
      this.error = error.message || 'Failed to search articles';
    } finally {
      this.loading = false;
    }
  }

  async calculateNeeds() {
    this.loading = true;
    this.error = '';
    this.calculatedResults = [];

    try {
      if (this.selectedItems.length === 0) {
        throw new Error('No items selected');
      }

      // Get MTRLs of selected items
      const mtrlInput = this.selectedItems.map(item => item.MTRL).join(',');

      // Validate config object before sending
      // Use the same branch and supplier selection from searchConfig to ensure consistency with Step 1
      const config = {
        overstockBehavior: this.overstockBehavior,
        salesHistoryMonths: this.salesHistoryMonths,
        adjustOrderWithPending: typeof this.adjustOrderWithPending === 'boolean' ? this.adjustOrderWithPending : false,
        sucursalaSqlInCondition: this.searchConfig.selectedBranches ? this.searchConfig.selectedBranches.join(',') : this.getBranchesString(),
        currentDate: new Date().toISOString(), // Convert Date to string to ensure proper serialization
        supplierFilterSql: this.searchConfig.selectedSuppliers && this.searchConfig.selectedSuppliers.length > 0
          ? ` AND m.mtrsup IN (${this.searchConfig.selectedSuppliers.join(',')})`
          : ''
      };

      if (!config.salesHistoryMonths || !config.currentDate) {
        throw new Error('Invalid configuration: salesHistoryMonths and currentDate are required.');
      }

      console.log('Config object:', config);

      //add those three properties to the data obj
      const data = {
        isSingle: false,
        mtrlInput,
        config
      };

      const response = await client.service('top-abc').getCalculatedNeeds(data);

      console.log('Response from getCalculatedNeeds:', response);

      if (response.success) {
        this.calculatedResults = response.items || [];
        this.step = 3;
      } else {
        throw new Error(response.messages.join('. '));
      }
    } catch (error) {
      console.error('Error calculating needs:', error);
      this.error = error.message || 'Failed to calculate needs';
    } finally {
      this.loading = false;
    }
  }

  toggleItemSelection(mtrl) {
    this.filteredItems = this.filteredItems.map(item => {
      if (item.MTRL === mtrl) {
        return { ...item, selected: !item.selected };
      }
      return item;
    });
    this.selectedItems = this.filteredItems.filter(item => item.selected);
  }

  storeSearchConfig() {
    // Store the search configuration for use in subsequent steps
    this.searchConfig = {
      selectedBranches: [...this.selectedBranches],
      selectedSuppliers: [...this.selectedSuppliers],
      filterColumnName: this.filterColumnName,
      doarStocZero: this.doarStocZero,
      doarDeblocate: this.doarDeblocate,
      valTxt: this.valTxt,
      signTxt: this.signTxt
    };
  }

  resetToStep1() {
    this.step = 1;
    this.filteredItems = [];
    this.selectedItems = [];
    this.calculatedResults = [];
    this.error = '';
  }

  backToStep2() {
    this.step = 2;
    this.calculatedResults = [];
    this.error = '';
  }

  exportToExcel() {
    if (!this.calculatedResults.length) {
      alert('No data to export.');
      return;
    }

    // Create a worksheet
    const worksheet = XLSX.utils.json_to_sheet(this.calculatedResults);

    // Create a workbook
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Top ABC Results');

    // Generate Excel file
    const filename = `top_abc_export_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, filename);
  }

  get filteredItemsList() {
    if (!this.searchTerm) return this.filteredItems;

    const term = this.searchTerm.toLowerCase();
    return this.filteredItems.filter(item =>
    (item.CODE?.toLowerCase().includes(term) ||
      item.NAME?.toLowerCase().includes(term))
    );
  }

  renderBranchDropdown() {
    const filteredBranches = this.branchSearchTerm
      ? Object.entries(this.branches).filter(([code, name]) =>
        code.includes(this.branchSearchTerm) ||
        name.toLowerCase().includes(this.branchSearchTerm.toLowerCase()))
      : Object.entries(this.branches);

    return html`
      <div class="fancy-dropdown-menu" @click="${this.handleDropdownClick}">
        <div class="fancy-dropdown-header">
          <div class="input-group input-group-sm">
            <input type="text" class="form-control" placeholder="Search branches..." 
                   .value="${this.branchSearchTerm}" 
                   @input="${e => this.branchSearchTerm = e.target.value}" />
          </div>
        </div>
        <div class="fancy-dropdown-actions">
          <button class="btn btn-sm btn-link" @click="${this.selectAllBranches}">Select All</button>
          <button class="btn btn-sm btn-link" @click="${this.clearBranches}">Clear All</button>
        </div>
        <div class="fancy-dropdown-content">
          ${filteredBranches.map(([code, name]) => html`
            <div class="fancy-dropdown-item">
              <label class="d-flex align-items-center">
                <input type="checkbox" 
                       ?checked="${this.selectedBranches.includes(code)}"
                       @change="${(e) => this.toggleBranch(code, e)}" />
                <span class="ms-2">${code} - ${name}</span>
              </label>
            </div>
          `)}
        </div>
      </div>
    `;
  }

  renderSupplierDropdown() {
    const filteredSuppliers = this.supplierSearchTerm
      ? this.suppliers.filter(supplier =>
        supplier.CODE.toLowerCase().includes(this.supplierSearchTerm.toLowerCase()) ||
        supplier.NAME.toLowerCase().includes(this.supplierSearchTerm.toLowerCase())
      )
      : this.suppliers;

    return html`
      <div class="fancy-dropdown-menu" @click="${this.handleDropdownClick}">
        <div class="fancy-dropdown-header">
          <div class="input-group input-group-sm">
            <input type="text" class="form-control" placeholder="Search suppliers..." 
                   .value="${this.supplierSearchTerm}" 
                   @input="${e => this.supplierSearchTerm = e.target.value}" />
          </div>
        </div>
        <div class="fancy-dropdown-actions">
          <button class="btn btn-sm btn-link" @click="${() => this.selectedSuppliers = this.suppliers.map(s => s.TRDR)}">Select All</button>
          <button class="btn btn-sm btn-link" @click="${() => this.selectedSuppliers = []}">Clear All</button>
        </div>
        <div class="fancy-dropdown-content">
          ${filteredSuppliers.map(supplier => html`
            <div class="fancy-dropdown-item">
              <label class="d-flex align-items-center">
                <input type="checkbox" 
                       ?checked="${this.selectedSuppliers.includes(supplier.TRDR)}"
                       @change="${(e) => {
        const index = this.selectedSuppliers.indexOf(supplier.TRDR);
        if (e.target.checked && index === -1) {
          this.selectedSuppliers = [...this.selectedSuppliers, supplier.TRDR];
        } else if (!e.target.checked && index !== -1) {
          this.selectedSuppliers = this.selectedSuppliers.filter(id => id !== supplier.TRDR);
        }
      }}" />
                <span class="ms-2">${supplier.CODE} - ${supplier.NAME}</span>
              </label>
            </div>
          `)}
        </div>
      </div>
    `;
  }

  async fetchSuppliers() {
    try {
      const token = await new Promise((resolve, reject) => {
        connectToS1((token) => {
          if (!token) {
            reject(new Error('Failed to get token'));
            return;
          }
          resolve(token);
        });
      });

      const response = await client.service('top-abc').getSuppliers({ token });
      this.suppliers = response || [];
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      this.error = error.message || 'Failed to fetch suppliers';
    }
  }

  updated(changedProperties) {
    // Load suppliers when the component is first rendered
    if (changedProperties.has('step')) {
      if (this.suppliers.length === 0) {
        this.fetchSuppliers();
      }
    }

    // Initialize chart when the modal is shown
    if (changedProperties.has('showSalesHistoryModal')) {
      if (this.showSalesHistoryModal) {
        // When modal is shown
        this.initializeChart();
        // Prevent scrolling of the background content
        document.body.style.overflow = 'hidden';
      } else {
        // When modal is closed
        // Allow scrolling again
        document.body.style.overflow = '';

        // If we have a chart instance, destroy it to free up resources
        if (this.chart) {
          this.chart.destroy();
          this.chart = null;
        }
      }
    }
  }

  async fetchSalesHistory(material) {
    // Set loading state
    this.salesHistoryLoading = true;
    this.currentMaterial = material;
    this.error = '';

    try {
      const token = await new Promise((resolve, reject) => {
        connectToS1((token) => {
          if (!token) {
            reject(new Error('Failed to get token'));
            return;
          }
          resolve(token);
        });
      });

      // Create the SQL IN condition for branches
      const sucursalaSqlInCondition = this.selectedBranches.length > 0
        ? this.selectedBranches.join(',')
        : '';

      // Call the backend service to get sales history
      const response = await client.service('top-abc').getSalesHistory({
        token,
        mtrl: material.MTRL,
        lastNMonths: this.salesHistoryMonths || 12,
        sucursalaSqlInCondition
      });

      console.log('Response from getSalesHistory:', response);

      // Process the response data for chart display
      this.salesHistoryData = this.processSalesHistoryData(response, material);

      // Make this component instance available globally for chart tooltip access
      window.topAbcComponent = this;

      // Show the modal
      this.showSalesHistoryModal = true;
    } catch (error) {
      console.error('Error fetching sales history:', error);
      this.error = error.message || 'Failed to fetch sales history';
    } finally {
      this.salesHistoryLoading = false;
    }
  }

  processSalesHistoryData(data, material) {
    // If no data or not successful, return a basic structure with empty arrays
    if (!data || !data.success || !data.items || data.items.length === 0) {
      return {
        materialInfo: material || {},
        labels: [],
        values: [],
        branchData: {}
      };
    }

    // Use the material info from the response if available, otherwise use the provided material
    const materialInfo = data.material || material;

    // Get unique months (as strings) to use as labels
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const uniqueMonths = new Set();
    data.items.forEach(item => {
      const monthLabel = `${monthNames[item.PERIOD - 1]} ${item.FISCPRD}`;
      uniqueMonths.add(monthLabel);
    });

    // Convert to array and sort by year and month
    const sortedMonths = Array.from(uniqueMonths).sort((a, b) => {
      const [monthA, yearA] = a.split(' ');
      const [monthB, yearB] = b.split(' ');
      if (yearA !== yearB) return parseInt(yearA) - parseInt(yearB);
      return monthNames.indexOf(monthA) - monthNames.indexOf(monthB);
    });

    // Aggregate sales by branch and month
    const branchData = {};
    
    // First, initialize all known branches from this.branches (even those with no data)
    // This ensures consistent branch ordering and color assignment
    Object.keys(this.branches).forEach(branchId => {
      branchData[branchId] = {};
      // Initialize all months with zero values
      sortedMonths.forEach(month => {
        branchData[branchId][month] = 0;
      });
    });
    
    // Then add the actual data from the response
    data.items.forEach(item => {
      const branchId = item.BRANCH.toString();
      const monthLabel = `${monthNames[item.PERIOD - 1]} ${item.FISCPRD}`;
      
      // Initialize branch data structure if it doesn't exist (for branches not in this.branches)
      if (!branchData[branchId]) {
        branchData[branchId] = {};
        // Initialize all months with zero values for this new branch
        sortedMonths.forEach(month => {
          branchData[branchId][month] = 0;
        });
      }
      
      // Add sales data to branch for specific month
      branchData[branchId][monthLabel] += item.SALQTY || 0;
    });

    // For backward compatibility, still calculate the total values
    const values = sortedMonths.map(month => {
      let total = 0;
      Object.values(branchData).forEach(branch => {
        total += branch[month] || 0;
      });
      return total;
    });

    return {
      materialInfo,
      labels: sortedMonths,
      values, // Keep the total values for backward compatibility
      branchData // Add the branch-specific data
    };
  }

  renderSalesHistoryModal() {
    if (!this.showSalesHistoryModal) {
      // Clear the modal container when not showing
      const modalContainer = document.getElementById('salesHistoryChartModalContainer');
      if (modalContainer) {
        modalContainer.innerHTML = '';
      }
      return '';
    }

    const material = this.currentMaterial || {};
    const chartData = this.salesHistoryData || { labels: [], values: [] };

    // Create the modal HTML content
    const modalHTML = `
      <div class="modal fade show" style="display: block; background-color: rgba(0,0,0,0.5);" tabindex="-1" id="salesHistoryModal">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header">
              <div class="d-flex justify-content-between align-items-center w-100">
                <div class="d-flex align-items-center">
                  <h5 class="modal-title me-3 mb-0">Sales History</h5>
                  <div class="dropdown-container d-flex align-items-center">
                    <label for="chartTypeSelector" class="me-2 small">View:</label>
                    <select class="form-select form-select-sm" id="chartTypeSelector">
                      <option value="total">Total Sales</option>
                      <option value="stacked">Stacked by Branch</option>
                      <option value="sideBySide">Side by Side</option>
                    </select>
                  </div>
                </div>
                <button type="button" class="btn-close" id="closeChartModal" aria-label="Close"></button>
              </div>
            </div>
            <div class="modal-body">
              ${this.salesHistoryLoading ?
                `<div class="d-flex justify-content-center p-5">
                  <div class="spinner-border" role="status">
                    <span class="visually-hidden">Loading...</span>
                  </div>
                </div>` : 
                chartData.labels.length > 0 ?
                `<div class="chart-container" style="position: relative; height:400px; width:100%;">
                   <canvas id="salesHistoryChart" width="800" height="400" style="display:block; background-color:#ffffff;"></canvas>
                 </div>` :
                `<div class="alert alert-info">No sales history data available for this item.</div>`
              }
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" id="closeChartModalFooter">Close</button>
            </div>
          </div>
        </div>
      </div>
    `;``

    // Render the modal into the dedicated container element in the main document
    const modalContainer = document.getElementById('salesHistoryChartModalContainer');
    if (modalContainer) {
      modalContainer.innerHTML = modalHTML;
      
      // Add event listeners to close button
      const closeButton = document.getElementById('closeChartModal');
      if (closeButton) {
        closeButton.addEventListener('click', () => this.closeSalesHistoryModal());
      }
      
      const closeButtonFooter = document.getElementById('closeChartModalFooter');
      if (closeButtonFooter) {
        closeButtonFooter.addEventListener('click', () => this.closeSalesHistoryModal());
      }
      
      // Add event listener for chart type selector
      const chartTypeSelector = document.getElementById('chartTypeSelector');
      if (chartTypeSelector) {
        // Set the initial value based on the component's property
        chartTypeSelector.value = this.chartType;
        console.log('Setting chart type selector to:', this.chartType);
        
        // Add event listener for changes
        chartTypeSelector.addEventListener('change', (e) => {
          this.chartType = e.target.value;
          console.log('Chart type changed to:', this.chartType);
          this.updateChartType();
        });
      }
      
      // Initialize the chart immediately if data is available
      if (chartData.labels.length > 0 && !this.salesHistoryLoading) {
        this.initializeChart();
      }
    }

    return ''; // Return empty string since we're rendering directly to DOM
  }

  closeSalesHistoryModal() {
    this.showSalesHistoryModal = false;
    const modalContainer = document.getElementById('salesHistoryChartModalContainer');
    if (modalContainer) {
      modalContainer.innerHTML = ''; // Clear modal content
    }
    
    // Clean up the global reference
    if (window.topAbcComponent === this) {
      window.topAbcComponent = null;
    }
  }

  // Method to initialize or update the chart after the modal is rendered
  initializeChart() {
    if (!this.showSalesHistoryModal || !this.salesHistoryData || !this.salesHistoryData.labels.length) return;

    console.log('Initializing chart with data:', this.salesHistoryData);

    // Load Chart.js first - then find the canvas
    this.loadChartLibrary();
  }

  loadChartLibrary() {
    // If Chart.js is already loaded, just setup the chart
    if (typeof window.Chart !== 'undefined') {
      console.log('Chart.js already loaded, setting up chart');
      this.setupChartWhenReady();
      return;
    }

    console.log('Loading Chart.js library...');

    // Use Chart.js v3 which is more stable
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/chart.js@3.9.1/dist/chart.min.js';
    script.crossOrigin = 'anonymous';

    script.onload = () => {
      console.log('Chart.js loaded successfully');
      this.setupChartWhenReady();
    };

    script.onerror = (error) => {
      console.error('Error loading Chart.js:', error);
      this.loadChartJSFallback();
    };

    document.head.appendChild(script);
  }

  setupChartWhenReady() {
    // Use a longer delay to ensure the modal is fully rendered with canvas
    setTimeout(() => {
      // Look for the canvas in the document, not in the component's shadow DOM
      const canvas = document.getElementById('salesHistoryChart');
      if (!canvas) {
        console.error('Chart canvas element not found - retrying...');
        // Try again in a moment - sometimes the canvas isn't ready yet
        setTimeout(() => this.setupChartWhenReady(), 200);
        return;
      }

      console.log('Canvas element found, dimensions:', canvas.width, canvas.height);

      // Force canvas to take the full width and height of its container
      if (canvas.parentElement) {
        canvas.parentElement.style.display = 'block';
        canvas.style.width = '100%';
        canvas.style.height = '100%';
      }

      // Create the chart
      this.createChart(canvas);
    }, 300);
  }

  // Fallback method to try another CDN if the first one fails
  loadChartJSFallback() {
    console.log('Trying fallback Chart.js source...');
    const script = document.createElement('script');
    // Try a different CDN with the same version
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/3.9.1/chart.min.js';
    script.integrity = 'sha512-ElRFoEQdI5Ht6kZvyzXhYG9NqjtkmlkfYk0wr6wHxU9JEHakS7UJZNeml5ALk+8IKlU6jDgMabC3vkumRokgJA==';
    script.crossOrigin = 'anonymous';

    script.onload = () => {
      console.log('Chart.js loaded successfully from fallback');
      this.setupChartWhenReady();
    };

    script.onerror = () => {
      console.error('Error loading Chart.js from fallback source');
      // Final fallback - try without integrity
      const lastScript = document.createElement('script');
      lastScript.src = 'https://cdn.jsdelivr.net/npm/chart.js';
      lastScript.crossOrigin = 'anonymous';

      lastScript.onload = () => {
        console.log('Chart.js loaded successfully from last fallback');
        this.setupChartWhenReady();
      };

      lastScript.onerror = () => {
        console.error('All Chart.js loading attempts failed');
        // Display a message to the user that the chart couldn't be loaded
        if (this.querySelector('.modal-body')) {
          const errorMessage = document.createElement('div');
          errorMessage.className = 'alert alert-danger';
          errorMessage.textContent = 'Failed to load chart library. Please try again later.';
          this.querySelector('.modal-body').appendChild(errorMessage);
        }
      };

      document.head.appendChild(lastScript);
    };

    document.head.appendChild(script);
  }

  // Update the chart based on selected chart type
  updateChartType() {
    console.log('Changing chart type to:', this.chartType);
    // Recreate the chart with the new chart type
    const canvas = document.getElementById('salesHistoryChart');
    if (canvas) {
      this.createChart(canvas);
    } else {
      console.error('Canvas not found when updating chart type');
    }
  }
  
  // Creates a single dataset showing total sales
  createTotalDataset(data, labels, colorPalette) {
    // Calculate totals from the branch data
    const totalValues = labels.map(month => {
      let total = 0;
      if (data.branchData) {
        Object.values(data.branchData).forEach(branch => {
          total += branch[month] || 0;
        });
      } else if (data.values) {
        // Fallback to pre-calculated values
        const index = data.labels.indexOf(month);
        if (index >= 0) {
          total = data.values[index] || 0;
        }
      }
      return total;
    });

    return [{
      label: 'Total Sales',
      data: totalValues,
      backgroundColor: colorPalette[0],
      borderColor: colorPalette[0].replace('0.9', '1'),
      borderWidth: 1,
      barPercentage: 0.6,  // Make total bars wider
      categoryPercentage: 0.9,
      minBarLength: 5
    }];
  }

  // Creates datasets for each branch
  createBranchDatasets(data, labels, colorPalette, stacked) {
    const datasets = [];
    
    if (data.branchData) {
      // Get branch IDs and sort them numerically for consistent ordering and coloring
      const branchIds = Object.keys(data.branchData).sort((a, b) => parseInt(a) - parseInt(b));
      
      // Create a dataset for each branch
      branchIds.forEach((branchId, index) => {
        const branchValues = labels.map(month => data.branchData[branchId][month] || 0);
        
        // Only include branches that have data if we're not stacking
        const hasData = branchValues.some(val => val > 0);
        if (!stacked && !hasData) {
          return; // Skip branches with no data for side-by-side view
        }
        
        // Use only branch ID for the label to save space
        datasets.push({
          label: branchId, // Use just the branch ID without the name
          data: branchValues,
          backgroundColor: colorPalette[index % colorPalette.length],
          borderColor: colorPalette[index % colorPalette.length].replace('0.9', '1'),
          borderWidth: 1,
          barPercentage: stacked ? 0.9 : 0.8,
          categoryPercentage: stacked ? 0.9 : 0.8,
          minBarLength: 5
        });
      });
    } else if (data.values) {
      // Fallback for when no branch data is available
      datasets.push({
        label: 'Sales Quantity',
        data: [...data.values],
        backgroundColor: colorPalette[0],
        borderColor: colorPalette[0].replace('0.9', '1'),
        borderWidth: 1,
        barPercentage: 0.8,
        categoryPercentage: 0.8,
        minBarLength: 5
      });
    }
    
    return datasets;
  }
  
  // Create the actual chart
  createChart(canvas) {
    const data = this.salesHistoryData;
    console.log('Creating chart with data:', data);

    // If there's an existing chart, destroy it first
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }

    try {
      // Check if Chart is defined
      if (typeof Chart === 'undefined') {
        console.error('Chart library not available');
        return;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        console.error('Could not get canvas 2d context');
        return;
      }

      // Force a redraw of the canvas with explicit dimensions
      canvas.style.display = 'block';
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.backgroundColor = '#ffffff'; // Add white background
      
      // Force redraw by changing dimensions slightly
      const width = canvas.width;
      canvas.width = 1;
      canvas.width = width;

      // Make values and labels explicit (not references)
      const labels = [...data.labels];
      
      // Define a color palette for branches
      const colorPalette = [
        'rgba(54, 162, 235, 0.9)', // Blue
        'rgba(255, 99, 132, 0.9)', // Red
        'rgba(75, 192, 192, 0.9)', // Green
        'rgba(255, 159, 64, 0.9)', // Orange
        'rgba(153, 102, 255, 0.9)', // Purple
        'rgba(255, 205, 86, 0.9)', // Yellow
        'rgba(201, 203, 207, 0.9)', // Grey
        'rgba(54, 94, 77, 0.9)',    // Dark Green
        'rgba(255, 69, 0, 0.9)',    // Red-Orange
        'rgba(0, 128, 128, 0.9)',   // Teal
        'rgba(128, 0, 128, 0.9)',   // Purple
        'rgba(0, 0, 139, 0.9)',     // Dark Blue
        'rgba(139, 69, 19, 0.9)',   // Brown
        'rgba(0, 139, 139, 0.9)',   // Dark Cyan
        'rgba(178, 34, 34, 0.9)'    // Firebrick
      ];
      
      // Prepare datasets based on the selected chart type
      let datasets = [];
      let isStacked = false;
      let chartTitle = `${data.materialInfo?.CODE || ''} - ${data.materialInfo?.NAME || ''}`;
      
      console.log('Creating chart with type:', this.chartType);
      
      switch (this.chartType) {
        case 'total':
          datasets = this.createTotalDataset(data, labels, colorPalette);
          isStacked = false;
          chartTitle += ' (Total Sales)';
          break;
        case 'stacked':
          datasets = this.createBranchDatasets(data, labels, colorPalette, true);
          isStacked = true;
          chartTitle += ' (Stacked by Branch)';
          break;
        case 'sideBySide':
        default:
          datasets = this.createBranchDatasets(data, labels, colorPalette, false);
          isStacked = false;
          chartTitle += ' (Side by Side)';
          break;
      }
      
      // Add background color to chart
      this.chart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: datasets
        },
        options: {
          maintainAspectRatio: false,
          responsive: true,
          backgroundColor: 'white',
          scales: {
            y: {
              beginAtZero: true,
              stacked: isStacked, // Set stacked based on chart type
              grid: {
                color: '#ddd',
                borderColor: '#999',
                lineWidth: 2
              },
              ticks: {
                font: { size: 14 },
                color: '#333'
              },
              title: {
                display: true,
                text: 'Quantity',
                font: {
                  weight: 'bold',
                  size: 16
                },
                color: '#333'
              }
            },
            x: {
              stacked: isStacked, // Set stacked based on chart type
              grid: {
                color: '#ddd',
                borderColor: '#999',
                lineWidth: 2
              },
              ticks: {
                font: { size: 14 },
                color: '#333'
              },
              title: {
                display: true,
                text: 'Month',
                font: {
                  weight: 'bold',
                  size: 16
                },
                color: '#333'
              }
            }
          },
          plugins: {
            title: {
              display: true,
              text: chartTitle,
              font: {
                size: 18,
                weight: 'bold'
              },
              color: '#333',
              padding: {
                top: 20,
                bottom: 20
              }
            },
            legend: {
              display: true,
              position: 'top',
              labels: {
                font: { size: 12 }
              }
            },
            tooltip: {
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              titleFont: { size: 14 },
              bodyFont: { size: 13 },
              callbacks: {
                label: function(context) {
                  // Extract just the branch ID from the dataset label (which is in format "1200 - CLUJ")
                  const branchId = context.dataset.label.split(' - ')[0];
                  return `${branchId}: ${context.parsed.y}`;
                },
                afterLabel: function(context) {
                  // Show percentage for this month
                  const dataIndex = context.dataIndex;
                  const datasetIndex = context.datasetIndex;
                  const month = context.chart.data.labels[dataIndex];
                  
                  // Get a reference to the component for the chart type
                  const component = window.topAbcComponent;
                  const chartType = component ? component.chartType : 'sideBySide';
                  
                  // For total view, don't show percentage
                  if (chartType === 'total') {
                    return '';
                  }
                  
                  // Calculate total for this month across all branches
                  let total = 0;
                  context.chart.data.datasets.forEach(dataset => {
                    total += dataset.data[dataIndex] || 0;
                  });
                  
                  const value = context.chart.data.datasets[datasetIndex].data[dataIndex] || 0;
                  
                  // Prevent division by zero which would result in Infinity
                  const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
                  return `${percentage}%`;
                }
              }
            }
          },
          animation: {
            duration: 1000
          }
        }
      });

      // Debug: Force multiple redraws to ensure visibility
      const redrawChart = () => {
        if (this.chart) {
          console.log('Forcing chart update...');
          this.chart.update();
        }
      };
      
      // Try multiple redraws at different intervals
      setTimeout(redrawChart, 100);
      setTimeout(redrawChart, 500);
      setTimeout(redrawChart, 1000);
      
      console.log('Chart created successfully');
    } catch (error) {
      console.error('Error creating chart:', error);
    }
  }

  renderStep1() {
    return html`
      <div class="card mb-2 border-light shadow-sm">
        <div class="card-body p-2">
          <h5 class="card-title mb-2">Step 1: Search Articles</h5>
          
          <div class="row mb-2">
            <div class="col-md-6">
              <div class="input-group input-group-sm fancy-dropdown mb-2">
                <span class="input-group-text">Branches</span>
                <button class="form-select fancy-dropdown-toggle text-start" 
                        @click="${this.toggleBranchDropdown}"
                        ?disabled="${this.loading}">
                  ${this.getBranchesDisplayText()}
                </button>
                ${this.showBranchDropdown ? this.renderBranchDropdown() : ''}
              </div>
            </div>
            
            <div class="col-md-6">
              <div class="input-group input-group-sm mb-2">
                <span class="input-group-text">Filter Column</span>
                <select class="form-select" 
                        .value="${this.filterColumnName}"
                        @change="${e => this.filterColumnName = e.target.value}"
                        ?disabled="${this.loading}">
                  <option value="CODE">Code</option>
                  <option value="NAME">Name</option>
                </select>
              </div>
            </div>
            
          </div>
          
          <div class="row mb-2">            
            <div class="col-md-6">
              <div class="input-group input-group-sm fancy-dropdown mb-2">
                <span class="input-group-text">Suppliers</span>
                <button class="form-select fancy-dropdown-toggle text-start" 
                        @click="${this.toggleSupplierDropdown}"
                        ?disabled="${this.loading}">
                  ${this.getSupplierDisplayText()}
                </button>
                ${this.showSupplierDropdown ? this.renderSupplierDropdown() : ''}
              </div>
            </div>
            <div class="col-md-6">
              <div class="input-group input-group-sm mb-2">
                <span class="input-group-text">Search Type</span>
                <select class="form-select" 
                        .value="${this.signTxt}"
                        @change="${e => this.signTxt = parseInt(e.target.value)}"
                        ?disabled="${this.loading}">
                  <option value="1">Starts with</option>
                  <option value="2">Contains</option>
                  <option value="3">Ends with</option>
                </select>
              </div>
            </div>
          </div>
          
          <div class="row mb-2">            
            <div class="col-md-6">
              <div class="row">
                <div class="col-md-4">
                  <div class="form-check-sm form-check-inline">
                    <input class="form-check-input" type="checkbox" id="doarStocZero"
                          ?checked="${this.doarStocZero}"
                          @change="${e => this.doarStocZero = e.target.checked}"
                          ?disabled="${this.loading}" />
                    <label class="form-check-label" for="doarStocZero">Zero Stock Only</label>
                  </div>
                </div>
                <div class="col-md-4">
                  <div class="form-check-sm form-check-inline">
                    <input class="form-check-input" type="checkbox" id="doarDeblocate"
                          ?checked="${this.doarDeblocate}"
                          @change="${e => this.doarDeblocate = e.target.checked}"
                          ?disabled="${this.loading}" />
                    <label class="form-check-label" for="doarDeblocate">Unblocked Items Only</label>
                  </div>
              </div>
            <div class="col-md-4">
              <button class="btn btn-primary btn-sm" 
                      @click="${this.searchArticles}" 
                      ?disabled="${this.loading}">
                ${this.loading ? html`<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Searching...` : 'Search Articles'}
              </button>
            </div>
            </div>
          </div>
            <div class="col-md-6">
              <div class="input-group input-group-sm mb-2">
                <span class="input-group-text">Search Value</span>
                <input type="text" class="form-control" placeholder="Enter search value"
                       .value="${this.valTxt}" 
                       @input="${e => this.valTxt = e.target.value}"
                       ?disabled="${this.loading}" />
            </div>
          </div>
        </div>
      </div>
    `;
  }

  renderStep2() {
    // Prepare items for data-table, including the select checkbox
    const itemsForDataTableStep2 = this.filteredItemsList.map(item => ({
      CODE: item.CODE,
      NAME: item.NAME,
      _select: html`
        <div class="form-check-sm d-flex justify-content-center">
          <input 
            class="form-check-input" 
            type="checkbox" 
            .checked="${item.selected}"
            @change="${() => this.toggleItemSelection(item.MTRL)}" />
        </div>`
    }));

    return html`
      <div class="card mb-2 border-light shadow-sm">
        <div class="card-body p-2">
          <h5 class="card-title mb-2">Step 2: Select Items for Calculation</h5>
          
          <div class="mb-2 small">
            <span class="badge bg-light text-dark me-2">Branches: 
              ${this.searchConfig.selectedBranches?.length || 0} selected
            </span>
            <span class="badge bg-light text-dark">Suppliers: 
              ${this.searchConfig.selectedSuppliers?.length || 0} selected
            </span>
          </div>
          
          <div class="row mb-2">
            <div class="col-md-6">
              <div class="input-group input-group-sm mb-2">
                <span class="input-group-text bg-white"><i class="bi bi-search"></i></span>
                <input type="text" class="form-control" placeholder="Search by code or name..."
                       .value="${this.searchTerm}" 
                       @input="${e => { this.searchTerm = e.target.value; this.requestUpdate(); }}" />
                ${this.searchTerm ? html`
                  <button class="btn btn-outline-secondary" @click="${() => { this.searchTerm = ''; this.requestUpdate(); }}">
                    <i class="bi bi-x"></i>
                  </button>` : ''}
              </div>
            </div>
            
            <div class="col-md-6">
              <div class="d-flex align-items-center justify-content-end">
                <div class="form-check-sm form-check-inline">
                  <input class="form-check-input" type="checkbox" id="selectAll"
                         ?checked="${this.filteredItems.length > 0 && this.selectedItems.length === this.filteredItems.length}"
                         @change="${e => {
        const checked = e.target.checked;
        this.filteredItems = this.filteredItems.map(item => ({ ...item, selected: checked }));
        this.selectedItems = checked ? [...this.filteredItems] : [];
        // Ensure data-table updates if its items prop depends on this.filteredItems directly
        this.requestUpdate();
      }}" />
                  <label class="form-check-label" for="selectAll">Select All</label>
                </div>
                
                <span class="ms-3 badge rounded-pill bg-primary">
                  ${this.selectedItems.length} of ${this.filteredItems.length} items selected
                </span>
              </div>
            </div>
          </div>
          
          <div class="table-responsive">
            <data-table 
              .items="${itemsForDataTableStep2}"
              .skipNr="${0}" 
              class="table table-sm table-hover">
            </data-table>
            ${this.filteredItemsList.length === 0 && !this.loading ? html`<p class="text-center text-muted mt-3">No items found based on your search criteria.</p>` : ''}
          </div>
          
          <div class="mt-3 d-flex justify-content-between">
            <button class="btn btn-outline-secondary" @click="${this.resetToStep1}">
              Back to Step 1
            </button>
            <div>
              <h6 class="mb-2">Calculation Settings</h6>
              <div class="input-group input-group-sm mb-2">
                <span class="input-group-text">Sales History Months</span>
                <input type="number" class="form-control" min="1" max="36"
                       .value="${this.salesHistoryMonths}" 
                       @change="${e => this.salesHistoryMonths = parseInt(e.target.value)}" />
              </div>
              
              <div class="input-group input-group-sm mb-2">
                <span class="input-group-text">Overstock Behavior</span>
                <select class="form-select" 
                        .value="${this.overstockBehavior}"
                        @change="${e => this.overstockBehavior = parseInt(e.target.value)}">
                  <option value="0">Compensate</option>
                  <option value="1">No Compensation</option>
                </select>
              </div>
              
              <div class="form-check-sm mb-2">
                <input class="form-check-input" type="checkbox" id="adjustOrderWithPending"
                       ?checked="${this.adjustOrderWithPending}"
                       @change="${e => this.adjustOrderWithPending = e.target.checked}" />
                <label class="form-check-label" for="adjustOrderWithPending">Adjust Order with Pending</label>
              </div>
              
              <button class="btn btn-sm btn-primary" 
                      @click="${this.calculateNeeds}"
                      ?disabled="${this.loading || this.selectedItems.length === 0}">
                ${this.loading ? html`<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Calculating...` : 'Calculate Needs'}
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  renderStep3() {
    // Process items to add action buttons
    const itemsWithActions = this.calculatedResults.map(item => {
      return {
        ...item,
        _actions: html`
          <button class="btn btn-sm btn-outline-primary" 
                  @click="${(e) => { e.stopPropagation(); this.fetchSalesHistory(item); }}">
            <i class="bi bi-graph-up"></i> Sales History
          </button>
        `
      };
    });

    return html`
      <div class="card mb-2 border-light shadow-sm">
        <div class="card-body p-2">
          <h5 class="card-title mb-2">Step 3: Calculation Results</h5>
          
          <div class="mb-2 d-flex justify-content-between">
            <button class="btn btn-sm btn-outline-secondary" @click="${this.backToStep2}">
              Back to Step 2
            </button>
            
            <button class="btn btn-sm btn-success" @click="${this.exportToExcel}" ?disabled="${!this.calculatedResults.length}">
              <i class="bi bi-file-earmark-excel"></i> Export to Excel
            </button>
          </div>
          
          <div class="table-responsive">
            <data-table
              .items="${itemsWithActions}"
              .skipNr="${0}"
              class="table table-sm table-hover">
            </data-table>
            ${this.calculatedResults.length === 0 && !this.loading ? html`<p class="text-center text-muted mt-3">No calculation results to display.</p>` : ''}
          </div>
        </div>
      </div>
      
      ${this.renderSalesHistoryModal()}
    `;
  }

  render() {
    return html`
      <style>
        .fancy-dropdown {
          position: relative;
        }
        .fancy-dropdown-menu {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          background: white;
          border: 1px solid #ddd;
          border-radius: 4px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          max-height: 300px;
          z-index: 1050;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        .fancy-dropdown-header {
          padding: 8px;
          border-bottom: 1px solid #eee;
        }
        .fancy-dropdown-actions {
          display: flex;
          justify-content: space-between;
          padding: 8px;
          border-bottom: 1px solid #eee;
        }
        .fancy-dropdown-content {
          overflow-y: auto;
          max-height: 200px;
        }
        .fancy-dropdown-item {
          padding: 6px 8px;
          cursor: pointer;
        }
        .fancy-dropdown-item:hover {
          background: #f8f9fa;
        }
        .sticky-top {
          position: sticky;
          top: 0;
          background: white;
          z-index: 10;
        }
        
        /* Sales History Modal Styles */
        .modal {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 1050;
          outline: 0;
          background-color: rgba(0,0,0,0.5);
        }
        .modal-dialog {
          position: relative;
          margin: 1.75rem auto;
          max-width: 800px;
          z-index: 1051;
        }
        .modal-content {
          position: relative;
          display: flex;
          flex-direction: column;
          width: 100%;
          pointer-events: auto;
          background-color: #fff;
          border: 1px solid rgba(0,0,0,.2);
          border-radius: .3rem;
          outline: 0;
          box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.15);
        }
        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem;
          border-bottom: 1px solid #dee2e6;
        }
        .modal-body {
          position: relative;
          flex: 1 1 auto;
          padding: 1rem;
        }
        .modal-footer {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          padding: 0.75rem;
          border-top: 1px solid #dee2e6;
        }
      </style>
      
      <div class="container-fluid">
       
        ${this.error ? html`<div class="alert alert-danger">${this.error}</div>` : ''}
        
        <div class="progress mb-2" style="${this.step > 1 ? '' : 'display: none;'}">
          <div class="progress-bar" role="progressbar" style="width: ${(this.step - 1) * 50}%"></div>
        </div>
        
        ${this.step === 1 ? this.renderStep1() : ''}
        ${this.step === 2 ? this.renderStep2() : ''}
        ${this.step === 3 ? this.renderStep3() : ''}
      </div>
      
      <!-- Show the modal if it's active -->
      ${this.renderSalesHistoryModal()}
    `;
  }
}

customElements.define('top-abc', TopAbc);