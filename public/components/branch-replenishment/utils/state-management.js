/**
 * State management class for branch replenishment
 * Handles data operations and state changes separate from UI
 */
export class BranchReplenishmentState {
  constructor() {
    this.data = [];
    this.branchesEmit = '';
    this.branchesDest = '';
    this.selectedDestBranches = [];
    this.fiscalYear = new Date().getFullYear();
    this.loading = false;
    this.error = '';
    
    // Filters
    this.filters = {
      searchTerm: '',
      destSearchTerm: '',
      transferFilter: 'all',
      destinationFilter: 'all',
      stockStatusFilter: 'all',
    };

    // Configuration
    this.config = {
      setConditionForNecesar: true,
      setConditionForLimits: true,
      isSuccessiveStrategy: true,
      selectedReplenishmentStrategy: 'none',
      viewMode: 'normal', // 'normal' or 'zen'
      showDestDropdown: false,
    };

    // Branch data
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

  /**
   * Get destination branches as comma-separated string
   * @returns {string} Comma-separated branch codes
   */
  getDestBranchesString() {
    return this.selectedDestBranches.join(',');
  }

  /**
   * Get user-friendly display text for selected branches
   * @returns {string} Text describing selected branches
   */
  getDestBranchesDisplayText() {
    if (this.selectedDestBranches.length === 0) return 'Select branches';
    if (this.selectedDestBranches.length === 1) {
      const code = this.selectedDestBranches[0];
      return `${code} - ${this.branches[code] || ''}`;
    }
    return `${this.selectedDestBranches.length} branches selected`;
  }

  /**
   * Toggle selection of a destination branch
   * @param {string} branch - Branch code to toggle
   * @returns {Array} Updated selected branches
   */
  toggleDestBranch(branch) {
    const index = this.selectedDestBranches.indexOf(branch);
    if (index > -1) {
      this.selectedDestBranches = [
        ...this.selectedDestBranches.slice(0, index),
        ...this.selectedDestBranches.slice(index + 1)
      ];
    } else {
      this.selectedDestBranches = [...this.selectedDestBranches, branch];
    }
    return this.selectedDestBranches;
  }

  /**
   * Select all destination branches
   * @returns {Array} Updated selected branches (all branches)
   */
  selectAllDestBranches() {
    const allBranchCodes = Object.keys(this.branches);
    this.selectedDestBranches = [...allBranchCodes];
    return this.selectedDestBranches;
  }

  /**
   * Clear all selected destination branches
   * @returns {Array} Empty array of selected branches
   */
  clearDestBranches() {
    this.selectedDestBranches = [];
    return this.selectedDestBranches;
  }

  /**
   * Handle transfer quantity change for an item
   * @param {Object} item - Item to update
   * @param {number} value - New transfer value
   */
  updateTransferValue(item, value) {
    item.transfer = parseFloat(value || 0);
    return item;
  }
  
  /**
   * Apply replenishment strategy to data
   * @param {string} strategy - Strategy name
   * @param {boolean} isSuccessive - Whether to apply only to zero transfers
   * @param {Function} filterFn - Function to filter data before applying strategy
   */
  applyReplenishmentStrategy(strategy, isSuccessive, filterFn) {
    if (!this.data || !this.data.length) return;
    
    const applyToItems = isSuccessive
      ? filterFn().filter(item => parseFloat(item.transfer || 0) === 0)
      : filterFn();

    switch (strategy) {
      case 'min':
        this.applyMinQuantities(applyToItems);
        break;
      case 'max':
        this.applyMaxQuantities(applyToItems);
        break;
      case 'skip_blacklisted':
        this.skipBlacklisted(applyToItems);
        break;
      case 'clear':
        this.clearTransfers(filterFn());
        break;
    }
    
    return this.data;
  }

  /**
   * Apply minimum quantities to selected items
   * @param {Array} items - Items to apply strategy to
   */
  applyMinQuantities(items) {
    items.forEach(item => {
      if (item.Blacklisted === '-') {
        const minQty = parseFloat(item.cant_min);
        item.transfer = minQty > 0 ? minQty : 0;
      }
    });
  }

  /**
   * Apply maximum quantities to selected items
   * @param {Array} items - Items to apply strategy to
   */
  applyMaxQuantities(items) {
    items.forEach(item => {
      if (item.Blacklisted === '-') {
        const maxQty = parseFloat(item.cant_max);
        item.transfer = maxQty > 0 ? maxQty : 0;
      }
    });
  }

  /**
   * Skip blacklisted items (set transfer to 0)
   * @param {Array} items - Items to apply strategy to
   */
  skipBlacklisted(items) {
    items.forEach(item => {
      if (item.Blacklisted !== '-') {
        item.transfer = 0;
      }
    });
  }

  /**
   * Clear all transfers for selected items
   * @param {Array} items - Items to clear transfers for
   */
  clearTransfers(items) {
    items.forEach(item => {
      item.transfer = 0;
    });
  }

  /**
   * Update a filter value
   * @param {string} filterName - Name of filter to update
   * @param {string} value - New filter value
   */
  updateFilter(filterName, value) {
    if (Object.prototype.hasOwnProperty.call(this.filters, filterName)) {
      this.filters[filterName] = value;
    }
    return this.filters;
  }
  
  /**
   * Update a configuration value
   * @param {string} configName - Name of config to update
   * @param {any} value - New config value
   */
  updateConfig(configName, value) {
    if (Object.prototype.hasOwnProperty.call(this.config, configName)) {
      this.config[configName] = value;
    }
    return this.config;
  }
  
  /**
   * Toggle zen view mode
   * @returns {string} New view mode
   */
  toggleZenMode() {
    this.config.viewMode = this.config.viewMode === 'zen' ? 'normal' : 'zen';
    return this.config.viewMode;
  }
}