// Top ABC Analysis Control Panel Component
import { LitElement, html, css } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';
import { client } from '../../socketConfig.js';

export class TopAbcControlPanel extends LitElement {
  static get properties() {
    return {
      token: { type: String },
      dataReferinta: { type: String },
      nrSaptamani: { type: Number },
      seriesL: { type: String },
      branch: { type: String },
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

  constructor() {
    super();
    this.token = '';
    this.dataReferinta = new Date().toISOString().slice(0, 10);
    this.nrSaptamani = 52;
    this.seriesL = '';
    this.branch = '';
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
      
      if (suppliersResponse && suppliersResponse.rows) {
        this.suppliers = suppliersResponse.rows;
      }
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
    this.dispatchEvent(new CustomEvent('apply-filters', {
      detail: this.getParameters(),
      bubbles: true,
      composed: true
    }));
  }

  render() {
    return html`
      <style>
        .control-panel {
          background-color: #f8f9fa;
          border-radius: 5px;
          padding: 15px;
          margin-bottom: 20px;
          border: 1px solid #ddd;
        }
        .form-row {
          display: flex;
          flex-wrap: wrap;
          margin-bottom: 10px;
          gap: 15px;
          align-items: center;
        }
        .form-group {
          flex: 1 1 200px;
          margin-bottom: 10px;
        }
        .form-group label {
          display: block;
          margin-bottom: 5px;
          font-weight: 500;
        }
        .form-control {
          width: 100%;
          padding: 8px;
          border: 1px solid #ced4da;
          border-radius: 4px;
          box-sizing: border-box;
        }
        .btn {
          padding: 8px 16px;
          border-radius: 4px;
          border: none;
          cursor: pointer;
          font-weight: 500;
          transition: background-color 0.3s;
        }
        .btn-primary {
          background-color: #007bff;
          color: white;
        }
        .btn-primary:hover {
          background-color: #0069d9;
        }
        .btn-secondary {
          background-color: #6c757d;
          color: white;
        }
        .btn-secondary:hover {
          background-color: #5a6268;
        }
        .actions {
          margin-top: 15px;
          display: flex;
          justify-content: flex-end;
          gap: 10px;
        }
      </style>

      <div class="control-panel">
        <div class="form-row">
          <div class="form-group">
            <label for="dataReferinta">Reference Date</label>
            <input type="date" id="dataReferinta" name="dataReferinta" class="form-control" .value=${this.dataReferinta} @change=${this.handleInputChange}>
          </div>
          
          <div class="form-group">
            <label for="nrSaptamani">Number of Weeks</label>
            <input type="number" id="nrSaptamani" name="nrSaptamani" class="form-control" min="1" max="260" .value=${this.nrSaptamani} @change=${this.handleInputChange}>
          </div>
          
          <div class="form-group">
            <label for="supplier">Supplier</label>
            <select id="supplier" name="supplier" class="form-control" @change=${this.handleInputChange}>
              <option value="">All Suppliers</option>
              ${this.suppliers.map(supplier => html`
                <option value=${supplier.PARTNERID} ?selected=${this.supplier === supplier.PARTNERID}>
                  ${supplier.NAME}
                </option>
              `)}
            </select>
          </div>
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label for="branch">Branches (comma separated)</label>
            <input type="text" id="branch" name="branch" class="form-control" .value=${this.branch} @input=${this.handleInputChange} 
                  placeholder="e.g. 1200,1300,1400">
          </div>
          
          <div class="form-group">
            <label for="seriesL">Series to Exclude (comma separated)</label>
            <input type="text" id="seriesL" name="seriesL" class="form-control" .value=${this.seriesL} @input=${this.handleInputChange}>
          </div>
          
          <div class="form-group">
            <label for="cod">Product Code</label>
            <input type="text" id="cod" name="cod" class="form-control" .value=${this.cod} @input=${this.handleInputChange}
                  placeholder="Product code to filter">
          </div>
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label for="searchType">Search Type</label>
            <select id="searchType" name="searchType" class="form-control" @change=${this.handleInputChange}>
              <option value="1" ?selected=${this.searchType === 1}>Starts with</option>
              <option value="2" ?selected=${this.searchType === 2}>Contains</option>
              <option value="3" ?selected=${this.searchType === 3}>Ends with</option>
            </select>
          </div>
          
          <div class="form-group">
            <label for="modFiltrareBranch">Branch Filter Mode</label>
            <select id="modFiltrareBranch" name="modFiltrareBranch" class="form-control" @change=${this.handleInputChange}>
              <option value="AGENT" ?selected=${this.modFiltrareBranch === 'AGENT'}>Agent</option>
              <option value="DOCUMENT" ?selected=${this.modFiltrareBranch === 'DOCUMENT'}>Document</option>
            </select>
          </div>
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label for="thresholdA">Threshold A (%)</label>
            <input type="number" id="thresholdA" name="thresholdA" class="form-control" min="0" max="100" step="0.1" .value=${this.thresholdA} @input=${this.handleInputChange}>
          </div>
          
          <div class="form-group">
            <label for="thresholdB">Threshold B (%)</label>
            <input type="number" id="thresholdB" name="thresholdB" class="form-control" min="0" max="100" step="0.1" .value=${this.thresholdB} @input=${this.handleInputChange}>
          </div>
        </div>
        
        <div class="actions">
          <button class="btn btn-primary" @click=${this.handleApplyFilters} ?disabled=${this.loading}>
            ${this.loading ? 'Loading...' : 'Apply Filters'}
          </button>
        </div>
      </div>
    `;
  }
}

// Register the custom element
customElements.define('top-abc-control-panel', TopAbcControlPanel);
