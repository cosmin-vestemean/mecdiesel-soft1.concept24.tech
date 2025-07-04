import { LitElement, html } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';
import { ContextConsumer } from 'https://cdn.jsdelivr.net/npm/@lit/context@1.1.0/index.js';
import { columnConfig, sortConfig } from '../config/table-column-config.js'; // Import the column config and sort config
import { replenishmentStore, ReplenishmentStoreContext } from '../stores/replenishment-store.js';

export class ReplenishmentDataTable extends LitElement {
  static get properties() {
    return {
      columnConfig: { type: Array },
      utilityFunctions: { type: Object },
      loading: { type: Boolean },
      
      // Store-connected properties (these will be synced from store)
      destinationFilter: { type: String },
      abcFilter: { type: String },
      blacklistedFilter: { type: String },
      lichidareFilter: { type: String },
      sortColumn: { type: String },
      sortDirection: { type: String },
      uniqueDestinations: { type: Array },
      
      // Internal properties
      _storeState: { type: Object },
    };
  }

  // Track columnConfig changes for debugging
  updated(changedProperties) {
    if (changedProperties.has('columnConfig')) {
      console.log('📊 DataTable columnConfig updated:', {
        hasColumnConfig: !!this.columnConfig,
        isArray: Array.isArray(this.columnConfig),
        length: this.columnConfig ? this.columnConfig.length : 0,
        oldValue: changedProperties.get('columnConfig'),
        newValue: this.columnConfig
      });
      
      // If columnConfig just became available and we have store data, recalculate
      if (this.columnConfig && Array.isArray(this.columnConfig) && this.columnConfig.length > 0) {
        if (this._store && this._store.getState().data.length > 0) {
          console.log('📊 DataTable recalculating derived values after columnConfig became available');
          this._preCalculateDerivedValues();
        }
      }
    }
  }

  constructor() {
    super();
    
    // Initialize context consumer
    this._storeConsumer = new ContextConsumer(this, {
      context: ReplenishmentStoreContext,
      callback: (store) => {
        console.log('📊 DataTable received store from context:', store);
        this._store = store;
        this._subscribeToStore();
      }
    });
    
    // Initialize properties
    this.columnConfig = [];
    this.utilityFunctions = {};
    this.loading = false;
    this.destinationFilter = 'all';
    this.abcFilter = 'all';
    this.blacklistedFilter = 'all';
    this.lichidareFilter = 'all';
    this.sortColumn = null;
    this.sortDirection = 'asc';
    this.uniqueDestinations = [];
    this._storeState = {};
    
    // Performance optimization: Remove legacy caching as store handles it
    this._cachedDerivedValues = new Map();
  }

  // --- Store Integration ---
  _subscribeToStore() {
    if (!this._store) return;
    
    // Subscribe to store updates
    this._unsubscribeFromStore = this._store.subscribe((newState, previousState, action) => {
      console.log('📊 DataTable received store update:', action.type, newState);
      this._syncFromStore(newState);
    });
    
    // Initial sync
    this._syncFromStore(this._store.getState());
  }

  _syncFromStore(state) {
    // Sync filter states from store
    this.destinationFilter = state.destinationFilter;
    this.abcFilter = state.abcFilter;
    this.blacklistedFilter = state.blacklistedFilter;
    this.lichidareFilter = state.lichidareFilter;
    this.sortColumn = state.sortColumn;
    this.sortDirection = state.sortDirection;
    
    // Sync data and computed values - let render method get filtered data
    this.uniqueDestinations = this._store.getUniqueDestinations();
    
    // Store state for internal use
    this._storeState = state;
    
    // Pre-calculate derived values for performance before re-rendering
    // Only do this if we have valid columnConfig to avoid empty filter calls
    if (this.columnConfig && Array.isArray(this.columnConfig) && this.columnConfig.length > 0) {
      this._preCalculateDerivedValues();
    }
    
    // Trigger re-render to show updated data
    this.requestUpdate();
    
    // Only log filtered data count if we have valid columnConfig
    if (this.columnConfig && Array.isArray(this.columnConfig) && this.columnConfig.length > 0) {
      const validColumnConfig = this.columnConfig && Array.isArray(this.columnConfig) ? this.columnConfig : [];
      console.log('📊 DataTable synced from store. Data items:', state.data.length, 'Filtered items:', this._store.getFilteredData(validColumnConfig).length);
      console.log('📊 DataTable sync - columnConfig check:', {
        hasColumnConfig: !!this.columnConfig,
        isArray: Array.isArray(this.columnConfig),
        length: this.columnConfig ? this.columnConfig.length : 0,
        fallbackUsed: !this.columnConfig || !Array.isArray(this.columnConfig)
      });
    } else {
      console.log('📊 DataTable synced from store. Data items:', state.data.length, 'Filtered items: Not calculated (no columnConfig)');
      console.log('📊 DataTable sync - columnConfig check:', {
        hasColumnConfig: !!this.columnConfig,
        isArray: Array.isArray(this.columnConfig),
        length: this.columnConfig ? this.columnConfig.length : 0,
        fallbackUsed: true,
        reason: 'columnConfig not available or invalid'
      });
    }
  }

  createRenderRoot() {
    // Disable shadow DOM to allow external styles to apply
    return this;
  }

  _dispatchUpdate(property, value, itemKey = undefined, transferValue = undefined) {
    // Use store directly instead of dispatching events
    if (!this._store) return;
    
    console.log('📊 DataTable updating store:', property, value);
    
    switch (property) {
      case 'destinationFilter':
        this._store.setDestinationFilter(value);
        break;
      case 'abcFilter':
        this._store.setAbcFilter(value);
        break;
      case 'blacklistedFilter':
        this._store.setBlacklistedFilter(value);
        break;
      case 'lichidareFilter':
        this._store.setLichidareFilter(value);
        break;
      case 'sort':
        this._store.setSorting(value.column, value.direction);
        break;
      case 'itemTransfer':
        if (itemKey !== undefined) {
          this._store.updateItemTransfer(itemKey, transferValue);
        }
        break;
      default:
        if (property.startsWith('numberFilter_')) {
          const columnKey = property.replace('numberFilter_', '');
          this._store.setNumberFilter(columnKey, value);
        }
        break;
    }
  }

  // --- Keyboard Navigation ---
  handleKeyNav(e) {
    const inputElement = e.target;
    const currentKey = inputElement.dataset.keyfield;
    const currentColKey = inputElement.dataset.colkey;

    if (!currentKey || !currentColKey) return;

    let nextKey = currentKey;
    let nextColKey = currentColKey;
    let moved = false;

    // Use store's filtered data for navigation
    const validColumnConfig = this.columnConfig && Array.isArray(this.columnConfig) ? this.columnConfig : [];
    const filteredData = this._store ? this._store.getFilteredData(validColumnConfig) : [];
    const visibleDataKeys = filteredData.map(item => item.keyField);
    const currentItemIndex = visibleDataKeys.indexOf(currentKey);

    switch (e.key) {
      case 'ArrowUp':
        if (currentItemIndex > 0) {
          nextKey = visibleDataKeys[currentItemIndex - 1];
          moved = true;
        }
        break;
      case 'ArrowDown':
      case 'Enter': // Treat Enter like ArrowDown
        if (currentItemIndex < visibleDataKeys.length - 1) {
          nextKey = visibleDataKeys[currentItemIndex + 1];
          moved = true;
        }
        break;
      case 'Tab':
        // Basic tab moves down, could be enhanced to move right if needed
        if (!e.shiftKey && currentItemIndex < visibleDataKeys.length - 1) {
             nextKey = visibleDataKeys[currentItemIndex + 1];
             moved = true;
        } else if (e.shiftKey && currentItemIndex > 0) {
             nextKey = visibleDataKeys[currentItemIndex - 1];
             moved = true;
        } else {
            return; // Allow default tab behavior if at start/end
        }
        break;
       case 'Escape':
           inputElement.blur();
           return; // Don't prevent default for Escape
      default:
        return; // Ignore other keys
    }

    if (moved) {
        e.preventDefault(); // Prevent default scrolling/tabbing
        const nextInput = this.querySelector(`input[data-keyfield="${nextKey}"][data-colkey="${nextColKey}"]`);
        if (nextInput) {
            nextInput.focus();
            nextInput.select();
        }
    }
  }

  // --- Sorting Logic ---
  handleSort(column) {
    if (!column.isSortable) return;
    
    // Micro-optimization: Immediate visual feedback for perceived performance
    const headerElement = document.querySelector(`th[data-column="${column.key}"]`);
    if (headerElement) {
      headerElement.style.transform = 'scale(0.98)';
      setTimeout(() => {
        headerElement.style.transform = '';
      }, 100);
    }
    
    const validColumnConfig = this.columnConfig && Array.isArray(this.columnConfig) ? this.columnConfig : [];
    const data = this._store ? this._store.getFilteredData(validColumnConfig) : [];
    // Performance check: warn about client-side sorting on large datasets
    if (data && data.length > sortConfig.clientSortThreshold) {
      console.warn(`Dataset size (${data.length}) exceeds client-side sorting threshold (${sortConfig.clientSortThreshold}). Consider implementing server-side sorting for better performance.`);
    }
    
    let newDirection = 'asc';
    if (this.sortColumn === column.key) {
      // Toggle direction if same column
      newDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      // New column, use default sort order for this data type
      newDirection = sortConfig.defaultSortOrder[column.type] || 'asc';
    }
    
    // Update store with new sort settings
    this._dispatchUpdate('sort', {
      column: column.key,
      direction: newDirection,
      dataType: column.type
    });
  }

  parseBooleanValue(value) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value > 0;
    if (typeof value === 'string') {
      const lowercaseValue = value.toLowerCase();
      return lowercaseValue === 'true' || 
             lowercaseValue === 'da' || 
             lowercaseValue === 'yes' || 
             lowercaseValue === '1';
    }
    return false;
  }

  renderSortIcon(column) {
    if (!column.isSortable) return '';
    
    const isCurrentSort = this.sortColumn === column.key;
    let iconClass, iconColor, opacity, title;
    
    if (isCurrentSort) {
      if (this.sortDirection === 'asc') {
        iconClass = 'fa-sort-up';
        iconColor = '#198754'; // Green for ascending
        title = 'Sorted ascending (click for descending)';
      } else {
        iconClass = 'fa-sort-down';
        iconColor = '#dc3545'; // Red for descending
        title = 'Sorted descending (click for ascending)';
      }
      opacity = '1';
    } else {
      iconClass = 'fa-sort';
      iconColor = '#6c757d'; // Gray for unsorted
      opacity = '0.5';
      title = 'Click to sort';
    }
    
    return html`
      <i class="fas ${iconClass} sort-icon ms-1 ${isCurrentSort ? 'active' : ''}" 
         style="opacity: ${opacity}; font-size: 0.8em; color: ${iconColor}; transition: all 0.15s ease-in-out;"
         title="${title}"></i>
    `;
  }

  // --- Rendering Logic ---
  renderHeader() {
    // Safety check to prevent undefined errors
    if (!this.columnConfig || !Array.isArray(this.columnConfig)) {
      console.warn('Column config is undefined or not an array');
      return html`<tr><th>No column configuration available</th></tr>`;
    }
    
    const visibleColumns = this.columnConfig.filter(col => col.visible);
    return html`
      <tr>
        ${visibleColumns.map(col => {
          const isCurrentSort = this.sortColumn === col.key;
          const sortClass = col.isSortable ? 'sortable-header' : '';
          const activeClass = isCurrentSort ? 'sorted' : '';
          const combinedClass = `${col.group || ''} ${col.divider ? 'vertical-divider' : ''} ${sortClass} ${activeClass}`.trim();
          
          return html`
            <th class="${combinedClass}"
                title="${col.tooltip || col.displayName}${col.isSortable ? ' (Click to sort)' : ''}"
                @click=${col.isSortable ? () => this.handleSort(col) : null}
                style="${col.isSortable ? 'cursor: pointer; user-select: none;' : ''}">
              ${col.isHeaderFilter 
                ? this.renderHeaderFilter(col)
                : html`
                  <div class="d-flex align-items-center justify-content-center">
                    <span>${col.displayName}</span>
                    ${this.renderSortIcon(col)}
                  </div>
                `}
            </th>
          `;
        })}
      </tr>
    `;
  }

  renderHeaderFilter(column) {
    if (column.type === 'number') {
      return this.renderNumberFilterHeader(column);
    } else if (column.key === 'abc_class') {
      return this.renderAbcFilterHeader(column);
    } else if (column.key === 'Blacklisted') {
      return this.renderBooleanFilterHeader(column, 'blacklistedFilter');
    } else if (column.key === 'InLichidare') {
      return this.renderBooleanFilterHeader(column, 'lichidareFilter');
    } else {
      return this.renderDestinationFilterHeader(column);
    }
  }

  renderAbcFilterHeader(column) {
    const isCurrentSort = this.sortColumn === column.key;
    return html`
      <div class="d-flex flex-column align-items-center ${isCurrentSort ? 'text-primary' : ''}"
           @click=${column.isSortable ? (e) => { e.stopPropagation(); this.handleSort(column); } : null}
           style="${column.isSortable ? 'cursor: pointer;' : ''}">
        <div class="d-flex align-items-center small">
          <span>${column.displayName}</span>
          ${column.isSortable ? this.renderSortIcon(column) : ''}
        </div>
        <select class="form-select form-select-sm border-0 bg-transparent p-1 header-filter-select"
                title="Filter by ${column.displayName}"
                .value=${this.abcFilter}
                @change=${e => this._dispatchUpdate('abcFilter', e.target.value)}
                @click=${e => e.stopPropagation()}>
            <option value="all">All</option>
            <option value="abc">ABC</option>
            <option value="A">A</option>
            <option value="B">B</option>
            <option value="C">C</option>
            <option value="none">None</option>
        </select>
      </div>
    `;
  }

  renderBooleanFilterHeader(column, filterProperty) {
    const isCurrentSort = this.sortColumn === column.key;
    return html`
      <div class="d-flex flex-column align-items-center ${isCurrentSort ? 'text-primary' : ''}"
           @click=${column.isSortable ? (e) => { e.stopPropagation(); this.handleSort(column); } : null}
           style="${column.isSortable ? 'cursor: pointer;' : ''}">
        <div class="d-flex align-items-center small">
          <span>${column.displayName}</span>
          ${column.isSortable ? this.renderSortIcon(column) : ''}
        </div>
        <select class="form-select form-select-sm border-0 bg-transparent p-1 header-filter-select"
                title="Filter by ${column.displayName}"
                .value=${this[filterProperty]}
                @change=${e => this._dispatchUpdate(filterProperty, e.target.value)}
                @click=${e => e.stopPropagation()}>
            <option value="all">All</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
        </select>
      </div>
    `;
  }

  renderNumberFilterHeader(column) {
    // Each number column will have a filter: all, positive, negative, zero
    const isCurrentSort = this.sortColumn === column.key;
    return html`
      <div class="d-flex flex-column align-items-center ${isCurrentSort ? 'text-primary' : ''}"
           @click=${column.isSortable ? (e) => { e.stopPropagation(); this.handleSort(column); } : null}
           style="${column.isSortable ? 'cursor: pointer;' : ''}">
        <div class="d-flex align-items-center small">
          <span>${column.displayName}</span>
          ${column.isSortable ? this.renderSortIcon(column) : ''}
        </div>
        <div class="btn-group btn-group-sm number-filter-group">
          <button class="btn btn-outline-secondary btn-xs ${this.getNumberFilterStatus(column.key, 'all')}" 
                  @click=${(e) => { e.stopPropagation(); this._dispatchUpdate(`numberFilter_${column.key}`, 'all'); }}
                  title="Show all values">
            <i class="bi bi-asterisk"></i>
          </button>
          <button class="btn btn-outline-success btn-xs ${this.getNumberFilterStatus(column.key, 'positive')}" 
                  @click=${(e) => { e.stopPropagation(); this._dispatchUpdate(`numberFilter_${column.key}`, 'positive'); }}
                  title="Show positive values only">
            <i class="bi bi-plus"></i>
          </button>
          <button class="btn btn-outline-danger btn-xs ${this.getNumberFilterStatus(column.key, 'negative')}" 
                  @click=${(e) => { e.stopPropagation(); this._dispatchUpdate(`numberFilter_${column.key}`, 'negative'); }}
                  title="Show negative values only">
            <i class="bi bi-dash"></i>
          </button>
          <button class="btn btn-outline-secondary btn-xs ${this.getNumberFilterStatus(column.key, 'zero')}" 
                  @click=${(e) => { e.stopPropagation(); this._dispatchUpdate(`numberFilter_${column.key}`, 'zero'); }}
                  title="Show zero values only">
            <i class="bi bi-0-circle"></i>
          </button>
        </div>
      </div>
    `;
  }

  getNumberFilterStatus(columnKey, filterValue) {
    // Helper to highlight the active filter button
    const activeFilter = this._storeState.numberFilters?.[columnKey] || 'all';
    return activeFilter === filterValue ? 'active' : '';
  }

  renderDestinationFilterHeader(column) {
     return html`
      <div class="d-flex flex-column align-items-center"
           @click=${column.isSortable ? (e) => { e.stopPropagation(); this.handleSort(column); } : null}>
        <div class="d-flex align-items-center small">
          <span>${column.displayName}</span>
          ${column.isSortable ? this.renderSortIcon(column) : ''}
        </div>
        <select class="form-select form-select-sm border-0 bg-transparent p-1 header-filter-select"
                title="Filter by ${column.displayName}"
                .value=${this.destinationFilter}
                @change=${e => this._dispatchUpdate('destinationFilter', e.target.value)}
                @click=${e => e.stopPropagation()}>
            <option value="all">All ${column.displayName}s</option>
            ${(this.uniqueDestinations || []).map(dest => html`<option value="${dest}">${dest}</option>`)}
        </select>
      </div>
     `;
  }

  renderRow(item, index) {
    const visibleColumns = this.columnConfig.filter(col => col.visible);
    return html`
      <tr class="${index % 2 === 0 ? 'even-row' : 'odd-row'}">
        ${visibleColumns.map(col => this.renderCell(item, col, index))}
      </tr>
    `;
  }

  renderCell(item, column, index) {
    let content = '';
    const value = item[column.key];
    const keyField = item.keyField;
    
    // Get cached derived values for performance
    const cachedValues = this._cachedDerivedValues.get(keyField) || {};
    
    // Ensure group class is first in the list and has !important
    const cellClassList = [];
    if (column.group) {
      cellClassList.push(`group-${column.group}`);
    }
    if (column.divider) {
      cellClassList.push('vertical-divider');
    }

    // Apply dynamic class functions using cached values when possible
    if (column.classFn && cachedValues[column.classFn]) {
      cellClassList.push(cachedValues[column.classFn]);
    } else if (column.classFn && typeof this.utilityFunctions[column.classFn] === 'function') {
      cellClassList.push(this.utilityFunctions[column.classFn](item));
    } else if (column.classFn === 'getValueClass' && cachedValues.valueClass) {
      cellClassList.push(cachedValues.valueClass);
    } else if (column.classFn === 'getValueClass' && typeof this.utilityFunctions.getValueClass === 'function') {
      cellClassList.push(this.utilityFunctions.getValueClass(value));
    }

    if (column.type === 'index') {
      content = html`${index + 1}`;
    } else if (column.key === 'abc_class' && value) {
      // Special rendering for ABC classification - use cached class when possible
      const textClass = cachedValues.abcBadgeClass || 
        (this.utilityFunctions.getAbcBadgeClass ? this.utilityFunctions.getAbcBadgeClass(item) : 'text-secondary');
      cellClassList.push(textClass);
      content = html`${value}`;
    } else if (column.isEditable && column.key === 'transfer') {
      // Use cached value class for transfer inputs
      const valueClass = cachedValues.valueClass || 
        (this.utilityFunctions.getValueClass ? this.utilityFunctions.getValueClass(value) : '');
      content = html`
        <input
          class="form-control form-control-sm compact-input ${valueClass}"
          data-keyfield="${item.keyField}"
          data-colkey="${column.key}"
          type="number"
          min="0"
          step="1"
          .value="${value || 0}"
          @change="${(e) => this._dispatchUpdate('itemTransfer', null, item.keyField, e.target.value)}"
          @keydown="${this.handleKeyNav}"
          ?disabled=${this.loading}
        />
      `;
    } else if (column.type === 'boolean') {
      // Unified display for boolean fields
      // Convert Da/Yes to 'Yes', and Nu/No/- to 'No' with muted style
      const displayValue = value && (value.toString().toLowerCase() === 'da' || value.toString().toLowerCase() === 'yes') 
        ? 'Yes' 
        : html`<span class="text-muted">No</span>`;
      content = html`${displayValue}`;
    } else {
      content = html`${value}`;
    }

    return html`
      <td class="${cellClassList.join(' ')}">
        ${content}
      </td>
    `;
  }

  /**
   * Pre-calculate derived values for performance optimization
   */
  _preCalculateDerivedValues() {
    this._cachedDerivedValues.clear();
    
    const validColumnConfig = this.columnConfig && Array.isArray(this.columnConfig) ? this.columnConfig : [];
    const data = this._store ? this._store.getFilteredData(validColumnConfig) : [];
    console.log('📊 DataTable _preCalculateDerivedValues - columnConfig check:', {
      hasColumnConfig: !!this.columnConfig,
      isArray: Array.isArray(this.columnConfig),
      length: this.columnConfig ? this.columnConfig.length : 0,
      fallbackUsed: !this.columnConfig || !Array.isArray(this.columnConfig)
    });
    if (!data || !this.utilityFunctions) return;
    
    data.forEach(item => {
      const keyField = item.keyField;
      const derivedValues = {};
      
      // Pre-calculate CSS classes for common utility functions
      if (this.utilityFunctions.getValueClass) {
        derivedValues.valueClass = this.utilityFunctions.getValueClass(item.transfer || 0);
      }
      if (this.utilityFunctions.getAbcBadgeClass) {
        derivedValues.abcBadgeClass = this.utilityFunctions.getAbcBadgeClass(item);
      }
      if (this.utilityFunctions.getStockClassEmit) {
        derivedValues.stockClassEmit = this.utilityFunctions.getStockClassEmit(item);
      }
      if (this.utilityFunctions.getStockClassDest) {
        derivedValues.stockClassDest = this.utilityFunctions.getStockClassDest(item);
      }
      if (this.utilityFunctions.getBlacklistedClass) {
        derivedValues.blacklistedClass = this.utilityFunctions.getBlacklistedClass(item);
      }
      if (this.utilityFunctions.getLichidareClass) {
        derivedValues.lichidareClass = this.utilityFunctions.getLichidareClass(item);
      }
      if (this.utilityFunctions.getSalesPercClass) {
        derivedValues.salesPercClass = this.utilityFunctions.getSalesPercClass(item);
      }
      
      this._cachedDerivedValues.set(keyField, derivedValues);
    });
  }

  // --- Legacy method for backward compatibility ---
  getFilteredData() {
    // Use store's filtered data if available
    if (this._store) {
      const validColumnConfig = this.columnConfig && Array.isArray(this.columnConfig) ? this.columnConfig : [];
      return this._store.getFilteredData(validColumnConfig);
    }
    // Fallback to provided tableData
    return []; // Return empty array if store is not available
  }

  /**
   * Public method to trigger sorting from outside the component
   * @param {String} columnKey - The column key to sort by
   * @param {String} direction - The sort direction ('asc' or 'desc')
   */
  triggerSort(columnKey, direction) {
    if (this._store) {
      this._store.setSorting(columnKey, direction);
    }
  }

  /**
   * Get the current sort status for a column (asc/desc/none)
   * @param {String} columnKey - The column key to check
   * @returns {String} - The sort status ('asc', 'desc', or '')
   */
  getSortStatus(columnKey) {
    if (this.sortColumn !== columnKey) return '';
    return this.sortDirection === 'asc' ? 'desc' : 'asc';
  }

  render() {
    // Safety checks for all required properties
    if (!this.columnConfig || !Array.isArray(this.columnConfig)) {
      console.warn('Column config is undefined or not an array');
      return html`
        <div class="alert alert-warning">
          Configuration error: Column configuration is missing or invalid
        </div>
      `;
    }

    // Get filtered and sorted data from store
    // Ensure we always pass a valid columnConfig to prevent filtering issues
    const validColumnConfig = this.columnConfig && Array.isArray(this.columnConfig) ? this.columnConfig : [];
    const displayData = this._store ? this._store.getFilteredData(validColumnConfig) : [];
    
    console.log('📊 DataTable render - Store available:', !!this._store, 'DisplayData length:', displayData.length);
    console.log('📊 DataTable columnConfig check:', {
      hasColumnConfig: !!this.columnConfig,
      columnConfigLength: this.columnConfig ? this.columnConfig.length : 0,
      numberFilterColumns: this.columnConfig ? this.columnConfig.filter(col => col.type === 'number' && col.isHeaderFilter && col.visible).length : 0,
      validColumnConfigLength: validColumnConfig.length
    });

    return html`
      <div class="table-responsive data-table-container">
        ${this.loading ? html`<div class="table-overlay"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div></div>` : ''}
        <table class="table table-sm table-hover table-bordered modern-table compact-table">
          <thead class="sticky-top bg-light small">
            ${this.renderHeader()}
          </thead>
          <tbody class="small">
            ${displayData && displayData.length > 0
              ? displayData.map((item, index) => this.renderRow(item, index))
              : html`<tr><td colspan="${(this.columnConfig && Array.isArray(this.columnConfig)) ? this.columnConfig.filter(c => c.visible).length : 1}" class="text-center text-muted p-2">No data available for the current selection and filters.</td></tr>`
            }
          </tbody>
        </table>
      </div>
    `;
  }

  updated(changedProperties) {
    super.updated(changedProperties);
    
    // Pre-calculation is now triggered by store updates via _syncFromStore
    if (changedProperties.has('utilityFunctions')) {
      this._preCalculateDerivedValues();
    }
  }

  connectedCallback() {
    super.connectedCallback();
    
    // Store connection is handled by ContextConsumer
    console.log('📊 DataTable connected to DOM. Store available:', !!this._store);
    
    // If store is not available yet, try to get it manually
    if (!this._store) {
      console.log('📊 Store not available in connectedCallback, checking for manual assignment...');
      // Fallback: try to import and use the store directly
      import('../stores/replenishment-store.js').then(({ replenishmentStore }) => {
        console.log('📊 Manual store assignment:', replenishmentStore);
        this._store = replenishmentStore;
        this._subscribeToStore();
      });
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    
    // Clean up store subscription
    if (this._unsubscribeFromStore) {
      this._unsubscribeFromStore();
    }
  }
}
customElements.define('replenishment-data-table', ReplenishmentDataTable);
