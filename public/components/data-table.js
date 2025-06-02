import { LitElement, html } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';
import { columnConfig } from '../config/table-column-config.js'; // Import the column config

export class ReplenishmentDataTable extends LitElement {
  static get properties() {
    return {
      tableData: { type: Array },
      columnConfig: { type: Array },
      destinationFilter: { type: String },
      uniqueDestinations: { type: Array },
      uniqueAbcValues: { type: Array },
      abcFilter: { type: String },
      blacklistedFilter: { type: String },
      lichidareFilter: { type: String },
      utilityFunctions: { type: Object }, // Pass utility functions { getStockClass, getValueClass, etc. }
      loading: { type: Boolean },
      // Dynamic properties for number filters - safely create with imported columnConfig
      ...Object.fromEntries(
        (columnConfig || [])
          .filter(col => col.type === 'number' && col.isHeaderFilter)
          .map(col => [`numberFilter_${col.key}`, { type: String, state: true }])
      )
    };
  }

  constructor() {
      super();
      this.tableData = [];
      this.columnConfig = [];
      this.utilityFunctions = {};
      this.destinationFilter = 'all';
      this.abcFilter = 'all';
      this.blacklistedFilter = 'all';
      this.lichidareFilter = 'all';
      
      // Performance optimization: Cache filtered data and derived values
      this._cachedFilteredData = [];
      this._cachedFilters = {};
      this._cachedDerivedValues = new Map(); // For CSS classes and styles
      this._cachedVisibleDataKeys = null; // Cache for keyboard navigation
      
      // Initialize all number filters to 'all'
      if (Array.isArray(columnConfig)) {
        columnConfig
          .filter(col => col.type === 'number' && col.isHeaderFilter)
          .forEach(col => {
            this[`numberFilter_${col.key}`] = 'all';
          });
      }
  }

  createRenderRoot() {
    // Disable shadow DOM to allow external styles to apply
    return this;
  }

  _dispatchUpdate(property, value, itemKey = undefined, transferValue = undefined) {
      const detail = { property, value };
      if (itemKey !== undefined) detail.itemKey = itemKey;
      if (transferValue !== undefined) detail.transferValue = transferValue;
      this.dispatchEvent(new CustomEvent('update-property', {
          detail, bubbles: true, composed: true
      }));
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

    // Use cached visible data keys for performance
    // Cache should reflect filtered data, not all table data
    if (!this._cachedVisibleDataKeys) {
      const filteredData = this.getFilteredData();
      this._cachedVisibleDataKeys = filteredData.map(item => item.keyField);
    }
    const visibleDataKeys = this._cachedVisibleDataKeys;
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
        ${visibleColumns.map(col => html`
          <th class="${col.group || ''} ${col.divider ? 'vertical-divider' : ''}"
              title="${col.tooltip || col.displayName}">
            ${col.isHeaderFilter 
              ? this.renderHeaderFilter(col)
              : col.displayName}
          </th>
        `)}
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
    return html`
      <div class="d-flex flex-column align-items-center">
        <div class="small fw-bold mb-1">${column.displayName}</div>
        <select class="form-select form-select-sm border-0 bg-transparent p-1 header-filter-select"
                title="Filter by ${column.displayName}"
                .value=${this.abcFilter}
                @change=${e => this._dispatchUpdate('abcFilter', e.target.value)}>
            <option value="all">All</option>
            <option value="A">A</option>
            <option value="B">B</option>
            <option value="C">C</option>
            <option value="none">None</option>
        </select>
      </div>
    `;
  }

  renderBooleanFilterHeader(column, filterProperty) {
    return html`
      <div class="d-flex flex-column align-items-center">
        <div class="small fw-bold mb-1">${column.displayName}</div>
        <select class="form-select form-select-sm border-0 bg-transparent p-1 header-filter-select"
                title="Filter by ${column.displayName}"
                .value=${this[filterProperty]}
                @change=${e => this._dispatchUpdate(filterProperty, e.target.value)}>
            <option value="all">All</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
            <option value="none">None</option>
        </select>
      </div>
    `;
  }

  renderNumberFilterHeader(column) {
    // Each number column will have a filter: all, positive, negative, zero
    return html`
      <div class="d-flex flex-column align-items-center">
        <div class="small fw-bold mb-1">${column.displayName}</div>
        <div class="btn-group btn-group-sm number-filter-group">
          <button class="btn btn-outline-secondary btn-xs ${this.getNumberFilterStatus(column.key, 'all')}" 
                  @click=${() => this._dispatchUpdate(`numberFilter_${column.key}`, 'all')}
                  title="Show all values">
            <i class="bi bi-asterisk"></i>
          </button>
          <button class="btn btn-outline-success btn-xs ${this.getNumberFilterStatus(column.key, 'positive')}" 
                  @click=${() => this._dispatchUpdate(`numberFilter_${column.key}`, 'positive')}
                  title="Show positive values only">
            <i class="bi bi-plus"></i>
          </button>
          <button class="btn btn-outline-danger btn-xs ${this.getNumberFilterStatus(column.key, 'negative')}" 
                  @click=${() => this._dispatchUpdate(`numberFilter_${column.key}`, 'negative')}
                  title="Show negative values only">
            <i class="bi bi-dash"></i>
          </button>
          <button class="btn btn-outline-secondary btn-xs ${this.getNumberFilterStatus(column.key, 'zero')}" 
                  @click=${() => this._dispatchUpdate(`numberFilter_${column.key}`, 'zero')}
                  title="Show zero values only">
            <i class="bi bi-0-circle"></i>
          </button>
        </div>
      </div>
    `;
  }

  getNumberFilterStatus(columnKey, filterValue) {
    // Helper to highlight the active filter button
    const activeFilter = this[`numberFilter_${columnKey}`] || 'all';
    return activeFilter === filterValue ? 'active' : '';
  }

  renderDestinationFilterHeader(column) {
     return html`
        <select class="form-select form-select-sm border-0 bg-transparent p-1 header-filter-select"
                title="Filter by ${column.displayName}"
                .value=${this.destinationFilter}
                @change=${e => this._dispatchUpdate('destinationFilter', e.target.value)}>
            <option value="all">All ${column.displayName}s</option>
            ${(this.uniqueDestinations || []).map(dest => html`<option value="${dest}">${dest}</option>`)}
        </select>
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
    
    if (!this.tableData || !this.utilityFunctions) return;
    
    this.tableData.forEach(item => {
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

  /**
   * Check if filters have changed to determine if cache is valid
   */
  _filtersChanged() {
    const currentFilters = {
      destinationFilter: this.destinationFilter,
      abcFilter: this.abcFilter,
      blacklistedFilter: this.blacklistedFilter,
      lichidareFilter: this.lichidareFilter
    };
    
    // Add number filters
    if (this.columnConfig) {
      this.columnConfig
        .filter(col => col.type === 'number' && col.isHeaderFilter && col.visible)
        .forEach(col => {
          currentFilters[`numberFilter_${col.key}`] = this[`numberFilter_${col.key}`];
        });
    }
    
    // Compare with cached filters
    const filterKeys = Object.keys(currentFilters);
    const cachedKeys = Object.keys(this._cachedFilters);
    
    if (filterKeys.length !== cachedKeys.length) return true;
    
    return filterKeys.some(key => currentFilters[key] !== this._cachedFilters[key]);
  }

  /**
   * Apply number filters to filter the displayed data with caching
   * @returns {Array} The filtered data
   */
  getFilteredData() {
    // Check if we can use cached data
    if (!this._filtersChanged() && this._cachedFilteredData.length > 0) {
      return this._cachedFilteredData;
    }
    
    // Start with all data
    let filtered = [...this.tableData];
    
    // Apply destination filter if set and not 'all'
    if (this.destinationFilter && this.destinationFilter !== 'all') {
      // Find the destination column key
      const destColumn = this.columnConfig.find(col => col.isHeaderFilter && col.type === 'string');
      if (destColumn) {
        filtered = filtered.filter(item => item[destColumn.key] === this.destinationFilter);
      }
    }
    
    // Apply ABC classification filter
    if (this.abcFilter && this.abcFilter !== 'all') {
      const abcColumn = this.columnConfig.find(col => col.key === 'abc_class');
      if (abcColumn) {
        filtered = filtered.filter(item => {
          const abcValue = item[abcColumn.key];
          if (this.abcFilter === 'none') {
            return !abcValue || abcValue === '' || abcValue === null || abcValue === undefined;
          }
          return abcValue === this.abcFilter;
        });
      }
    }
    
    // Apply Blacklisted filter
    if (this.blacklistedFilter && this.blacklistedFilter !== 'all') {
      const blacklistedColumn = this.columnConfig.find(col => col.key === 'Blacklisted');
      if (blacklistedColumn) {
        filtered = filtered.filter(item => {
          const blacklistedValue = item[blacklistedColumn.key];
          if (this.blacklistedFilter === 'yes') {
            // Handle multiple formats: true, 1, '1', 'true', 'Da', 'Yes'
            return blacklistedValue === true || 
                   blacklistedValue === 1 || 
                   blacklistedValue === '1' || 
                   blacklistedValue === 'true' ||
                   (typeof blacklistedValue === 'string' && 
                    (blacklistedValue.toLowerCase() === 'da' || blacklistedValue.toLowerCase() === 'yes'));
          } else if (this.blacklistedFilter === 'no') {
            // Handle multiple formats: false, 0, '0', 'false', 'Nu', 'No', '-'
            return blacklistedValue === false || 
                   blacklistedValue === 0 || 
                   blacklistedValue === '0' || 
                   blacklistedValue === 'false' ||
                   (typeof blacklistedValue === 'string' && 
                    (blacklistedValue.toLowerCase() === 'nu' || 
                     blacklistedValue.toLowerCase() === 'no' || 
                     blacklistedValue === '-'));
          } else if (this.blacklistedFilter === 'none') {
            return blacklistedValue === null || blacklistedValue === undefined || blacklistedValue === '';
          }
          return true;
        });
      }
    }
    
    // Apply InLichidare filter
    if (this.lichidareFilter && this.lichidareFilter !== 'all') {
      const lichidareColumn = this.columnConfig.find(col => col.key === 'InLichidare');
      if (lichidareColumn) {
        filtered = filtered.filter(item => {
          const lichidareValue = item[lichidareColumn.key];
          if (this.lichidareFilter === 'yes') {
            // Handle multiple formats: true, 1, '1', 'true', 'Da', 'Yes'
            return lichidareValue === true || 
                   lichidareValue === 1 || 
                   lichidareValue === '1' || 
                   lichidareValue === 'true' ||
                   (typeof lichidareValue === 'string' && 
                    (lichidareValue.toLowerCase() === 'da' || lichidareValue.toLowerCase() === 'yes'));
          } else if (this.lichidareFilter === 'no') {
            // Handle multiple formats: false, 0, '0', 'false', 'Nu', 'No', '-'
            return lichidareValue === false || 
                   lichidareValue === 0 || 
                   lichidareValue === '0' || 
                   lichidareValue === 'false' ||
                   (typeof lichidareValue === 'string' && 
                    (lichidareValue.toLowerCase() === 'nu' || 
                     lichidareValue.toLowerCase() === 'no' || 
                     lichidareValue === '-'));
          } else if (this.lichidareFilter === 'none') {
            return lichidareValue === null || lichidareValue === undefined || lichidareValue === '';
          }
          return true;
        });
      }
    }

    // Apply all number filters
    if (this.columnConfig) {
      this.columnConfig
        .filter(col => col.type === 'number' && col.isHeaderFilter && col.visible)
        .forEach(col => {
          const filterValue = this[`numberFilter_${col.key}`];
          if (filterValue && filterValue !== 'all') {
            filtered = filtered.filter(item => {
              const value = parseFloat(item[col.key]);
              if (isNaN(value)) return false;
              
              switch (filterValue) {
                case 'positive': return value > 0;
                case 'negative': return value < 0;
                case 'zero': return value === 0;
                default: return true;
              }
            });
          }
        });
    }
    
    // Cache the results
    this._cachedFilteredData = filtered;
    this._cachedFilters = {
      destinationFilter: this.destinationFilter,
      abcFilter: this.abcFilter,
      blacklistedFilter: this.blacklistedFilter,
      lichidareFilter: this.lichidareFilter
    };
    
    // Cache number filters
    if (this.columnConfig) {
      this.columnConfig
        .filter(col => col.type === 'number' && col.isHeaderFilter && col.visible)
        .forEach(col => {
          this._cachedFilters[`numberFilter_${col.key}`] = this[`numberFilter_${col.key}`];
        });
    }
    
    return filtered;
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

    // Apply filters to the data
    const filteredData = this.getFilteredData();

    return html`
      <div class="table-responsive data-table-container">
        ${this.loading ? html`<div class="table-overlay"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div></div>` : ''}
        <table class="table table-sm table-hover table-bordered modern-table compact-table">
          <thead class="sticky-top bg-light small">
            ${this.renderHeader()}
          </thead>
          <tbody class="small">
            ${filteredData && filteredData.length > 0
              ? filteredData.map((item, index) => this.renderRow(item, index))
              : html`<tr><td colspan="${(this.columnConfig && Array.isArray(this.columnConfig)) ? this.columnConfig.filter(c => c.visible).length : 1}" class="text-center text-muted p-2">No data available for the current selection and filters.</td></tr>`
            }
          </tbody>
        </table>
      </div>
    `;
  }

  updated(changedProperties) {
    super.updated(changedProperties);
    
    // Pre-calculate derived values when data or utility functions change
    if (changedProperties.has('tableData') || changedProperties.has('utilityFunctions')) {
      this._preCalculateDerivedValues();
      // Clear filter cache when data changes
      this._cachedFilteredData = [];
      this._cachedFilters = {};
      // Clear keyboard navigation cache when data changes
      this._cachedVisibleDataKeys = null;
    }
    
    // Clear keyboard navigation cache when filters change (affects visible rows)
    if (changedProperties.has('destinationFilter') || 
        changedProperties.has('abcFilter') ||
        changedProperties.has('blacklistedFilter') ||
        changedProperties.has('lichidareFilter') ||
        Object.keys(changedProperties).some(key => key.startsWith('numberFilter_'))) {
      this._cachedVisibleDataKeys = null;
    }
    
    // No longer initializing tooltips here for performance - using basic HTML title attributes
  }

  connectedCallback() {
    super.connectedCallback();
    
    // Listen for filter-changed events from the container
    document.addEventListener('filter-changed', (e) => {
      console.log('Data table received filter-changed event:', e.detail);
      
      // Force the table to re-render when filters change
      this.requestUpdate();
    });
  }
}
customElements.define('replenishment-data-table', ReplenishmentDataTable);
