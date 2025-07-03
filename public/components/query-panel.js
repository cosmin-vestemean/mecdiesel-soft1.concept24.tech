import { LitElement, html } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';
import { ContextConsumer } from 'https://cdn.jsdelivr.net/npm/@lit/context@1.1.0/index.js';
import { ReplenishmentStoreContext } from '../stores/replenishment-store.js';

export class QueryPanel extends LitElement {
  static get properties() {
    return {
      // Store-driven properties
      branches: { type: Object },
      branchesEmit: { type: String },
      selectedDestBranches: { type: Array },
      setConditionForNecesar: { type: Boolean },
      setConditionForLimits: { type: Boolean },
      loading: { type: Boolean },
      
      // Internal UI state for dropdown
      showDestDropdown: { type: Boolean, state: true },
      destSearchTerm: { type: String, state: true },
    };
  }

  constructor() {
    super();
    
    // Initialize UI state
    this.showDestDropdown = false;
    this.destSearchTerm = '';
    this.closeDestDropdown = this.closeDestDropdown.bind(this);
    
    // Initialize store-driven properties (will be updated by store)
    this.branches = {};
    this.branchesEmit = '';
    this.selectedDestBranches = [];
    this.setConditionForNecesar = true;
    this.setConditionForLimits = true;
    this.loading = false;
    
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
        console.log('📋 QueryPanel received store update:', action.type);
        this._syncStateFromStore(newState);
      });
      
      // Initial sync
      this._syncStateFromStore(this._store.getState());
    }
  }

  _syncStateFromStore(state) {
    this.branchesEmit = state.branchesEmit;
    this.selectedDestBranches = state.selectedDestBranches;
    this.setConditionForNecesar = state.setConditionForNecesar;
    this.setConditionForLimits = state.setConditionForLimits;
    this.loading = state.loading;
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    // Clean up store subscription
    if (this._unsubscribeFromStore) {
      this._unsubscribeFromStore();
    }
  }

  createRenderRoot() {
    return this; // Render in light DOM
  }

  // --- Event Dispatchers ---
  _dispatchUpdate(property, value) {
    console.log(`QueryPanel updating ${property}:`, value);
    
    // Update store directly instead of emitting events
    if (this._store) {
      if (property === 'branchesEmit') {
        this._store.setBranchesEmit(value);
      } else if (property === 'selectedDestBranches') {
        this._store.setSelectedDestBranches(value);
      } else if (property === 'setConditionForNecesar') {
        this._store.setConditionForNecesar(value);
      } else if (property === 'setConditionForLimits') {
        this._store.setConditionForLimits(value);
      }
    } else {
      console.warn('Store not available yet for QueryPanel');
    }
  }

  _emitAction(actionName) {
      this.dispatchEvent(new CustomEvent(actionName, { bubbles: true, composed: true }));
  }

  // --- Destination Dropdown Logic ---
  getDestBranchesDisplayText() {
    const count = this.selectedDestBranches?.length || 0;
    if (count === 0) return 'Select branches';
    if (count === 1) {
      const code = this.selectedDestBranches[0];
      return `${code} - ${this.branches[code] || 'Unknown'}`;
    }
    // Check if all branches are selected
    if (this.branches && count === Object.keys(this.branches).length) {
        return 'All branches selected';
    }
    return `${count} branches selected`;
  }

  toggleDestinationDropdown(e) {
    this.showDestDropdown = !this.showDestDropdown;
    e.stopPropagation();
    if (this.showDestDropdown) {
      // Use capture phase to ensure listener is added before potential clicks inside
      document.addEventListener('click', this.closeDestDropdown, { capture: true, once: true });
      // Focus search input when opened
      setTimeout(() => this.querySelector('.fancy-dropdown-header input')?.focus(), 0);
    }
  }

  closeDestDropdown(e) {
    // Check if the click was inside the dropdown menu; if so, don't close
    const dropdownMenu = this.querySelector('.fancy-dropdown-menu');
    if (dropdownMenu && dropdownMenu.contains(e?.target)) {
        // Re-add listener if click was inside, as 'once' removes it
         document.addEventListener('click', this.closeDestDropdown, { capture: true, once: true });
        return;
    }
    this.showDestDropdown = false;
    // No need to remove listener due to 'once: true'
  }


  toggleDestBranch(branch, e) {
    e.stopPropagation(); // Prevent dropdown closing
    const index = this.selectedDestBranches.indexOf(branch);
    let updatedSelection;
    if (index > -1) {
      updatedSelection = this.selectedDestBranches.filter(b => b !== branch);
    } else {
      updatedSelection = [...this.selectedDestBranches, branch].sort(); // Keep sorted
    }
    this._dispatchUpdate('selectedDestBranches', updatedSelection);
  }

  selectAllDestBranches(e) {
    e.stopPropagation();
    const allBranchCodes = Object.keys(this.branches || {}).sort();
    this._dispatchUpdate('selectedDestBranches', [...allBranchCodes]);
  }

  clearDestBranches(e) {
    e.stopPropagation();
    this._dispatchUpdate('selectedDestBranches', []);
  }

  handleDropdownClick(e) {
    // This prevents the closeDestDropdown listener attached to document
    // from closing the dropdown when clicking inside the menu itself.
    e.stopPropagation();
  }


  renderDestinationDropdown() {
    const filteredBranches = this.destSearchTerm
      ? Object.entries(this.branches || {}).filter(([code, name]) =>
          code.includes(this.destSearchTerm) || name.toLowerCase().includes(this.destSearchTerm.toLowerCase()))
      : Object.entries(this.branches || {});

    return html`
      <div class="fancy-dropdown-menu" 
           style="position: absolute; z-index: 99999 !important; top: 100%; left: 0; right: 0;"
           @click=${this.handleDropdownClick}>
        <div class="fancy-dropdown-header" style="z-index: 99998 !important;">
           <input type="text" class="form-control form-control-sm" placeholder="Search branches..."
                 .value=${this.destSearchTerm}
                 @input=${e => this.destSearchTerm = e.target.value}
                 @keydown=${e => e.stopPropagation()} >
        </div>
        <div class="fancy-dropdown-actions">
          <button class="btn btn-sm btn-link py-0" @click=${this.selectAllDestBranches}>Select All</button>
          <button class="btn btn-sm btn-link py-0" @click=${this.clearDestBranches}>Clear All</button>
        </div>
        <div class="fancy-dropdown-items">
          ${filteredBranches.length > 0 ? filteredBranches.map(([code, name]) => html`
            <div class="fancy-dropdown-item">
               <div class="form-check">
                  <input type="checkbox" id="dest-${code}" class="form-check-input"
                         .checked=${this.selectedDestBranches.includes(code)}
                         @change=${e => this.toggleDestBranch(code, e)}>
                  <label class="form-check-label" for="dest-${code}">${code} - ${name}</label>
                </div>
            </div>
          `) : html`<div class="text-muted text-center small p-2">No matches found.</div>`}
        </div>
      </div>
    `;
  }
  // --- End Dropdown Logic ---

  render() {
    const destCount = this.selectedDestBranches?.length || 0;
    const totalBranches = Object.keys(this.branches || {}).length;
    const allSelected = destCount > 0 && destCount === totalBranches;

    return html`
      <div class="card mb-3 border-light shadow-sm query-panel-card">
        <div class="card-body p-3">
          <div class="row g-2">
            <div class="col-lg-9">
              <div class="row g-2 align-items-center">
                <div class="col-md-4">
                  <div class="input-group input-group-sm">
                    <span class="input-group-text">Source</span>
                    <select class="form-select"
                           .value=${this.branchesEmit}
                           @change=${e => this._dispatchUpdate('branchesEmit', e.target.value)}
                           ?disabled=${this.loading}>
                      <option value="">Select source</option>
                      ${Object.entries(this.branches || {}).map(([code, name]) => html`
                        <option value="${code}">${code} - ${name}</option>
                      `)}
                    </select>
                  </div>
                </div>
                <div class="col-md-4">
                  <div class="input-group input-group-sm fancy-dropdown">
                    <span class="input-group-text">Destination</span>
                    <button class="form-select fancy-dropdown-toggle text-start ${allSelected ? 'text-success fw-bold' : ''}"
                            @click=${this.toggleDestinationDropdown} ?disabled=${this.loading}>
                      ${this.getDestBranchesDisplayText()}
                      <span class="badge bg-secondary ms-auto">${destCount}</span>
                    </button>
                    ${this.showDestDropdown ? this.renderDestinationDropdown() : ''}
                  </div>
                </div>
                <div class="col-md-4 d-flex align-items-center justify-content-start">
                  <div class="form-check form-switch me-3" data-bs-toggle="tooltip" data-bs-placement="top"
                       title="Affects data loading: filters items based on necessity conditions at destination">
                    <input class="form-check-input" type="checkbox" id="setConditionForNecesar"
                           .checked=${this.setConditionForNecesar}
                           @change=${e => this._dispatchUpdate('setConditionForNecesar', e.target.checked)}
                           ?disabled=${this.loading}>
                    <label class="form-check-label small" for="setConditionForNecesar">Necesar</label>
                  </div>
                  <div class="form-check form-switch me-3" data-bs-toggle="tooltip" data-bs-placement="top"
                       title="Affects data loading: only shows items with min/max limits defined">
                    <input class="form-check-input" type="checkbox" id="setConditionForLimits"
                           .checked=${this.setConditionForLimits}
                           @change=${e => this._dispatchUpdate('setConditionForLimits', e.target.checked)}
                           ?disabled=${this.loading}>
                    <label class="form-check-label small" for="setConditionForLimits">Limits</label>
                  </div>
                   <button class="btn btn-sm btn-primary" @click=${() => this._emitAction('load-data')} ?disabled=${this.loading}>
                      ${this.loading ?
                        html`<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span> Loading...` :
                        html`<i class="bi bi-arrow-repeat me-1"></i> Load Data`}
                    </button>
                </div>
              </div>
            </div>
            <div class="col-lg-3 text-lg-end">
               <div class="btn-group btn-group-sm">
                  <button class="btn btn-success" @click=${() => this._emitAction('save-data')} ?disabled=${this.loading}>
                    <i class="bi bi-save me-1"></i> Save
                  </button>
                  <button class="btn btn-secondary" @click=${() => this._emitAction('export-data')} ?disabled=${this.loading}>
                    <i class="bi bi-file-excel me-1"></i> Export
                  </button>
                  <button class="btn btn-danger" @click=${() => this._emitAction('reset-data')} ?disabled=${this.loading}
                          data-bs-toggle="tooltip" data-bs-placement="top" title="Clear all data and start over">
                    <i class="bi bi-x-circle me-1"></i> Reset
                  </button>
               </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}
customElements.define('query-panel', QueryPanel);
