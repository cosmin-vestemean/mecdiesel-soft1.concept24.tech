import { LitElement, html } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';
import { connectToS1 } from '../dataFetching.js';
import { client } from '../socketConfig.js';
import { columnConfig } from '../config/table-column-config.js'; // Import column config

// Import child components
import './query-panel.js';
import './manipulation-panel.js';
import './strategy-panel.js';
import './status-legend.js';
import './data-table.js';

export class BranchReplenishmentContainer extends LitElement {
  static get properties() {
    return {
      // State managed by the container
      branchesEmit: { type: String, state: true },
      selectedDestBranches: { type: Array, state: true },
      fiscalYear: { type: Number, state: true },
      data: { type: Array, state: true },
      loading: { type: Boolean, state: true },
      error: { type: String, state: true },
      searchTerm: { type: String, state: true },
      setConditionForNecesar: { type: Boolean, state: true },
      setConditionForLimits: { type: Boolean, state: true },
      selectedReplenishmentStrategy: { type: String, state: true },
      transferFilter: { type: String, state: true },
      destinationFilter: { type: String, state: true },
      isSuccessiveStrategy: { type: Boolean, state: true },
      stockStatusFilter: { type: String, state: true },

      // Passed down, potentially static
      branches: { type: Object },
    };
  }

  constructor() {
    super();
    this.branchesEmit = '';
    this.selectedDestBranches = [];
    this.fiscalYear = new Date().getFullYear(); // Keep for potential future use
    this.data = [];
    this.loading = false;
    this.error = '';
    this.searchTerm = '';
    this.setConditionForNecesar = true;
    this.setConditionForLimits = true;
    this.selectedReplenishmentStrategy = 'none';
    this.transferFilter = 'all';
    this.destinationFilter = 'all';
    this.isSuccessiveStrategy = true;
    this.stockStatusFilter = 'all';
    this.branches = { // Keep branches data here or fetch if dynamic
      '1000': 'HQ', '1200': 'CLUJ', '1300': 'CONSTANTA', '1400': 'GALATI',
      '1500': 'PLOIESTI', '1600': 'IASI', '1700': 'SIBIU', '1800': 'CRAIOVA',
      '1900': 'ORADEA', '2000': 'PITESTI', '2100': 'BRASOV', '2200': 'BUCURESTI',
      '2300': 'ARAD', '2400': 'VOLUNTARI', '2600': 'MIHAILESTI', '2700': 'TG. MURES',
      '2800': 'TIMISOARA', '2900': 'RAMNICU VALCEA'
    };
  }

  createRenderRoot() {
    return this; // Render in light DOM
  }

  // --- Data Fetching and Actions ---
  async _handleLoadData() {
    this.loading = true;
    this.error = '';
    try {
      if (!this.branchesEmit) throw new Error('Please select a source branch');
      if (this.selectedDestBranches.length === 0) throw new Error('Please select at least one destination branch');

      const branchesDest = this.selectedDestBranches.join(',');
      const token = await new Promise((resolve, reject) => {
        connectToS1((token) => token ? resolve(token) : reject(new Error('Failed to get token')));
      });

      const response = await client.service('s1').getAnalyticsForBranchReplenishment({
        clientID: token,
        branchesEmit: this.branchesEmit,
        branchesDest: branchesDest,
        fiscalYear: this.fiscalYear,
        company: 1000, // Assuming company is fixed or add as property
        setConditionForNecesar: this.setConditionForNecesar,
        setConditionForLimits: this.setConditionForLimits
      });

      // Ensure each item has a unique keyField
      this.data = (Array.isArray(response) ? response : []).map((item, index) => ({
        ...item,
        // Create a unique key if not provided by backend (adjust if backend provides one)
        keyField: item.keyField || `${item.mtrl}-${item.branchD}-${index}`
      }));

    } catch (error) {
      console.error('Error loading branch replenishment data:', error);
      this.error = `Error loading data: ${error.message}`;
      this.data = [];
    } finally {
      this.loading = false;
    }
  }

  _handleSaveData() {
    // Extract only relevant data for saving
    const transfersToProcess = this.data
      .filter(item => parseFloat(item.transfer || 0) > 0) // Example: only save positive transfers
      .map(item => ({
          mtrl: item.mtrl,
          branchD: item.branchD,
          transfer: parseFloat(item.transfer || 0)
      })); // Adjust payload as needed

    if (transfersToProcess.length === 0) {
        alert('No transfers with quantity greater than 0 to save.');
        return;
    }

    console.log('Saving data:', transfersToProcess);
    // Add actual save logic here (e.g., API call to a Feathers service)
    // Example:
    // client.service('transfer-processor').create({ transfers: transfersToProcess })
    //   .then(() => alert('Data saved successfully!'))
    //   .catch(err => {
    //     console.error('Save error:', err);
    //     alert(`Error saving data: ${err.message}`);
    //   });
    alert('Save functionality simulation: Check console for data to be saved.');
  }

  _handleExportData() {
    if (!this.data.length) {
      alert('No data to export.');
      return;
    }
    // Use the filtered data for export
    const exportData = this.filteredData.map(item => {
        const row = {};
        columnConfig.forEach(col => {
            // Include visible columns, format numbers, handle special cases
            if (col.visible) {
                let value = item[col.key];
                if (col.type === 'number') {
                    value = parseFloat(value || 0);
                }
                // Add more formatting if needed
                row[col.displayName] = value;
            } else if (col.key === 'mtrl') { // Always include mtrl even if hidden
                 row[col.displayName] = item[col.key];
            }
        });
        return row;
    });

    try {
        const ws = XLSX.utils.json_to_sheet(exportData);
        // Make numeric columns actual numbers in Excel
        const numericColumns = columnConfig.filter(c => c.visible && c.type === 'number').map(c => c.displayName);
        const range = XLSX.utils.decode_range(ws['!ref']);
        for (let R = range.s.r + 1; R <= range.e.r; ++R) { // Skip header row
            for (let C = range.s.c; C <= range.e.c; ++C) {
                const cell_address = { c: C, r: R };
                const cell_ref = XLSX.utils.encode_cell(cell_address);
                if (!ws[cell_ref]) continue;
                const header = XLSX.utils.encode_cell({ c: C, r: 0 });
                if (numericColumns.includes(ws[header].v)) {
                    const numericValue = parseFloat(ws[cell_ref].v);
                    if (!isNaN(numericValue)) {
                        ws[cell_ref].t = 'n';
                        ws[cell_ref].v = numericValue;
                        // Optional: Add number format string if needed
                        // ws[cell_ref].z = '#,##0.00';
                    } else {
                         ws[cell_ref].t = 's'; // Keep as string if parsing fails
                    }
                }
            }
        }

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Branch Replenishment');
        const date = new Date().toISOString().split('T')[0];
        const filename = `branch_replenishment_${this.branchesEmit}_${date}.xlsx`;
        XLSX.writeFile(wb, filename);
    } catch (error) {
        console.error("Error exporting to Excel:", error);
        alert("Failed to export data to Excel.");
    }
  }

  // --- Strategy Application ---
  _handleApplyStrategy() {
    if (!this.data.length || this.selectedReplenishmentStrategy === 'none') return;

    const currentFilteredDataKeys = new Set(this.filteredData.map(item => item.keyField));
    let dataUpdated = false;

    // Create a new array to ensure Lit detects the change
    const newData = this.data.map(item => {
        // Only apply strategy to items currently visible in the filtered view
        if (!currentFilteredDataKeys.has(item.keyField)) {
            return item;
        }

        let updatedItem = { ...item }; // Work on a copy
        let applyChange = false;

        // Determine if the strategy should be applied based on the successive flag
        if (this.isSuccessiveStrategy) {
            if (parseFloat(updatedItem.transfer || 0) === 0) {
                applyChange = true;
            }
        } else {
            applyChange = true;
        }

        if (applyChange) {
            switch (this.selectedReplenishmentStrategy) {
                case 'min':
                    if (updatedItem.Blacklisted === '-') {
                        const minQty = parseFloat(updatedItem.cant_min);
                        updatedItem.transfer = minQty > 0 ? minQty : 0;
                        dataUpdated = true;
                    }
                    break;
                case 'max':
                    if (updatedItem.Blacklisted === '-') {
                        const maxQty = parseFloat(updatedItem.cant_max);
                        updatedItem.transfer = maxQty > 0 ? maxQty : 0;
                        dataUpdated = true;
                    }
                    break;
                case 'skip_blacklisted':
                    // This strategy doesn't make sense with 'Apply to Zeros' as it sets to zero
                    // If not successive, it clears transfers for blacklisted items
                    if (!this.isSuccessiveStrategy && updatedItem.Blacklisted !== '-') {
                         updatedItem.transfer = 0;
                         dataUpdated = true;
                    } else if (this.isSuccessiveStrategy && updatedItem.Blacklisted !== '-') {
                        // If successive, we just skip applying min/max, but don't clear existing transfers
                        // No action needed here if already zero
                    }
                    break;
                case 'clear':
                    updatedItem.transfer = 0;
                    dataUpdated = true;
                    break;
            }
        }
        return updatedItem;
    });

    if (dataUpdated) {
        this.data = newData; // Trigger update with modified data
    }
    // Don't reset dropdown immediately, user might want to apply again with different successive setting
    // this.selectedReplenishmentStrategy = 'none';
  }


  // --- Filtering Logic ---
  get filteredData() {
    let filtered = this.data;

    // Apply search term filter (Code or Description)
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      const searchColumns = columnConfig.filter(c => c.filterable && c.type === 'string' && !c.isHeaderFilter).map(c => c.key);
      filtered = filtered.filter(item =>
          searchColumns.some(key => item[key] && item[key].toLowerCase().includes(term))
      );
    }

    // Apply transfer value filter
    if (this.transferFilter !== 'all') {
      filtered = filtered.filter(item => {
        const transfer = parseFloat(item.transfer || 0);
        return this.transferFilter === 'positive' ? transfer > 0 : transfer === 0;
      });
    }

    // Apply destination filter (from header dropdown)
    if (this.destinationFilter !== 'all') {
      const destColKey = columnConfig.find(c => c.isHeaderFilter)?.key || 'Destinatie';
      filtered = filtered.filter(item => item[destColKey] === this.destinationFilter);
    }

    // Apply stock status filter (from legend)
    if (this.stockStatusFilter !== 'all') {
      filtered = filtered.filter(item => {
        const stockClass = this.getStockClass(item.stoc_dest, item.min_dest, item.max_dest); // Use the specific destination stock class
        switch (this.stockStatusFilter) {
          case 'critical': return stockClass.includes('stock-critical');
          case 'optimal': return stockClass.includes('stock-optimal');
          case 'high': return stockClass.includes('stock-high');
          case 'undefined': return stockClass.includes('stock-undefined');
          default: return true;
        }
      });
    }
    return filtered;
  }

  get uniqueDestinations() {
    if (!this.data || this.data.length === 0) return [];
    const destColKey = columnConfig.find(c => c.isHeaderFilter)?.key || 'Destinatie';
    return [...new Set(this.data.map(item => item[destColKey]))].sort();
  }

  // --- Utility Methods (Passed down or used internally) ---
  // Combined getStockClass, specify target (emit/dest)
  getStockClass(value, minLimit, maxLimit) {
    const stock = parseFloat(value);
    const min = parseFloat(minLimit);
    const max = parseFloat(maxLimit);
    if (isNaN(stock)) return '';
    if (!isNaN(min) && stock < min) return 'text-danger stock-critical';
    if (!isNaN(min) && !isNaN(max) && stock >= min && stock <= max) return 'text-dark stock-optimal';
    if (!isNaN(max) && stock > max) return 'text-success stock-high';
    if (stock > 0 && (isNaN(min) || isNaN(max))) return 'text-warning stock-undefined'; // Only undefined if limits are missing
    return 'text-muted'; // Zero or negative stock with no limits, or NaN limits
  }

  // Specific getters for passing down, maintaining original logic if needed elsewhere
  getStockClassEmit = (item) => this.getStockClass(item.stoc_emit, item.min_emit, item.max_emit);
  getStockClassDest = (item) => this.getStockClass(item.stoc_dest, item.min_dest, item.max_dest);

  getValueClass = (value) => {
    const num = parseFloat(value);
    if (isNaN(num)) return '';
    return num < 0 ? 'text-danger fw-bold' : (num > 0 ? 'text-success' : 'text-muted');
  }

  getBlacklistedClass = (item) => item.Blacklisted === 'Da' ? 'text-danger fw-bold' : '';
  getLichidareClass = (item) => item.InLichidare === 'Da' ? 'text-warning fw-bold' : '';


  // --- Event Handlers for Child Component Updates ---
  _handleQueryUpdate(e) {
    const { property, value } = e.detail;
    if (this.hasOwnProperty(property)) {
      this[property] = value;
    }
  }

  _handleManipulationUpdate(e) {
    const { property, value } = e.detail;
    if (this.hasOwnProperty(property)) {
      this[property] = value;
    }
  }

   _handleStrategyUpdate(e) {
    const { property, value } = e.detail;
    if (this.hasOwnProperty(property)) {
      this[property] = value;
    }
  }

  _handleLegendUpdate(e) {
     const { property, value } = e.detail;
     if (property === 'stockStatusFilter') {
        this.stockStatusFilter = value;
     }
  }

  _handleTableUpdate(e) {
     const { property, value, itemKey, transferValue } = e.detail;
     if (property === 'destinationFilter') {
         this.destinationFilter = value;
     } else if (property === 'itemTransfer' && itemKey !== undefined) {
         // Update transfer value for a specific item
         const dataIndex = this.data.findIndex(item => item.keyField === itemKey);
         if (dataIndex > -1) {
             // Create a new array with the updated item to trigger Lit update
             const newData = [...this.data];
             // Ensure transfer is a non-negative number
             const newTransferValue = Math.max(0, parseFloat(transferValue || 0));
             if (!isNaN(newTransferValue)) {
                 newData[dataIndex] = { ...newData[dataIndex], transfer: newTransferValue };
                 this.data = newData;
             }
         }
     }
  }

  // --- Lifecycle Callbacks ---
  updated(changedProperties) {
    // Initialize tooltips after rendering/updating
    const tooltipTriggerList = this.querySelectorAll('[data-bs-toggle="tooltip"]');
    tooltipTriggerList.forEach(tooltipTriggerEl => {
        // Dispose existing tooltip instance if it exists
        const existingTooltip = bootstrap.Tooltip.getInstance(tooltipTriggerEl);
        if (existingTooltip) {
            existingTooltip.dispose();
        }
        // Create new tooltip instance
        new bootstrap.Tooltip(tooltipTriggerEl, { trigger: 'hover' }); // Ensure hover trigger
    });

    // If data changes, recalculate legend counts (needed if legend counts depend on filtered data)
    if (changedProperties.has('data') || changedProperties.has('searchTerm') || changedProperties.has('transferFilter') || changedProperties.has('destinationFilter') || changedProperties.has('stockStatusFilter')) {
        this.requestUpdate('statusCounts'); // Request update for computed property if needed
    }
  }

  // --- Rendering ---
  render() {
    const currentFilteredData = this.filteredData; // Use the getter
    const totalCount = this.data.length;
    const filteredCount = currentFilteredData.length;

    // Calculate counts for the legend based on the *currently filtered* data
    // This makes the legend counts dynamic based on other active filters
    const statusCounts = {
        critical: currentFilteredData.filter(item => this.getStockClassDest(item).includes('stock-critical')).length,
        optimal: currentFilteredData.filter(item => this.getStockClassDest(item).includes('stock-optimal')).length,
        high: currentFilteredData.filter(item => this.getStockClassDest(item).includes('stock-high')).length,
        undefined: currentFilteredData.filter(item => this.getStockClassDest(item).includes('stock-undefined')).length,
        all: filteredCount // 'All' in legend shows the count matching current filters
    };


    return html`
      <div class="container-fluid mt-2">
        ${this.error ? html`<div class="alert alert-danger alert-dismissible fade show" role="alert">
                            ${this.error}
                            <button type="button" class="btn-close" @click=${() => this.error = ''} aria-label="Close"></button>
                          </div>` : ''}

        <query-panel
          .branches=${this.branches}
          .branchesEmit=${this.branchesEmit}
          .selectedDestBranches=${this.selectedDestBranches}
          .setConditionForNecesar=${this.setConditionForNecesar}
          .setConditionForLimits=${this.setConditionForLimits}
          .loading=${this.loading}
          @load-data=${this._handleLoadData}
          @save-data=${this._handleSaveData}
          @export-data=${this._handleExportData}
          @update-property=${this._handleQueryUpdate}>
        </query-panel>

        <manipulation-panel
          .searchTerm=${this.searchTerm}
          .transferFilter=${this.transferFilter}
          .totalCount=${totalCount}
          .filteredCount=${filteredCount}
          @update-property=${this._handleManipulationUpdate}>
        </manipulation-panel>

        <strategy-panel
          .selectedReplenishmentStrategy=${this.selectedReplenishmentStrategy}
          .isSuccessiveStrategy=${this.isSuccessiveStrategy}
          .loading=${this.loading}
          ?disabled=${!this.data || this.data.length === 0}
          @apply-strategy=${this._handleApplyStrategy}
          @update-property=${this._handleStrategyUpdate}>
        </strategy-panel>

        <status-legend
          .stockStatusFilter=${this.stockStatusFilter}
          .statusCounts=${statusCounts}
          ?disabled=${!this.data || this.data.length === 0}
          @update-property=${this._handleLegendUpdate}>
        </status-legend>

        <data-table
          .tableData=${currentFilteredData}
          .columnConfig=${columnConfig}
          .destinationFilter=${this.destinationFilter}
          .uniqueDestinations=${this.uniqueDestinations}
          .utilityFunctions=${{
              getStockClassEmit: this.getStockClassEmit,
              getStockClassDest: this.getStockClassDest,
              getValueClass: this.getValueClass,
              getBlacklistedClass: this.getBlacklistedClass,
              getLichidareClass: this.getLichidareClass
          }}
          .loading=${this.loading}
          @update-property=${this._handleTableUpdate}>
        </data-table>
      </div>
    `;
  }
}

customElements.define('branch-replenishment-container', BranchReplenishmentContainer);
