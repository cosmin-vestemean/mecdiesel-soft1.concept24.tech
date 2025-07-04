import { LitElement, html } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';
import { ContextConsumer } from 'https://cdn.jsdelivr.net/npm/@lit/context@1.1.0/index.js';
import { ReplenishmentStoreContext } from '../stores/replenishment-store.js';

export class ManipulationPanel extends LitElement {
  static get properties() {
    return {
      // Store-driven properties
      searchTerm: { type: String },
      transferFilter: { type: String },
      destinationFilter: { type: String },
      abcFilter: { type: String },
      blacklistedFilter: { type: String },
      lichidareFilter: { type: String },
      numberFilters: { type: Object },
      sortColumn: { type: String },
      sortDirection: { type: String },
      totalCount: { type: Number },
      filteredCount: { type: Number },
    };
  }

  constructor() {
    super();
    
    // Initialize properties (will be updated by store)
    this.searchTerm = '';
    this.transferFilter = 'all';
    this.destinationFilter = 'all';
    this.abcFilter = 'all';
    this.blacklistedFilter = 'all';
    this.lichidareFilter = 'all';
    this.numberFilters = {};
    this.sortColumn = null;
    this.sortDirection = 'asc';
    this.totalCount = 0;
    this.filteredCount = 0;
    
    // Set up store context consumer
    this._storeConsumer = new ContextConsumer(this, {
      context: ReplenishmentStoreContext,
      callback: (store) => {
        this._store = store;
        this._subscribeToStore();
      }
    });
  }

  _subscribeToStore() {
    if (this._store && !this._unsubscribeFromStore) {
      this._unsubscribeFromStore = this._store.subscribe((newState, previousState, action) => {
        console.log('🔍 ManipulationPanel received store update:', action.type);
        this._syncStateFromStore(newState);
      });
      
      // Initial sync
      this._syncStateFromStore(this._store.getState());
    }
  }

  _syncStateFromStore(state) {
    this.searchTerm = state.searchTerm;
    this.transferFilter = state.transferFilter;
    this.destinationFilter = state.destinationFilter;
    this.abcFilter = state.abcFilter;
    this.blacklistedFilter = state.blacklistedFilter;
    this.lichidareFilter = state.lichidareFilter;
    this.numberFilters = state.numberFilters;
    this.sortColumn = state.sortColumn;
    this.sortDirection = state.sortDirection;
    this.totalCount = state.data.length;
    this.filteredCount = this._store.getFilteredData().length;
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    // Clean up store subscription
    if (this._unsubscribeFromStore) {
      this._unsubscribeFromStore();
    }
  }

  createRenderRoot() { return this; } // Render in light DOM

  _dispatchUpdate(property, value) {
    console.log(`ManipulationPanel updating ${property}:`, value);
    
    // Update store directly instead of emitting events
    if (this._store) {
      if (property === 'searchTerm') {
        this._store.setSearchTerm(value);
      } else if (property === 'transferFilter') {
        this._store.setTransferFilter(value);
      }
    } else {
      console.warn('Store not available yet for ManipulationPanel');
    }
  }

  _resetAllFilters() {
    if (this._store) {
      this._store.resetAllFilters();
    }
  }

  _exportData() {
    // Emit export-data event that will be handled by the container
    this.dispatchEvent(new CustomEvent('export-data', { 
      bubbles: true, 
      composed: true 
    }));
  }

  _getActiveFilters() {
    const filters = [];
    
    // Search term
    if (this.searchTerm) {
      filters.push({
        type: 'search',
        label: 'Search',
        value: `"${this.searchTerm}"`,
        icon: 'fas fa-search'
      });
    }
    
    // Transfer filter
    if (this.transferFilter !== 'all') {
      filters.push({
        type: 'transfer',
        label: 'Transfer',
        value: this.transferFilter === 'positive' ? 'Has Transfer' : 'No Transfer',
        icon: 'fas fa-exchange-alt'
      });
    }
    
    // Destination filter
    if (this.destinationFilter !== 'all') {
      filters.push({
        type: 'destination',
        label: 'Destination',
        value: this.destinationFilter,
        icon: 'fas fa-map-marker-alt'
      });
    }
    
    // ABC filter
    if (this.abcFilter !== 'all') {
      const abcValue = this.abcFilter === 'abc' ? 'A/B/C Classes' : 
                      this.abcFilter === 'none' ? 'No Classification' : 
                      `Class ${this.abcFilter}`;
      filters.push({
        type: 'abc',
        label: 'ABC',
        value: abcValue,
        icon: 'fas fa-layer-group'
      });
    }
    
    // Blacklisted filter
    if (this.blacklistedFilter !== 'all') {
      filters.push({
        type: 'blacklisted',
        label: 'Blacklisted',
        value: this.blacklistedFilter === 'yes' ? 'Yes' : this.blacklistedFilter === 'no' ? 'No' : 'None',
        icon: 'fas fa-ban'
      });
    }
    
    // Lichidare filter
    if (this.lichidareFilter !== 'all') {
      filters.push({
        type: 'lichidare',
        label: 'In Lichidare',
        value: this.lichidareFilter === 'yes' ? 'Yes' : this.lichidareFilter === 'no' ? 'No' : 'None',
        icon: 'fas fa-exclamation-triangle'
      });
    }
    
    // Number filters
    if (this.numberFilters && Object.keys(this.numberFilters).length > 0) {
      Object.entries(this.numberFilters).forEach(([key, value]) => {
        if (value !== 'all') {
          const displayValue = value === 'positive' ? '> 0' : 
                             value === 'negative' ? '< 0' : 
                             value === 'zero' ? '= 0' : value;
          // Make column name more readable
          const columnName = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
          filters.push({
            type: 'number',
            label: columnName,
            value: displayValue,
            icon: 'fas fa-hashtag'
          });
        }
      });
    }
    
    return filters;
  }

  _getSortInfo() {
    if (!this.sortColumn) return null;
    
    return {
      column: this.sortColumn.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      direction: this.sortDirection,
      icon: this.sortDirection === 'asc' ? 'fas fa-arrow-up' : 'fas fa-arrow-down'
    };
  }

  _hasActiveFiltersOrSort() {
    return this._getActiveFilters().length > 0 || this._getSortInfo() !== null;
  }

  render() {
    const activeFilters = this._getActiveFilters();
    const sortInfo = this._getSortInfo();
    const hasActiveFiltersOrSort = this._hasActiveFiltersOrSort();

    return html`
      <div class="manipulation-panel">
        <!-- Main Controls Row -->
        <div class="d-flex justify-content-between align-items-center mb-3">
          <div class="d-flex gap-2 flex-grow-1">
            <div class="input-group input-group-sm search-input-group">
              <span class="input-group-text bg-white"><i class="fas fa-search"></i></span>
              <input type="text" class="form-control" placeholder="Search code/description..."
                     .value=${this.searchTerm || ''}
                     @input=${e => this._dispatchUpdate('searchTerm', e.target.value)}>
              ${this.searchTerm ? html`
                <button class="btn btn-outline-secondary btn-clear-search" @click=${() => this._dispatchUpdate('searchTerm', '')} title="Clear search">
                  <i class="fas fa-times"></i>
                </button>` : ''}
            </div>
            
            <!-- Reset Button and Export Button -->
            ${hasActiveFiltersOrSort ? html`
              <button class="btn btn-outline-danger btn-sm" @click=${this._resetAllFilters} title="Reset all filters and sorting">
                <i class="fas fa-undo"></i> Reset Filters
              </button>
            ` : ''}
            
            <!-- Export Button -->
            <button class="btn btn-outline-success btn-sm" @click=${this._exportData} title="Export filtered data to Excel">
              <i class="bi bi-file-excel me-1"></i> Export
            </button>
          </div>
          
          <div class="text-muted small item-count-display ms-3">
            ${this.filteredCount === this.totalCount
              ? html`Showing all <span class="fw-bold">${this.totalCount}</span>`
              : html`Showing <span class="fw-bold">${this.filteredCount}</span> of ${this.totalCount}`
            } items
          </div>
        </div>

        <!-- Active Filters and Sort Info -->
        ${hasActiveFiltersOrSort ? html`
          <div class="active-filters-info">
            <div class="d-flex flex-wrap align-items-center">
              <span class="text-muted small fw-bold me-2">Active:</span>
              
              <!-- Active Filters -->
              ${activeFilters.map(filter => html`
                <span class="badge text-bg-primary d-flex align-items-center me-1 mb-1">
                  <i class="${filter.icon}"></i>
                  <span class="text-bg-primary">${filter.label}: ${filter.value}</span>
                </span>
              `)}
              
              <!-- Sort Info -->
              ${sortInfo ? html`
                <span class="badge text-bg-info d-flex align-items-center me-1 mb-1">
                  <i class="${sortInfo.icon}"></i>
                  <span class="text-bg-info">Sort: ${sortInfo.column}</span>
                </span>
              ` : ''}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }
}
customElements.define('manipulation-panel', ManipulationPanel);
