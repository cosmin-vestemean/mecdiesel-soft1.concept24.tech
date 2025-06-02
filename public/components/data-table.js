import { LitElement, html } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';
import { columnConfig, sortConfig } from '../config/table-column-config.js'; // Import the column config and sort config

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
      // Sorting properties
      sortColumn: { type: String },
      sortDirection: { type: String },
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
      this.sortColumn = null;
      this.sortDirection = 'asc';
      
      // Performance optimization: Cache filtered data and derived values
      this._cachedFilteredData = [];
      this._cachedFilters = {};
      this._cachedDerivedValues = new Map(); // For CSS classes and styles
      this._cachedVisibleDataKeys = null; // Cache for keyboard navigation
      this._cachedSortedData = []; // Cache for sorted data
      this._lastSortState = null; // Track last sort state for cache invalidation
      
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
    
    // Performance check: warn about client-side sorting on large datasets
    if (this.tableData && this.tableData.length > sortConfig.clientSortThreshold) {
      console.warn(`Dataset size (${this.tableData.length}) exceeds client-side sorting threshold (${sortConfig.clientSortThreshold}). Consider implementing server-side sorting for better performance.`);
    }
    
    if (this.sortColumn === column.key) {
      // Toggle direction if same column
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      // New column, use default sort order for this data type
      this.sortColumn = column.key;
      this.sortDirection = sortConfig.defaultSortOrder[column.type] || 'asc';
    }
    
    // Dispatch sort event to container (for potential server-side sorting)
    this._dispatchUpdate('sort', {
      column: this.sortColumn,
      direction: this.sortDirection,
      dataType: column.type
    });
    
    // Clear sorting cache only - filtering cache should remain valid
    this._cachedSortedData = [];
    this._lastSortState = null;
    
    // Clear keyboard navigation cache as sort order affects navigation
    this._cachedVisibleDataKeys = null;
    
    // Request update to trigger re-render
    this.requestUpdate();
  }

  sortData(data) {
    if (!this.sortColumn || !data || data.length === 0) {
      return data;
    }
    
    // Create a comprehensive cache key that includes both sort state and data characteristics
    const dataFingerprint = this._createDataFingerprint(data);
    const currentSortState = `${this.sortColumn}-${this.sortDirection}-${dataFingerprint}`;
    
    // Check cache validity with comprehensive key
    if (this._lastSortState === currentSortState && this._cachedSortedData.length > 0) {
      return this._cachedSortedData;
    }
    
    const sortColumn = this.columnConfig.find(col => col.key === this.sortColumn);
    if (!sortColumn) {
      return data;
    }
    
    const sorted = [...data].sort((a, b) => {
      let aVal = a[this.sortColumn];
      let bVal = b[this.sortColumn];
      
      // Handle different data types
      switch (sortColumn.type) {
        case 'number':
          aVal = parseFloat(aVal) || 0;
          bVal = parseFloat(bVal) || 0;
          break;
        case 'boolean':
          // Convert various boolean formats to actual booleans for comparison
          aVal = this.parseBooleanValue(aVal);
          bVal = this.parseBooleanValue(bVal);
          break;
        case 'string':
          aVal = (aVal || '').toString().toLowerCase();
          bVal = (bVal || '').toString().toLowerCase();
          break;
        default:
          aVal = aVal || '';
          bVal = bVal || '';
      }
      
      let comparison = 0;
      if (aVal < bVal) {
        comparison = -1;
      } else if (aVal > bVal) {
        comparison = 1;
      }
      
      return this.sortDirection === 'desc' ? -comparison : comparison;
    });
    
    // Cache the result with comprehensive key
    this._cachedSortedData = sorted;
    this._lastSortState = currentSortState;
    
    return sorted;
  }

  /**
   * Create a fingerprint of the data to detect changes
   * @param {Array} data - The data array to fingerprint
   * @returns {String} - A string representing the data characteristics
   */
  _createDataFingerprint(data) {
    if (!data || data.length === 0) return 'empty';
    
    // Create a lightweight fingerprint based on data length and first/last item keys
    const firstKey = data[0]?.keyField || 'unknown';
    const lastKey = data[data.length - 1]?.keyField || 'unknown';
    return `${data.length}-${firstKey}-${lastKey}`;
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
        iconClass = 'bi-arrow-up';
        iconColor = '#198754'; // Green for ascending
        title = 'Sorted ascending (click for descending)';
      } else {
        iconClass = 'bi-arrow-down';
        iconColor = '#dc3545'; // Red for descending
        title = 'Sorted descending (click for ascending)';
      }
      opacity = '1';
    } else {
      iconClass = 'bi-arrow-up-down';
      iconColor = '#6c757d'; // Gray for unsorted
      opacity = '0.5';
      title = 'Click to sort';
    }
    
    return html`
      <i class="bi ${iconClass} sort-icon ms-1 ${isCurrentSort ? 'active' : ''}" 
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
      <div class="d-flex flex-column align-items-center ${isCurrentSort ? 'text-primary fw-bold' : ''}"
           @click=${column.isSortable ? (e) => { e.stopPropagation(); this.handleSort(column); } : null}
           style="${column.isSortable ? 'cursor: pointer;' : ''}">
        <div class="d-flex align-items-center small fw-bold mb-1">
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
      <div class="d-flex flex-column align-items-center ${isCurrentSort ? 'text-primary fw-bold' : ''}"
           @click=${column.isSortable ? (e) => { e.stopPropagation(); this.handleSort(column); } : null}
           style="${column.isSortable ? 'cursor: pointer;' : ''}">
        <div class="d-flex align-items-center small fw-bold mb-1">
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
            <option value="none">None</option>
        </select>
      </div>
    `;
  }

  renderNumberFilterHeader(column) {
    // Each number column will have a filter: all, positive, negative, zero
    const isCurrentSort = this.sortColumn === column.key;
    return html`
      <div class="d-flex flex-column align-items-center ${isCurrentSort ? 'text-primary fw-bold' : ''}"
           @click=${column.isSortable ? (e) => { e.stopPropagation(); this.handleSort(column); } : null}
           style="${column.isSortable ? 'cursor: pointer;' : ''}">
        <div class="d-flex align-items-center small fw-bold mb-1">
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
    const activeFilter = this[`numberFilter_${columnKey}`] || 'all';
    return activeFilter === filterValue ? 'active' : '';
  }

  renderDestinationFilterHeader(column) {
     return html`
      <div class="d-flex flex-column align-items-center"
           @click=${column.isSortable ? (e) => { e.stopPropagation(); this.handleSort(column); } : null}>
        <div class="d-flex align-items-center small fw-bold mb-1">
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
  }  /**
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
          } else if (this.abcFilter === 'abc') {
            // Show only items with ABC classifications (A, B, C) - exclude None/empty values
            return abcValue === 'A' || abcValue === 'B' || abcValue === 'C';
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
    
    // Cache the filtered results
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
    
    // Apply sorting and return
    return filtered;
  }

  /**
   * Public method to trigger sorting from outside the component
   * @param {String} columnKey - The column key to sort by
   * @param {String} direction - The sort direction ('asc' or 'desc')
   */
  triggerSort(columnKey, direction) {
    this.sortColumn = columnKey;
    this.sortDirection = direction;

    // Invalidate cache for sorted data
    this._cachedSortedData = [];
    this._lastSortState = null;

    // Request update to re-render the table with new sort order
    this.requestUpdate();
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

    // Apply filters to the data
    const filteredData = this.getFilteredData();

    // Sort the data if a sort column is set
    const sortedData = this.sortColumn ? this.sortData(filteredData) : filteredData;

    return html`
      <div class="table-responsive data-table-container">
        ${this.loading ? html`<div class="table-overlay"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div></div>` : ''}
        <table class="table table-sm table-hover table-bordered modern-table compact-table">
          <thead class="sticky-top bg-light small">
            ${this.renderHeader()}
          </thead>
          <tbody class="small">
            ${sortedData && sortedData.length > 0
              ? sortedData.map((item, index) => this.renderRow(item, index))
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
      // Clear all caches when data changes
      this._cachedFilteredData = [];
      this._cachedFilters = {};
      this._cachedSortedData = [];
      this._lastSortState = null;
      this._cachedVisibleDataKeys = null;
    }
    
    // Clear navigation cache when filters change (affects visible rows)
    if (changedProperties.has('destinationFilter') || 
        changedProperties.has('abcFilter') ||
        changedProperties.has('blacklistedFilter') ||
        changedProperties.has('lichidareFilter') ||
        Object.keys(changedProperties).some(key => key.startsWith('numberFilter_'))) {
      this._cachedVisibleDataKeys = null;
      // Note: We don't clear filter cache here as it's handled by _filtersChanged()
    }
    
    // Clear sorting cache when sort properties change
    if (changedProperties.has('sortColumn') || changedProperties.has('sortDirection')) {
      this._cachedSortedData = [];
      this._lastSortState = null;
      this._cachedVisibleDataKeys = null; // Sort order affects navigation
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
