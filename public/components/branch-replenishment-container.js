import { LitElement, html } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';
import { ContextProvider } from 'https://cdn.jsdelivr.net/npm/@lit/context@1.1.0/index.js';
import { connectToS1 } from '../dataFetching.js';
import { client } from '../socketConfig.js';
import { columnConfig } from '../config/table-column-config.js'; // Import column config

// Import store
import { replenishmentStore, ReplenishmentStoreContext } from '../stores/replenishment-store.js';

// Import child components
import './query-panel.js';
import './manipulation-panel.js';
import './strategy-panel.js'; // Will be used as quick-panel
import './data-table.js';

export class BranchReplenishmentContainer extends LitElement {
  static get properties() {
    return {
      // Properties synced from store (no longer state: true)
      branchesEmit: { type: String },
      selectedDestBranches: { type: Array },
      fiscalYear: { type: Number },
      data: { type: Array },
      loading: { type: Boolean },
      error: { type: String },
      searchTerm: { type: String },
      setConditionForNecesar: { type: Boolean },
      setConditionForLimits: { type: Boolean },
      selectedReplenishmentStrategy: { type: String },
      transferFilter: { type: String },
      destinationFilter: { type: String },
      abcFilter: { type: String },
      blacklistedFilter: { type: String },
      lichidareFilter: { type: String },
      isSuccessiveStrategy: { type: Boolean },
      queryPanelVisible: { type: Boolean },

      // Local properties
      branches: { type: Object },
    };
  }

  constructor() {
    super();
    
    // Initialize the store context provider
    this._storeProvider = new ContextProvider(this, {
      context: ReplenishmentStoreContext,
      initialValue: replenishmentStore
    });
    
    console.log('📦 Container initialized context provider with store:', replenishmentStore);
    
    // Subscribe to store changes
    this._unsubscribeFromStore = replenishmentStore.subscribe((newState, previousState, action) => {
      console.log('📦 Container received store update:', action.type, newState);
      this._syncStateFromStore(newState);
    });
    
    // Initialize state from store
    this._syncStateFromStore(replenishmentStore.getState());
    
    // Keep branches data here for now (will be moved to store later)
    this.branches = { 
      '1200': 'CLUJ', '1300': 'CONSTANTA', '1400': 'GALATI',
      '1500': 'PLOIESTI', '1600': 'IASI', '1700': 'SIBIU', '1800': 'CRAIOVA',
      '1900': 'ORADEA', '2000': 'PITESTI', '2100': 'BRASOV', '2200': 'BUCURESTI',
      '2300': 'ARAD', '2400': 'VOLUNTARI', '2600': 'MIHAILESTI', '2700': 'TG. MURES',
      '2800': 'TIMISOARA', '2900': 'RAMNICU VALCEA'
    };
  }

  createRenderRoot() {
    return this; // Render in light DOM
  }

  // --- Store Integration ---
  _syncStateFromStore(state) {
    // Sync reactive properties from store state
    this.branchesEmit = state.branchesEmit;
    this.selectedDestBranches = state.selectedDestBranches;
    this.fiscalYear = state.fiscalYear;
    this.data = state.data;
    this.loading = state.loading;
    this.error = state.error;
    this.searchTerm = state.searchTerm;
    this.setConditionForNecesar = state.setConditionForNecesar;
    this.setConditionForLimits = state.setConditionForLimits;
    this.selectedReplenishmentStrategy = state.selectedReplenishmentStrategy;
    this.transferFilter = state.transferFilter;
    this.destinationFilter = state.destinationFilter;
    this.abcFilter = state.abcFilter;
    this.blacklistedFilter = state.blacklistedFilter;
    this.lichidareFilter = state.lichidareFilter;
    this.isSuccessiveStrategy = state.isSuccessiveStrategy;
    this.queryPanelVisible = state.queryPanelVisible;
    
    console.log('📦 Container synced from store - branchesEmit:', this.branchesEmit, 'selectedDestBranches:', this.selectedDestBranches);
  }

  // --- Data Fetching and Actions ---
  async _handleLoadData() {
    replenishmentStore.setLoading(true);
    replenishmentStore.setError('');
    
    // Only reset search-related filters, not all filters
    replenishmentStore.resetSearchFilters();
    
    try {
      const currentState = replenishmentStore.getState();
      if (!currentState.branchesEmit) throw new Error('Please select a source branch');
      if (currentState.selectedDestBranches.length === 0) throw new Error('Please select at least one destination branch');

      const branchesDest = currentState.selectedDestBranches.join(',');
      const token = await new Promise((resolve, reject) => {
        connectToS1((token) => token ? resolve(token) : reject(new Error('Failed to get token')));
      });

      const response = await client.service('s1').getAnalyticsForBranchReplenishment({
        clientID: token,
        branchesEmit: currentState.branchesEmit,
        branchesDest: branchesDest,
        fiscalYear: currentState.fiscalYear,
        company: 1000, // Assuming company is fixed or add as property
        setConditionForNecesar: currentState.setConditionForNecesar,
        setConditionForLimits: currentState.setConditionForLimits
      });

      // Set data in store
      replenishmentStore.setData(response);

      // Hide query panel after successfully loading data
      replenishmentStore.setQueryPanelVisible(false);

      // Dispatch custom event to indicate data has been loaded
      this.dispatchEvent(new CustomEvent('data-loaded', {
        bubbles: true,
        composed: true,
        detail: { 
          dataCount: Array.isArray(response) ? response.length : 0,
          filtersReset: true
        }
      }));

    } catch (error) {
      console.error('Error loading branch replenishment data:', error);
      replenishmentStore.setError(`Error loading data: ${error.message}`);
      replenishmentStore.setData([]);
      
      // Dispatch event even on error since filters were still reset
      this.dispatchEvent(new CustomEvent('data-loaded', {
        bubbles: true,
        composed: true,
        detail: { 
          dataCount: 0,
          filtersReset: true,
          error: error.message
        }
      }));
    } finally {
      replenishmentStore.setLoading(false);
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
    // Get the data table component
    const dataTable = this.querySelector('replenishment-data-table');

    // Use the data table's fully filtered data which includes all header filters
    const exportData = (dataTable && typeof dataTable.getFilteredData === 'function')
      ? dataTable.getFilteredData().map(item => {
        const row = {};
        columnConfig.forEach(col => {
          // Include visible columns, format numbers, handle special cases
          if (col.visible) {
            let value = item[col.key];
            if (col.type === 'number') {
              value = parseFloat(value || 0);
            }
            row[col.displayName] = value;
          } else if (col.key === 'mtrl') { // Always include mtrl even if hidden
            row[col.displayName] = item[col.key];
          }
        });
        return row;
      })
      : this.filteredData.map(item => {
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
    const currentState = replenishmentStore.getState();
    
    if (!currentState.data.length || currentState.selectedReplenishmentStrategy === 'none') {
      console.warn('Strategy application skipped: No data or no strategy selected');
      return;
    }

    console.log(`🎯 Applying strategy: ${currentState.selectedReplenishmentStrategy}, Successive: ${currentState.isSuccessiveStrategy}`);
    
    const currentFilteredData = replenishmentStore.getFilteredData();
    const currentFilteredDataKeys = new Set(currentFilteredData.map(item => item.keyField));
    let dataUpdated = false;
    let applicableCount = 0;
    let skippedReasons = {
      notInFilter: 0,
      alreadyHasTransfer: 0,
      blacklisted: 0,
      noQuantityAvailable: 0,
      applied: 0
    };

    // Create a new array to ensure Lit detects the change
    const newData = currentState.data.map(item => {
      // Only apply strategy to items currently visible in the filtered view
      if (!currentFilteredDataKeys.has(item.keyField)) {
        skippedReasons.notInFilter++;
        return item;
      }

      let updatedItem = { ...item }; // Work on a copy
      let applyChange = false;

      // Determine if the strategy should be applied based on the successive flag
      if (currentState.isSuccessiveStrategy) {
        const currentTransfer = parseFloat(updatedItem.transfer || 0);
        if (currentTransfer === 0) {
          applyChange = true;
          applicableCount++;
        } else {
          skippedReasons.alreadyHasTransfer++;
        }
      } else {
        applyChange = true;
        applicableCount++;
      }

      if (applyChange) {
        const isBlacklisted = this.isItemBlacklisted(updatedItem);
        
        switch (currentState.selectedReplenishmentStrategy) {
          case 'min':
            if (!isBlacklisted) {
              const minQty = parseFloat(updatedItem.cant_min || 0);
              if (minQty > 0) {
                updatedItem.transfer = minQty;
                dataUpdated = true;
                skippedReasons.applied++;
                console.log(`✅ Applied min ${minQty} to item ${updatedItem.mtrl || 'unknown'} (Blacklisted: ${updatedItem.Blacklisted})`);
              } else {
                skippedReasons.noQuantityAvailable++;
                console.log(`⚠️  No min quantity available for item ${updatedItem.mtrl || 'unknown'}: cant_min=${updatedItem.cant_min}`);
              }
            } else {
              skippedReasons.blacklisted++;
              console.log(`🚫 Skipped blacklisted item ${updatedItem.mtrl || 'unknown'}: Blacklisted=${updatedItem.Blacklisted}`);
            }
            break;
          case 'max':
            if (!isBlacklisted) {
              const maxQty = parseFloat(updatedItem.cant_max || 0);
              if (maxQty > 0) {
                updatedItem.transfer = maxQty;
                dataUpdated = true;
                skippedReasons.applied++;
                console.log(`✅ Applied max ${maxQty} to item ${updatedItem.mtrl || 'unknown'} (Blacklisted: ${updatedItem.Blacklisted})`);
              } else {
                skippedReasons.noQuantityAvailable++;
                console.log(`⚠️  No max quantity available for item ${updatedItem.mtrl || 'unknown'}: cant_max=${updatedItem.cant_max}`);
              }
            } else {
              skippedReasons.blacklisted++;
              console.log(`🚫 Skipped blacklisted item ${updatedItem.mtrl || 'unknown'}: Blacklisted=${updatedItem.Blacklisted}`);
            }
            break;
          case 'skip_blacklisted':
            if (isBlacklisted) {
              if (!currentState.isSuccessiveStrategy) {
                // Clear transfers for blacklisted items when not in successive mode
                updatedItem.transfer = 0;
                dataUpdated = true;
                skippedReasons.applied++;
                console.log(`✅ Cleared transfer for blacklisted item ${updatedItem.mtrl || 'unknown'} (Blacklisted: ${updatedItem.Blacklisted})`);
              } else {
                // In successive mode, just skip blacklisted items
                skippedReasons.blacklisted++;
                console.log(`🚫 Skipped blacklisted item in successive mode ${updatedItem.mtrl || 'unknown'} (Blacklisted: ${updatedItem.Blacklisted})`);
              }
            } else {
              // For non-blacklisted items in skip_blacklisted strategy, apply min quantities
              const minQty = parseFloat(updatedItem.cant_min || 0);
              if (minQty > 0) {
                updatedItem.transfer = minQty;
                dataUpdated = true;
                skippedReasons.applied++;
                console.log(`✅ Applied min ${minQty} to non-blacklisted item ${updatedItem.mtrl || 'unknown'} (Blacklisted: ${updatedItem.Blacklisted})`);
              } else {
                skippedReasons.noQuantityAvailable++;
                console.log(`⚠️  No min quantity available for non-blacklisted item ${updatedItem.mtrl || 'unknown'}: cant_min=${updatedItem.cant_min}`);
              }
            }
            break;
          case 'clear':
            updatedItem.transfer = 0;
            dataUpdated = true;
            skippedReasons.applied++;
            console.log(`✅ Cleared transfer for item ${updatedItem.mtrl || 'unknown'}`);
            break;
        }
      }
      return updatedItem;
    });

    // Report results
    console.log(`📊 Strategy Application Results:`, {
      strategy: currentState.selectedReplenishmentStrategy,
      successive: currentState.isSuccessiveStrategy,
      totalItems: currentState.data.length,
      filteredItems: currentFilteredDataKeys.size,
      applicableItems: applicableCount,
      results: skippedReasons
    });

    if (dataUpdated) {
      replenishmentStore.setData(newData);
      console.log(`✅ Strategy applied successfully! Updated ${skippedReasons.applied} items.`);
    } else {
      console.warn(`⚠️  No items were updated. Check if items meet strategy criteria.`);
    }
    
    // Don't reset dropdown immediately, user might want to apply again with different successive setting
    // replenishmentStore.setReplenishmentStrategy('none');
  }

  _handleResetData() {
    // Reset all data and states through the store
    replenishmentStore.resetData();
    
    console.log('Data reset complete. Ready for new data selection.');
  }

  // --- Reset Methods ---
  _resetSearchFilters() {
    console.log('🔄 Resetting search filters only...');
    replenishmentStore.resetSearchFilters();
    console.log('✅ Search filters have been reset');
  }

  _resetFiltersAndStates() {
    console.log('🔄 Starting complete filter and state reset...');
    replenishmentStore.resetAllFilters();
    console.log('✅ All filters and states have been reset to defaults');
  }

  // --- Filtering Logic ---
  get filteredData() {
    // Always use store's filtered data
    return replenishmentStore.getFilteredData(columnConfig);
  }

  get uniqueDestinations() {
    return replenishmentStore.getUniqueDestinations();
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

  getBlacklistedClass = (item) => this.isItemBlacklisted(item) ? 'text-danger fw-bold' : '';
  getLichidareClass = (item) => this.isItemInLichidare(item) ? 'text-warning fw-bold' : '';

  // Helper function to determine if an item is blacklisted
  // Handles multiple formats: '-', 'Nu', 'No' = not blacklisted; 'Da', 'Yes' = blacklisted
  isItemBlacklisted = (item) => {
    const blacklisted = (item.Blacklisted || '').toString().toLowerCase();
    // Consider blacklisted if value is 'da' (yes in Romanian) or 'yes'
    return blacklisted === 'da' || blacklisted === 'yes';
  };
  
  // Helper function to determine if an item is in lichidare (liquidation)
  // Handles multiple formats: '-', 'Nu', 'No' = not in liquidation; 'Da', 'Yes' = in liquidation
  isItemInLichidare = (item) => {
    const inLichidare = (item.InLichidare || '').toString().toLowerCase();
    // Consider in liquidation if value is 'da' (yes in Romanian) or 'yes'
    return inLichidare === 'da' || inLichidare === 'yes';
  };

  // ABC Analysis utility functions
  getSalesPercClass = (value) => {
    const num = parseFloat(value);
    if (isNaN(num) || num === 0) return 'text-muted';
    if (num >= 10) return 'text-success fw-bold';
    if (num >= 5) return 'text-warning';
    return 'text-danger';
  }

  getAbcBadgeClass = (item) => {
    const abc = item.abc_class;
    if (!abc) return 'text-muted';
    switch (abc.toUpperCase()) {
      case 'A': return 'text-success fw-bold';
      case 'B': return 'text-primary fw-bold'; 
      case 'C': return 'text-warning fw-bold';
      default: return 'text-secondary';
    }
  }


  // --- Event Handlers for Child Component Updates ---
  // QueryPanel, ManipulationPanel, and DataTable now connect directly to store

  _handleManipulationUpdate(e) {
    const { property, value } = e.detail;
    
    // Update store instead of direct property assignment
    if (property === 'searchTerm') {
      replenishmentStore.setSearchTerm(value);
      console.log(`Manipulation update - Updated ${property}:`, value);
    } else if (property === 'transferFilter') {
      replenishmentStore.setTransferFilter(value);
      console.log(`Manipulation update - Updated ${property}:`, value);
    }

    // Dispatch a filter-changed event for child components to listen to
    this.dispatchEvent(new CustomEvent('filter-changed', {
      bubbles: true,
      composed: true,
      detail: { property, value, source: 'manipulation' }
    }));
  }

  _handleStrategyUpdate(e) {
    const { property, value } = e.detail;
    
    // Update store instead of direct property assignment
    if (property === 'selectedReplenishmentStrategy') {
      replenishmentStore.setReplenishmentStrategy(value);
      console.log(`Strategy update - Updated ${property}:`, value);
    } else if (property === 'isSuccessiveStrategy') {
      replenishmentStore.setSuccessiveStrategy(value);
      console.log(`Strategy update - Updated ${property}:`, value);
    }
  }

  // --- Lifecycle Callbacks ---
  connectedCallback() {
    super.connectedCallback();
  }

  firstUpdated() {
    console.log('Container firstUpdated - setting up event listeners');

    // Get references to the child panels
    const manipulationPanel = this.querySelector('manipulation-panel');
    const strategyPanel = this.querySelector('strategy-panel');
    // DataTable now connects directly to store, no need for event listener

    if (manipulationPanel) {
      console.log('Found manipulation panel, adding event listener');
      manipulationPanel.addEventListener('update-property', this._handleManipulationUpdate.bind(this));
    }

    if (strategyPanel) {
      console.log('Found strategy panel, adding event listener');
      strategyPanel.addEventListener('update-property', this._handleStrategyUpdate.bind(this));
    }
  }

  updated(changedProperties) {
    console.log('Container updated. searchTerm:', this.searchTerm, 'transferFilter:', this.transferFilter, 'selectedReplenishmentStrategy:', this.selectedReplenishmentStrategy);
    // Remove tooltip initialization for performance - using basic HTML title attributes
  }

  // --- Rendering ---
  render() {
    // Get filtered data from store
    const currentFilteredData = replenishmentStore.getFilteredData(columnConfig);
    const totalCount = this.data.length;
    const filteredCount = currentFilteredData.length;
    console.log('Render - filtered count:', filteredCount, 'total:', totalCount);

    return html`
      <div class="container-fluid mt-2">
        <!-- Development Notice Badge -->
        <div class="alert alert-info alert-dismissible fade show d-flex align-items-center" role="alert">
          <svg class="me-2" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
            <path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm.93-9.412-1 4.705c-.07.34.029.533.304.533.194 0 .487-.07.686-.246l-.088.416c-.287.346-.92.598-1.465.598-.703 0-1.002-.422-.808-1.319l.738-3.468c.064-.293.006-.399-.287-.47l-.451-.081.082-.381 2.29-.287zM8 5.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2z"/>
          </svg>
          <div class="flex-grow-1">
            <strong>🔧 Store Integration In Progress:</strong> Branch Replenishment is being migrated to use centralized state management with Lit Context. 
            Currently debugging final issues with number filters and sorting for optimal performance and consistency.
          </div>
          <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        </div>

        ${this.error ? html`<div class="alert alert-danger alert-dismissible fade show" role="alert">
                            ${this.error}
                            <button type="button" class="btn-close" @click=${() => this.error = ''} aria-label="Close"></button>
                          </div>` : ''}

        <!-- Query panel with animation for showing/hiding -->
        <div class="query-panel-container ${this.queryPanelVisible ? 'visible' : 'hidden'}">
          <query-panel
            .branches=${this.branches}
            @load-data=${this._handleLoadData}
            @save-data=${this._handleSaveData}
            @export-data=${this._handleExportData}
            @reset-data=${this._handleResetData}>
          </query-panel>
        </div>

        <!-- Layout with manipulation panel only - quick panel is floating -->
        <div class="row g-2 mb-3">
          <!-- Manipulation panel (search) taking full width -->
          <div class="col-12">
            <manipulation-panel
              .searchTerm=${this.searchTerm}
              .transferFilter=${this.transferFilter}
              .totalCount=${totalCount}
              .filteredCount=${filteredCount}
              @update-property=${this._handleManipulationUpdate}>
            </manipulation-panel>
          </div>
        </div>

        <!-- Floating quick panel - positioned with CSS -->
        <quick-panel
          .selectedReplenishmentStrategy=${this.selectedReplenishmentStrategy}
          .isSuccessiveStrategy=${this.isSuccessiveStrategy}
          .loading=${this.loading}
          .queryPanelVisible=${this.queryPanelVisible}
          ?disabled=${!this.data || this.data.length === 0}
          @toggle-query-panel=${this._handleToggleQueryPanel}
          @apply-strategy=${this._handleApplyStrategy}
          @update-property=${this._handleStrategyUpdate}>
        </quick-panel>

        <!-- DataTable with store integration - pass data as fallback -->
        <replenishment-data-table
          .tableData=${this.data}
          .columnConfig=${columnConfig}
          .utilityFunctions=${{
            getStockClassEmit: this.getStockClassEmit,
            getStockClassDest: this.getStockClassDest,
            getValueClass: this.getValueClass,
            getBlacklistedClass: this.getBlacklistedClass,
            getLichidareClass: this.getLichidareClass,
            getSalesPercClass: this.getSalesPercClass,
            getAbcBadgeClass: this.getAbcBadgeClass
          }}
          .loading=${this.loading}>
        </replenishment-data-table>
      </div>
    `;
  }

  // Handle toggle query panel event from quick panel
  _handleToggleQueryPanel() {
    const currentState = replenishmentStore.getState();
    console.log('Toggling query panel visibility. Current state:', currentState.queryPanelVisible);
    replenishmentStore.setQueryPanelVisible(!currentState.queryPanelVisible);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    // Clean up store subscription
    if (this._unsubscribeFromStore) {
      this._unsubscribeFromStore();
    }
  }
}

customElements.define('branch-replenishment-container', BranchReplenishmentContainer);
