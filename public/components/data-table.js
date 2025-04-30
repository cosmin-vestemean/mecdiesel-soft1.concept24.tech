import { LitElement, html } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';
import { columnConfig } from '../config/table-column-config.js'; // Import the column config

export class ReplenishmentDataTable extends LitElement {
  static get properties() {
    return {
      tableData: { type: Array },
      columnConfig: { type: Array },
      destinationFilter: { type: String },
      uniqueDestinations: { type: Array },
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
      
      // Initialize all number filters to 'all'
      if (Array.isArray(columnConfig)) {
        columnConfig
          .filter(col => col.type === 'number' && col.isHeaderFilter)
          .forEach(col => {
            this[`numberFilter_${col.key}`] = 'all';
          });
      }
  }

  createRenderRoot() { return this; } // Render in light DOM

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
    const currentColKey = inputElement.dataset.colkey; // Assuming we add data-colkey to input

    if (!currentKey || !currentColKey) return;

    let nextKey = currentKey;
    let nextColKey = currentColKey;
    let moved = false;

    const visibleDataKeys = this.tableData.map(item => item.keyField); // Get keys in current filtered order
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
              ? (col.type === 'number' 
                ? this.renderNumberFilterHeader(col)
                : this.renderDestinationFilterHeader(col))
              : col.displayName}
          </th>
        `)}
      </tr>
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
    const cellClassList = [column.group || ''];
    if (column.divider) cellClassList.push('vertical-divider');

    // Apply dynamic class functions if defined
    if (column.classFn && typeof this.utilityFunctions[column.classFn] === 'function') {
        cellClassList.push(this.utilityFunctions[column.classFn](item)); // Pass the whole item
    } else if (column.classFn === 'getValueClass' && typeof this.utilityFunctions.getValueClass === 'function') {
        // Special case for getValueClass which takes the value directly
        cellClassList.push(this.utilityFunctions.getValueClass(value));
    }


    if (column.type === 'index') {
      content = html`${index + 1}`;
    } else if (column.isEditable && column.key === 'transfer') {
      content = html`
        <input
          class="form-control form-control-sm compact-input ${this.utilityFunctions.getValueClass ? this.utilityFunctions.getValueClass(value) : ''}"
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
        content = html`${value === 'Da' ? 'Yes' : (value === '-' ? 'No' : value)}`; // Handle 'Da'/'No'/-
    } else if (column.truncate) {
        // Improved truncation with proper styling
        const truncatedValue = (value || '').substring(0, column.truncate);
        const showEllipsis = value?.length > column.truncate;
        content = html`<span title="${value}">${truncatedValue}${showEllipsis ? '...' : ''}</span>`;
        cellClassList.push('text-truncate');
    } else {
      // Default rendering for other types (string, number)
      content = html`${value}`;
    }

    // Add stock indicator styling directly if needed (can be redundant if classFn handles it)
    let indicatorHtml = '';
    if (column.key === 'stoc_emit' || column.key === 'stoc_dest') {
        const stockClass = column.key === 'stoc_emit'
            ? this.utilityFunctions.getStockClassEmit(item)
            : this.utilityFunctions.getStockClassDest(item);
        if (stockClass.includes('stock-critical')) indicatorHtml = html`<span class="stock-indicator critical">▼</span>`;
        else if (stockClass.includes('stock-optimal')) indicatorHtml = html`<span class="stock-indicator optimal">✓</span>`;
        else if (stockClass.includes('stock-high')) indicatorHtml = html`<span class="stock-indicator high">▲</span>`;
    }


    return html`
      <td class="${cellClassList.join(' ')}">
        ${content}${indicatorHtml}
      </td>
    `;
  }

  /**
   * Apply number filters to filter the displayed data
   * @returns {Array} The filtered data
   */
  getFilteredData() {
    // Start with all data
    let filtered = [...this.tableData];
    
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
