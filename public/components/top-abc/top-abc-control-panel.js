// Top ABC Analysis Control Panel Component
import { LitElement, html, css } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';
import { client } from '../../socketConfig.js';
import '../fancy-dropdown.js';

export class TopAbcControlPanel extends LitElement {
  static get properties() {
    return {
      token: { type: String },
      dataReferinta: { type: String },
      nrSaptamani: { type: Number },
      seriesL: { type: String },
      branch: { type: String },
      selectedBranches: { type: Array }, // Added for fancy-dropdown
      selectedSuppliers: { type: Array }, // for fancy-dropdown
      supplier: { type: Number },
      mtrl: { type: Number },
      cod: { type: String },
      searchType: { type: Number },
      modFiltrareBranch: { type: String },
      thresholdA: { type: Number },
      thresholdB: { type: Number },
      suppliers: { type: Array },
      branches: { type: Object },
      loading: { type: Boolean }
    };
  }

  createRenderRoot() {
    return this; // Render in light DOM to use global styles
  }

  constructor() {
    super();
    this.token = '';
    this.dataReferinta = new Date().toISOString().slice(0, 10);
    this.nrSaptamani = 52;
    this.seriesL = '';
    this.branch = '';
    this.selectedBranches = [];
    this.selectedSuppliers = []; // initialize supplier selection
    this.supplier = null;
    this.mtrl = null;
    this.cod = '';
    this.searchType = 1;
    this.modFiltrareBranch = 'AGENT';
    this.thresholdA = 80;
    this.thresholdB = 15;
    this.suppliers = [];
    this.loading = false;
    
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
  }

  connectedCallback() {
    super.connectedCallback();
    this.loadInitialData();
  }

  // Initialize selectedBranches from branch string if it exists
  initializeBranchSelection() {
    // Guard against this.branches not being populated (it's an object, not array)
    if (!this.branches || typeof this.branches !== 'object') {
      this.selectedBranches = [];
      return;
    }

    if (this.branch && this.branch !== "1000") {
      const branchIds = this.branch.split(",");
      this.selectedBranches = branchIds.filter(id => this.branches[id]).map(id => id);
    } else if (this.branch === "1000") {
      this.selectedBranches = ["1000"];
    } else {
      // Clear selection if this.branch is empty or null
      this.selectedBranches = [];
    }
 }

  async loadInitialData() {
    this.token = sessionStorage.getItem('s1Token');
    if (!this.token) {
      console.error('No token available');
      return;
    }

    try {
      this.loading = true;
      // Load suppliers
      const suppliersResponse = await client.service('necesar-achizitii').getSuppliers({
        token: this.token
      });
      
      if (suppliersResponse) {
        this.suppliers = suppliersResponse || [];
      }
      
      // Initialize branch selection if needed
      this.initializeBranchSelection();
    } catch (error) {
      console.error('Error loading initial data:', error);
    } finally {
      this.loading = false;
    }
  }

  handleInputChange(e) {
    const target = e.target;
    const name = target.name;
    let value = target.type === 'checkbox' ? target.checked : target.value;
    
    // Convert numeric inputs
    if (['nrSaptamani', 'supplier', 'mtrl', 'searchType', 'thresholdA', 'thresholdB'].includes(name)) {
      if (value === '' || value === null) {
        value = null;
      } else {
        value = Number(value);
      }
    }

    this[name] = value;
    
    // Dispatch event with updated parameters
    this.dispatchEvent(new CustomEvent('params-changed', {
      detail: this.getParameters(),
      bubbles: true,
      composed: true
    }));
  }

  // Handler for branch selection from fancy-dropdown
  handleBranchSelectionChanged(e) {
    // Update selectedBranches with the new selection
    this.selectedBranches = [...e.detail.value];
    // Update the branch string for API compatibility - selectedBranches contains the keys
    this.branch = this.selectedBranches.join(',');
    // Dispatch event with updated parameters
    this.dispatchEvent(new CustomEvent('params-changed', {
      detail: this.getParameters(),
      bubbles: true,
      composed: true
    }));
  }

  // Add supplierItems getter and selection handler
  get supplierItems() {
    const items = {};
    this.suppliers.forEach(s => { items[s.TRDR] = s.CODE + ' - ' + s.NAME; });
    return items;
  }

  handleSupplierSelectionChanged(e) {
    // single-select: take first value
    this.selectedSuppliers = [...e.detail.value];
    this.supplier = this.selectedSuppliers.length ? Number(this.selectedSuppliers[0]) : null;
    this.dispatchEvent(new CustomEvent('params-changed', {
      detail: this.getParameters(), bubbles: true, composed: true
    }));
  }

  getParameters() {
    // Ensure the date is properly formatted for SQL - quoted in the API call
    return {
      dataReferinta: this.dataReferinta, // The API will add quotes to the date
      nrSaptamani: this.nrSaptamani,
      seriesL: this.seriesL,
      branch: this.branch,
      supplier: this.supplier,
      mtrl: this.mtrl,
      cod: this.cod,
      searchType: this.searchType,
      modFiltrareBranch: this.modFiltrareBranch,
      thresholdA: this.thresholdA,
      thresholdB: this.thresholdB
    };
  }

  handleApplyFilters() {
    // Validate that branch is selected before allowing filter application
    if (!this.branch || this.branch.trim() === '') {
      alert('Please select a branch. Branch selection is mandatory.');
      return;
    }
    
    this.dispatchEvent(new CustomEvent('apply-filters', {
      detail: this.getParameters(),
      bubbles: true,
      composed: true
    }));
  }

  willUpdate(changedProperties) {
    if (changedProperties.has("branch")) {
      this.initializeBranchSelection();
      // Ensure the fancy-dropdown re-renders with the new selection
      // Use querySelector since we render in light DOM, not shadow DOM
      setTimeout(() => {
        const branchDropdown = this.querySelector('#branch-fancy-dropdown');
        if (branchDropdown) {
          branchDropdown.requestUpdate();
        }
      }, 0);
    }
    if (changedProperties.has("supplier")) {
      if (this.supplier === null) {
        this.selectedSuppliers = [];
      } else if (this.supplier && this.suppliers && Array.isArray(this.suppliers)) {
        // Find the supplier and set selectedSuppliers to contain just the TRDR key
        const supplierIdToFind = Number(this.supplier);
        const selected = this.suppliers.find(s => s.TRDR === supplierIdToFind);
        this.selectedSuppliers = selected ? [String(selected.TRDR)] : [];
      } else {
        this.selectedSuppliers = [];
      }
      // Ensure the fancy-dropdown re-renders with the new selection
      // Use querySelector since we render in light DOM, not shadow DOM
      setTimeout(() => {
        const supplierDropdown = this.querySelector('#supplier-fancy-dropdown');
        if (supplierDropdown) {
          supplierDropdown.requestUpdate();
        }
      }, 0);
    }
  }

  render() {
    return html`
      <div class="card mb-2 border-light shadow-sm" style="overflow: visible;">
        <div class="card-body p-3" style="overflow: visible;">
          <h5 class="card-title mb-3">Settings for Top ABC Analysis</h5>
          
          <!-- Row 1 - Primary Controls -->
          <div class="row mb-3">
            <div class="col-md-3">
              <div class="input-group input-group-sm mb-2">
                <span class="input-group-text">Date</span>
                <input type="date" id="dataReferinta" name="dataReferinta" class="form-control form-control-sm" .value=${this.dataReferinta} @change=${this.handleInputChange}>
              </div>
            </div>
            
            <div class="col-md-2">
              <div class="input-group input-group-sm mb-2">
                <span class="input-group-text">Weeks behind</span>
                <input type="number" id="nrSaptamani" name="nrSaptamani" class="form-control form-control-sm" min="1" max="260" .value=${this.nrSaptamani} @change=${this.handleInputChange}>
              </div>
            </div>
            
            <div class="col-md-3">
              <div class="input-group input-group-sm mb-2">
                <span class="input-group-text">Mode</span>
                <select id="modFiltrareBranch" name="modFiltrareBranch" class="form-select form-select-sm" @change=${this.handleInputChange}>
                  <option value="AGENT" ?selected=${this.modFiltrareBranch === 'AGENT'}>Agent</option>
                  <option value="DOCUMENT" ?selected=${this.modFiltrareBranch === 'DOCUMENT'}>Document</option>
                </select>
              </div>
            </div>
            
            <div class="col-md-4">
              <div class="input-group input-group-sm mb-2">
                <span class="input-group-text">Exclude</span>
                <input type="text" id="seriesL" name="seriesL" class="form-control" .value=${this.seriesL} @input=${this.handleInputChange}
                       placeholder="Comma separated">
              </div>
            </div>
          </div>
          
          <!-- Row 2 - Combined row with all selections -->
          <div class="row mb-3">
            <!-- Branch Selection (Required) -->
            <div class="col-md-3" style="position: relative; z-index: 100;">
              <div class="input-group input-group-sm mb-2">
                <span class="input-group-text">Branch<span class="text-danger ms-1">*</span></span>
                <div class="form-control p-0">
                  <fancy-dropdown
                    .items=${this.branches}
                    .selectedItems=${this.selectedBranches}
                    .multiSelect=${false}
                    placeholder="Select branch (required)"
                    searchPlaceholder="Search branch..."
                    @selection-changed=${this.handleBranchSelectionChanged}
                    ?disabled=${this.loading}
                    class="${!this.branch || this.branch.trim() === '' ? 'required-field' : ''}"
                    id="branch-fancy-dropdown"
                  ></fancy-dropdown>
                </div>
              </div>
            </div>

            <!-- Supplier Selection -->
            <div class="col-md-3" style="position: relative; z-index: 90;">
              <div class="input-group input-group-sm mb-2">
                <span class="input-group-text">Supplier</span>
                <div class="form-control p-0">
                  <fancy-dropdown
                    .items=${this.supplierItems}
                    .selectedItems=${this.selectedSuppliers}
                    .multiSelect=${false}
                    placeholder="Select supplier"
                    searchPlaceholder="Search supplier..."
                    @selection-changed=${this.handleSupplierSelectionChanged}
                    ?disabled=${this.loading}
                    id="supplier-fancy-dropdown"
                  ></fancy-dropdown>
                </div>
              </div>
            </div>
            
            <!-- Product Search -->
            <div class="col-md-3">
              <div class="input-group input-group-sm mb-2">
                <span class="input-group-text">Product</span>
                <select id="searchType" name="searchType" class="form-select" style="max-width: 95px" @change=${this.handleInputChange}>
                  <option value="1" ?selected=${this.searchType === 1}>Starts</option>
                  <option value="2" ?selected=${this.searchType === 2}>Contains</option>
                  <option value="3" ?selected=${this.searchType === 3}>Ends</option>
                </select>
                <input type="text" id="cod" name="cod" class="form-control" .value=${this.cod} @input=${this.handleInputChange}
                      placeholder="Code" title="Product code to filter">
              </div>
            </div>
            
            <!-- ABC Thresholds -->
            <div class="col-md-3">
              <div class="input-group input-group-sm mb-2">
                <span class="input-group-text">A(%)</span>
                <input type="number" id="thresholdA" name="thresholdA" class="form-control" min="0" max="100" step="0.1" .value=${this.thresholdA} @input=${this.handleInputChange}>
                <span class="input-group-text">B(%)</span>
                <input type="number" id="thresholdB" name="thresholdB" class="form-control" min="0" max="100" step="0.1" .value=${this.thresholdB} @input=${this.handleInputChange}>
              </div>
            </div>
          </div>
          
          <!-- Row 3 - Apply Filters button -->
          <div class="row">
            <div class="col-12 text-end">
              <button class="btn btn-sm btn-primary" @click=${this.handleApplyFilters} ?disabled=${this.loading}>
                ${this.loading ? html`<span class="spinner-border spinner-border-sm me-1"></span> Loading...` : 'Load data'}
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}

// Register the custom element
customElements.define('top-abc-control-panel', TopAbcControlPanel);
