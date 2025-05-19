import { LitElement, html, css } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';

/**
 * Fancy Dropdown - A customizable dropdown component with search, multi-select capabilities
 * 
 * @element fancy-dropdown
 * @fires {CustomEvent} selection-changed - Fired when the selection changes with detail.value containing the new selected values
 * @fires {CustomEvent} dropdown-opened - Fired when the dropdown opens
 * @fires {CustomEvent} dropdown-closed - Fired when the dropdown closes
 */
export class FancyDropdown extends LitElement {
  static get properties() {
    return {
      // Public properties
      items: { type: Object }, // Object with key-value pairs of selectable items
      selectedItems: { type: Array }, // Array of selected item keys
      placeholder: { type: String }, // Placeholder text when nothing is selected
      searchPlaceholder: { type: String }, // Placeholder for the search input
      multiSelect: { type: Boolean }, // Whether multiple items can be selected
      showBadge: { type: Boolean }, // Whether to show count badge
      searchEnabled: { type: Boolean }, // Whether to show search box
      selectAllLabel: { type: String }, // Label for select all button
      clearAllLabel: { type: String }, // Label for clear all button
      disabled: { type: Boolean }, // Whether the dropdown is disabled
      
      // Internal state properties
      open: { type: Boolean, state: true }, // Whether the dropdown is open
      searchTerm: { type: String, state: true }, // Current search term
    };
  }

  constructor() {
    super();
    
    // Set default values
    this.items = {}; // Empty items object by default
    this.selectedItems = []; // No items selected by default
    this.placeholder = 'Select items';
    this.searchPlaceholder = 'Search...';
    this.multiSelect = true; // Multi-select by default
    this.showBadge = true;
    this.searchEnabled = true;
    this.selectAllLabel = 'Select All';
    this.clearAllLabel = 'Clear All';
    this.disabled = false;
    
    // Initialize internal state
    this.open = false;
    this.searchTerm = '';
    
    // Generate a unique ID for this dropdown instance
    this.uniqueId = `dropdown_${Math.random().toString(36).substr(2, 9)}`;
    
    // Bind methods to this context
    this.closeDropdown = this.closeDropdown.bind(this);
  }

  // Override to use Light DOM instead of Shadow DOM
  createRenderRoot() {
    return this;
  }

  /**
   * Generate display text based on current selection
   */
  getDisplayText() {
    const count = this.selectedItems?.length || 0;
    if (count === 0) return this.placeholder;
    
    if (count === 1) {
      const code = this.selectedItems[0];
      return `${code} - ${this.items[code] || 'Unknown'}`;
    }
    
    // Check if all items are selected
    if (this.items && count === Object.keys(this.items).length) {
      return 'All items selected';
    }
    
    return `${count} items selected`;
  }

  /**
   * Toggle dropdown visibility
   */
  toggleDropdown(e) {
    if (this.disabled) return;
    
    e.stopPropagation(); // Prevent toggle click from closing immediately
    const oldOpenState = this.open;
    this.open = !this.open;
    
    if (this.open) {
      // Opened: clean up stray and add new listener for outside clicks
      document.removeEventListener('click', this.closeDropdown);
      document.addEventListener('click', this.closeDropdown, { once: true });
      if (this.searchEnabled) {
        setTimeout(() => this.querySelector('.search-input')?.focus(), 0);
      }
      this.dispatchEvent(new CustomEvent('dropdown-opened', { bubbles: true, composed: true }));
    } else if (oldOpenState && !this.open) {
      // Explicit close via toggle
      this.searchTerm = '';
      document.removeEventListener('click', this.closeDropdown);
      this.dispatchEvent(new CustomEvent('dropdown-closed', { bubbles: true, composed: true }));
    }
    // No need to call this.requestUpdate() here as property changes (this.open) will trigger it.
  }

  /**
   * Close the dropdown when clicking outside or when an action dictates.
   */
  closeDropdown(e) {
    const toggleButton = this.querySelector('.fancy-dropdown-toggle');
    const dropdownMenu = this.querySelector('.fancy-dropdown-menu');

    // If the click is on the toggle button, let toggleDropdown handle it
    if (toggleButton && toggleButton.contains(e.target)) {
      return;
    }

    // If the click is inside the dropdown menu, re-arm the listener to keep it open
    if (dropdownMenu && dropdownMenu.contains(e.target)) {
      // Inside click: re-arm and do not close
      document.removeEventListener('click', this.closeDropdown);
      document.addEventListener('click', this.closeDropdown, { once: true });
      return;
    }

    // Close the dropdown for any outside click
    if (this.open) {
      this.open = false;
      this.searchTerm = ''; // Clear search term when closing
      this.dispatchEvent(new CustomEvent('dropdown-closed', { bubbles: true, composed: true }));
    }
  }

  /**
   * Close dropdown manually with close button
   */
  closeDropdownManually(e) {
    e.stopPropagation();
    this.open = false;
    this.searchTerm = ''; // Clear search term when closing
    // Ensure the global click listener is removed
    document.removeEventListener('click', this.closeDropdown, { capture: true });
    this.dispatchEvent(new CustomEvent('dropdown-closed', {
      bubbles: true,
      composed: true
    }));
  }

  /**
   * Handle item selection
   */
  toggleItem(itemKey, e) {
    e.stopPropagation(); // Prevent event from bubbling further
    e.preventDefault(); // Prevent default behavior, e.g., for checkbox clicks if not handled
    
    let updatedSelection;
    
    if (this.multiSelect) {
      const index = this.selectedItems.indexOf(itemKey);
      if (index > -1) {
        // Remove from selection
        updatedSelection = this.selectedItems.filter(item => item !== itemKey);
      } else {
        // Add to selection
        updatedSelection = [...this.selectedItems, itemKey].sort(); 
      }
      // Do NOT close dropdown in multi-select mode
    } else {
      // Single select mode
      updatedSelection = [itemKey];
      this.open = false; // Close dropdown for single select
      // Clean up the global listener as the dropdown is now closed by item selection.
      document.removeEventListener('click', this.closeDropdown, { capture: true });
      this.searchTerm = '';
      this.dispatchEvent(new CustomEvent('dropdown-closed', { bubbles: true, composed: true }));
    }
    
    this.selectedItems = updatedSelection;
    this._notifySelectionChanged();
    this.requestUpdate(); // Ensure UI reflects selection change immediately
  }

  /**
   * Select all visible/filtered items
   */
  selectAll(e) {
    e.stopPropagation();
    
    // Get filtered items
    const filteredItems = this._getFilteredItems();
    
    // Add all filtered items to selection, preserving current selections
    const currentSelection = new Set(this.selectedItems);
    filteredItems.forEach(([key]) => currentSelection.add(key));
    
    this.selectedItems = [...currentSelection].sort();
    this._notifySelectionChanged();
  }

  /**
   * Clear all selected items
   */
  clearAll(e) {
    e.stopPropagation();
    
    if (this.searchTerm) {
      // If search term exists, only clear filtered items
      const filteredKeys = this._getFilteredItems().map(([key]) => key);
      this.selectedItems = this.selectedItems.filter(key => !filteredKeys.includes(key));
    } else {
      // Otherwise clear all selections
      this.selectedItems = [];
    }
    
    this._notifySelectionChanged();
  }

  /**
   * Handle search input
   */
  handleSearchInput(e) {
    this.searchTerm = e.target.value;
  }

  /**
   * Notify about selection changes
   */
  _notifySelectionChanged() {
    this.dispatchEvent(new CustomEvent('selection-changed', {
      detail: {
        value: this.selectedItems
      },
      bubbles: true,
      composed: true
    }));
  }

  /**
   * Get filtered items based on search term
   */
  _getFilteredItems() {
    if (!this.searchTerm) {
      return Object.entries(this.items || {});
    }
    
    return Object.entries(this.items || {}).filter(([key, value]) => 
      key.includes(this.searchTerm) || 
      String(value).toLowerCase().includes(this.searchTerm.toLowerCase())
    );
  }

  render() {
    const filteredItems = this._getFilteredItems();
    const count = this.selectedItems?.length || 0;
    const totalItems = Object.keys(this.items || {}).length;
    const allSelected = count > 0 && count === totalItems;

    // Apply styles directly in the render method since we're using Light DOM
    return html`
      <style>
        ${this.constructor.styles}
      </style>
      <div class="fancy-dropdown">
        <button 
          class="fancy-dropdown-toggle ${allSelected ? 'all-selected' : ''}" 
          @click=${this.toggleDropdown}
          ?disabled=${this.disabled}
          aria-haspopup="listbox"
          aria-expanded=${this.open}
        >
          <span class="fancy-dropdown-text">${this.getDisplayText()}</span>
          ${this.showBadge && count > 0 ? html`<span class="badge">${count}</span>` : ''}
          <span class="dropdown-arrow"></span>
        </button>
        
        ${this.open ? html`
          <div 
            class="fancy-dropdown-menu" 
            @click=${this.handleDropdownClick}
            role="listbox"
            aria-multiselectable=${this.multiSelect}
          >
            ${this.searchEnabled ? html`
              <div class="fancy-dropdown-header">
                <div class="search-container">
                  <input 
                    type="text" 
                    class="search-input" 
                    placeholder=${this.searchPlaceholder}
                    .value=${this.searchTerm}
                    @input=${this.handleSearchInput}
                    @keydown=${e => e.stopPropagation()}
                  />
                  <button type="button" class="close-button" @click=${this.closeDropdownManually} title="Close dropdown">
                    ×
                  </button>
                </div>
              </div>
            ` : html`
              <div class="fancy-dropdown-header-simple">
                <button type="button" class="close-button-standalone" @click=${this.closeDropdownManually} title="Close dropdown">
                  ×
                </button>
              </div>
            `}
            
            ${this.multiSelect ? html`
              <div class="fancy-dropdown-actions">
                <button class="action-button" @click=${this.selectAll}>${this.selectAllLabel}</button>
                <button class="action-button" @click=${this.clearAll}>${this.clearAllLabel}</button>
              </div>
            ` : ''}
            
            <div class="fancy-dropdown-items">
              ${filteredItems.length > 0 ? filteredItems.map(([key, value]) => html`
                <div class="fancy-dropdown-item" 
                     role="option" 
                     aria-selected=${this.selectedItems.includes(key)}
                     @click=${(e) => {
                       // If the click is not on the checkbox/radio itself, toggle it
                       if (e.target.type !== 'checkbox' && e.target.type !== 'radio') {
                         this.toggleItem(key, e);
                       }
                     }}>
                  <div class="item-content">
                    <input 
                      type=${this.multiSelect ? 'checkbox' : 'radio'} 
                      id="${this.uniqueId}-item-${key}" 
                      class="item-input"
                      .checked=${this.selectedItems.includes(key)}
                      @change=${e => this.toggleItem(key, e)}
                    />
                    <label class="item-label" for="${this.uniqueId}-item-${key}">${key} - ${value}</label>
                  </div>
                </div>
              `) : html`
                <div class="no-results">No matches found.</div>
              `}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  static get styles() {
    return css`
      /* Container */
      .fancy-dropdown {
        position: relative;
        z-index: 9999;
        width: 100%;
      }

      /* Toggle button */
      .fancy-dropdown-toggle {
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 100%;
        padding: 0.25rem 0.5rem;
        background-color: white;
        border: 1px solid #ced4da;
        border-radius: 0.25rem;
        cursor: pointer;
        font-size: 0.875rem;
        text-align: left;
        transition: all 0.2s ease-in-out;
      }

      .fancy-dropdown-toggle:hover:not(:disabled) {
        border-color: #adb5bd;
      }

      .fancy-dropdown-toggle:focus {
        border-color: #446e9b;
        box-shadow: 0 0 0 0.2rem rgba(68, 110, 155, 0.25);
        outline: 0;
      }

      .fancy-dropdown-toggle:disabled {
        background-color: #e9ecef;
        opacity: 0.65;
        cursor: not-allowed;
      }

      .fancy-dropdown-toggle.all-selected {
        color: #28a745;
        font-weight: bold;
      }

      .dropdown-arrow {
        margin-left: 8px;
        border-top: 5px solid #666;
        border-left: 5px solid transparent;
        border-right: 5px solid transparent;
        width: 0;
        height: 0;
      }

      .badge {
        background-color: #446e9b;
        color: white;
        border-radius: 10px;
        padding: 0.2em 0.5em;
        font-size: 0.75rem;
        margin-left: 8px;
      }

      /* Dropdown menu */
      .fancy-dropdown-menu {
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        z-index: 10000; /* Increased to ensure it's above other elements */
        margin-top: 2px;
        background: white;
        border: 1px solid #dee2e6;
        border-radius: 4px;
        box-shadow: 0 3px 10px rgba(0, 0, 0, 0.15);
        display: flex;
        flex-direction: column;
        animation: fadeIn 0.1s ease-out;
        max-height: 320px;
        overflow: hidden; /* Ensure child elements don't overflow */
      }

      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(-5px); }
        to { opacity: 1; transform: translateY(0); }
      }

      /* Search header */
      .fancy-dropdown-header {
        padding: 8px;
        border-bottom: 1px solid #e9ecef;
        position: sticky;
        top: 0;
        background-color: white;
        z-index: 2;
      }
      
      .search-container {
        display: flex;
        align-items: center;
        position: relative;
      }

      .search-input {
        width: 100%;
        padding: 0.25rem 0.5rem;
        padding-right: 24px; /* Make room for the close button */
        border: 1px solid #ced4da;
        border-radius: 0.25rem;
        font-size: 0.875rem;
      }

      .search-input:focus {
        border-color: #446e9b;
        box-shadow: 0 0 0 0.2rem rgba(68, 110, 155, 0.25);
        outline: 0;
      }
      
      .close-button {
        position: absolute;
        right: 8px;
        top: 50%;
        transform: translateY(-50%);
        background: none;
        border: none;
        color: #343a40; /* Darker color for better visibility */
        font-size: 1.35rem; /* Slightly larger */
        font-weight: bold;
        cursor: pointer;
        padding: 0;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 3; /* Ensure it's above the input */
      }
      
      .close-button:hover {
        color: #000000; /* Black on hover */
      }
      
      .fancy-dropdown-header-simple {
        display: flex;
        justify-content: flex-end;
        padding: 8px;
        border-bottom: 1px solid #e9ecef;
        position: sticky;
        top: 0;
        background-color: white;
        z-index: 2;
      }
      
      .close-button-standalone {
        background: none;
        border: none;
        color: #343a40; /* Darker color */
        font-size: 1.35rem; /* Slightly larger and consistent */
        font-weight: bold;
        line-height: 1;
        cursor: pointer;
        padding: 2px 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
      }
      
      .close-button-standalone:hover {
        color: #000000; /* Black on hover */
        background-color: #e9ecef;
      }

      /* Actions bar */
      .fancy-dropdown-actions {
        display: flex;
        justify-content: space-between;
        padding: 4px 8px;
        border-bottom: 1px solid #f1f3f5;
        background-color: #f8f9fa;
      }

      .action-button {
        background: none;
        border: none;
        color: #446e9b;
        font-size: 0.8rem;
        padding: 2px 4px;
        cursor: pointer;
        text-decoration: none;
      }

      .action-button:hover {
        color: #1c3c5c;
        background-color: #e9ecef;
        border-radius: 3px;
        text-decoration: none;
      }

      /* Items container */
      .fancy-dropdown-items {
        overflow-y: auto;
        max-height: 240px;
        scrollbar-width: thin;
        scrollbar-color: #ccc #f5f5f5;
      }

      .fancy-dropdown-items::-webkit-scrollbar {
        width: 6px;
      }

      .fancy-dropdown-items::-webkit-scrollbar-track {
        background: #f5f5f5;
      }

      .fancy-dropdown-items::-webkit-scrollbar-thumb {
        background-color: #ccc;
        border-radius: 3px;
      }

      /* Individual items */
      .fancy-dropdown-item {
        padding: 6px 10px;
        transition: background-color 0.15s ease-in-out;
        border-bottom: 1px solid #f8f9fa;
      }

      .fancy-dropdown-item:hover {
        background-color: #f8f9fa;
      }

      .item-content {
        display: flex;
        align-items: center;
      }

      .item-input {
        margin-right: 8px;
        cursor: pointer;
      }

      .item-label {
        margin: 0;
        user-select: none;
        cursor: pointer;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        width: 100%;
        font-size: 0.85rem;
      }

      /* No results message */
      .no-results {
        padding: 10px;
        text-align: center;
        color: #6c757d;
        font-size: 0.85rem;
      }
    `;
  }
}

// Register the custom element
customElements.define('fancy-dropdown', FancyDropdown);
