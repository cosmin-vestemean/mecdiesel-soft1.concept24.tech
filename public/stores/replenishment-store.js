import { createContext } from 'https://cdn.jsdelivr.net/npm/@lit/context@1.1.0/index.js';

/**
 * Branch Replenishment Store
 * 
 * Centralized state management for the Branch Replenishment module using Lit Context.
 * This store manages all state related to data loading, filtering, strategies, and UI state.
 */

// Create the context for the store
export const ReplenishmentStoreContext = createContext('replenishment-store');

export class ReplenishmentStore {
  constructor() {
    this._listeners = new Set();
    this._state = this._getInitialState();
    this._cachedComputedValues = new Map();
    
    // Bind methods to preserve context
    this.subscribe = this.subscribe.bind(this);
    this.unsubscribe = this.unsubscribe.bind(this);
    this.getState = this.getState.bind(this);
    this.dispatch = this.dispatch.bind(this);
    this._notifyListeners = this._notifyListeners.bind(this);
    this._invalidateCache = this._invalidateCache.bind(this);
    
    console.log('🏪 ReplenishmentStore initialized with state:', this._state);
  }

  // --- Initial State ---
  _getInitialState() {
    return {
      // Data state
      data: [],
      loading: false,
      error: '',
      
      // Source and destination selections
      branchesEmit: '',
      selectedDestBranches: [],
      fiscalYear: new Date().getFullYear(),
      
      // Data loading conditions
      setConditionForNecesar: true,
      setConditionForLimits: true,
      
      // UI state
      queryPanelVisible: true,
      
      // Filtering state
      searchTerm: '',
      materialCodeFilter: '',  // Add material code filter
      materialCodeFilterExclude: false,  // Add material code filter exclude flag
      transferFilter: 'all',
      destinationFilter: 'all',
      abcFilter: 'all',
      blacklistedFilter: 'all',
      lichidareFilter: 'all',
      
      // Number filters (dynamically populated based on column config)
      numberFilters: {},
      
      // Sorting state
      sortColumn: null,
      sortDirection: 'asc',
      
      // Strategy state
      selectedReplenishmentStrategy: 'none',
      isSuccessiveStrategy: true,
      
      // Cached computed values
      uniqueDestinations: [],
      
      // Static data
      branches: {
        '1200': 'CLUJ', '1300': 'CONSTANTA', '1400': 'GALATI',
        '1500': 'PLOIESTI', '1600': 'IASI', '1700': 'SIBIU', '1800': 'CRAIOVA',
        '1900': 'ORADEA', '2000': 'PITESTI', '2100': 'BRASOV', '2200': 'BUCURESTI',
        '2300': 'ARAD', '2400': 'VOLUNTARI', '2600': 'MIHAILESTI', '2700': 'TG. MURES',
        '2800': 'TIMISOARA', '2900': 'RAMNICU VALCEA'
      }
    };
  }

  // --- State Access ---
  getState() {
    return { ...this._state }; // Return a copy to prevent direct mutations
  }

  // --- Subscription Management ---
  subscribe(listener) {
    if (typeof listener !== 'function') {
      throw new Error('Listener must be a function');
    }
    this._listeners.add(listener);
    
    // Return unsubscribe function
    return () => {
      this._listeners.delete(listener);
    };
  }

  unsubscribe(listener) {
    this._listeners.delete(listener);
  }

  _notifyListeners(action, previousState, newState) {
    console.log(`🔄 Store update: ${action.type}`, {
      action,
      previousState,
      newState,
      listenerCount: this._listeners.size
    });
    
    this._listeners.forEach(listener => {
      try {
        listener(newState, previousState, action);
      } catch (error) {
        console.error('Error in store listener:', error);
      }
    });
  }

  // --- Cache Management ---
  _invalidateCache(keys = null) {
    if (keys === null) {
      this._cachedComputedValues.clear();
      return;
    }

    const keysArray = Array.isArray(keys) ? keys : [keys];
    keysArray.forEach(key => {
      if (key === 'filteredData') {
        // Invalidate all cache entries starting with 'filteredData'
        for (const cacheKey of this._cachedComputedValues.keys()) {
          if (cacheKey.startsWith('filteredData')) {
            this._cachedComputedValues.delete(cacheKey);
          }
        }
      } else {
        this._cachedComputedValues.delete(key);
      }
    });
  }

  // --- State Updates (Dispatch) ---
  dispatch(action) {
    if (!action || !action.type) {
      throw new Error('Action must have a type property');
    }

    console.log(`🎯 Dispatching action: ${action.type}`, action);
    
    const previousState = { ...this._state };
    let newState = { ...this._state };
    let cacheKeysToInvalidate = [];

    switch (action.type) {
      case 'SET_LOADING':
        newState.loading = Boolean(action.payload);
        break;

      case 'SET_ERROR':
        newState.error = action.payload || '';
        break;

      case 'SET_DATA':
        newState.data = Array.isArray(action.payload) ? action.payload : [];
        // Ensure each item has a unique keyField
        newState.data = newState.data.map((item, index) => ({
          ...item,
          keyField: item.keyField || `${item.mtrl}-${item.branchD}-${index}`
        }));
        cacheKeysToInvalidate = ['filteredData', 'uniqueDestinations'];
        break;

      case 'UPDATE_ITEM_TRANSFER':
        const { itemKey, transferValue } = action.payload;
        const itemIndex = newState.data.findIndex(item => item.keyField === itemKey);
        if (itemIndex > -1) {
          const newTransferValue = Math.max(0, parseFloat(transferValue || 0));
          if (!isNaN(newTransferValue)) {
            newState.data = [...newState.data];
            newState.data[itemIndex] = { 
              ...newState.data[itemIndex], 
              transfer: newTransferValue 
            };
            cacheKeysToInvalidate = ['filteredData'];
          }
        }
        break;

      case 'SET_BRANCHES_EMIT':
        newState.branchesEmit = action.payload || '';
        break;

      case 'SET_SELECTED_DEST_BRANCHES':
        newState.selectedDestBranches = Array.isArray(action.payload) ? [...action.payload] : [];
        break;

      case 'SET_CONDITION_FOR_NECESAR':
        newState.setConditionForNecesar = Boolean(action.payload);
        break;

      case 'SET_CONDITION_FOR_LIMITS':
        newState.setConditionForLimits = Boolean(action.payload);
        break;

      case 'SET_QUERY_PANEL_VISIBLE':
        newState.queryPanelVisible = Boolean(action.payload);
        break;

      case 'SET_SEARCH_TERM':
        newState.searchTerm = action.payload || '';
        cacheKeysToInvalidate = ['filteredData'];
        break;

      case 'SET_MATERIAL_CODE_FILTER':
        newState.materialCodeFilter = action.payload || '';
        cacheKeysToInvalidate = ['filteredData'];
        break;

      case 'SET_MATERIAL_CODE_FILTER_EXCLUDE':
        newState.materialCodeFilterExclude = Boolean(action.payload);
        cacheKeysToInvalidate = ['filteredData'];
        break;

      case 'SET_TRANSFER_FILTER':
        newState.transferFilter = action.payload || 'all';
        cacheKeysToInvalidate = ['filteredData'];
        break;

      case 'SET_DESTINATION_FILTER':
        newState.destinationFilter = action.payload || 'all';
        cacheKeysToInvalidate = ['filteredData'];
        // NOTE: Destination filter changes do NOT automatically reset searchTerm
        // This maintains separation between UI search and operational destination filtering
        break;

      case 'SET_ABC_FILTER':
        newState.abcFilter = action.payload || 'all';
        cacheKeysToInvalidate = ['filteredData'];
        break;

      case 'SET_BLACKLISTED_FILTER':
        newState.blacklistedFilter = action.payload || 'all';
        cacheKeysToInvalidate = ['filteredData'];
        break;

      case 'SET_LICHIDARE_FILTER':
        newState.lichidareFilter = action.payload || 'all';
        cacheKeysToInvalidate = ['filteredData'];
        break;

      case 'SET_NUMBER_FILTER':
        const { columnKey, filterValue } = action.payload;
        newState.numberFilters = { ...newState.numberFilters, [columnKey]: filterValue || 'all' };
        cacheKeysToInvalidate = ['filteredData'];
        break;

      case 'SET_SORTING':
        newState.sortColumn = action.payload?.column || null;
        newState.sortDirection = action.payload?.direction || 'asc';
        cacheKeysToInvalidate = ['filteredData']; // Re-filter needed for sorted results
        break;

      case 'SET_REPLENISHMENT_STRATEGY':
        newState.selectedReplenishmentStrategy = action.payload || 'none';
        break;

      case 'SET_SUCCESSIVE_STRATEGY':
        newState.isSuccessiveStrategy = Boolean(action.payload);
        break;

      case 'RESET_SEARCH_FILTERS':
        newState.searchTerm = '';
        newState.transferFilter = 'all';
        cacheKeysToInvalidate = ['filteredData'];
        break;

      case 'RESET_ALL_FILTERS':
        newState.searchTerm = '';
        newState.materialCodeFilter = '';
        newState.materialCodeFilterExclude = false;
        newState.transferFilter = 'all';
        newState.destinationFilter = 'all';
        newState.abcFilter = 'all';
        newState.blacklistedFilter = 'all';
        newState.lichidareFilter = 'all';
        newState.numberFilters = {};
        newState.sortColumn = null;
        newState.sortDirection = 'asc';
        newState.selectedReplenishmentStrategy = 'none';
        newState.isSuccessiveStrategy = true;
        cacheKeysToInvalidate = ['filteredData'];
        break;

      case 'RESET_DATA':
        newState.data = [];
        newState.error = '';
        newState.branchesEmit = '';
        newState.selectedDestBranches = [];
        newState.searchTerm = '';
        newState.materialCodeFilter = '';
        newState.materialCodeFilterExclude = false;
        newState.transferFilter = 'all';
        newState.destinationFilter = 'all';
        newState.abcFilter = 'all';
        newState.blacklistedFilter = 'all';
        newState.lichidareFilter = 'all';
        newState.numberFilters = {};
        newState.sortColumn = null;
        newState.sortDirection = 'asc';
        newState.selectedReplenishmentStrategy = 'none';
        newState.isSuccessiveStrategy = true;
        newState.queryPanelVisible = true;
        cacheKeysToInvalidate = ['filteredData', 'uniqueDestinations'];
        break;

      case 'BATCH_UPDATE':
        // Handle multiple updates in a single action
        const updates = action.payload || {};
        Object.keys(updates).forEach(key => {
          if (newState.hasOwnProperty(key)) {
            newState[key] = updates[key];
          }
        });
        cacheKeysToInvalidate = ['filteredData', 'uniqueDestinations'];
        break;

      default:
        console.warn(`Unknown action type: ${action.type}`);
        return; // Don't update state or notify listeners for unknown actions
    }

    // Update state and cache
    this._state = newState;
    this._invalidateCache(cacheKeysToInvalidate);
    
    // Notify listeners
    this._notifyListeners(action, previousState, newState);
  }

  // --- Computed State (Getters with Caching) ---
  getFilteredData(columnConfig = null) {
    // Handle null/undefined columnConfig more gracefully
    if (!columnConfig || !Array.isArray(columnConfig) || columnConfig.length === 0) {
      console.log('⚠️ getFilteredData called with invalid columnConfig:', {
        columnConfig: columnConfig,
        type: typeof columnConfig,
        isArray: Array.isArray(columnConfig),
        length: columnConfig ? columnConfig.length : 0
      });
      // Return unfiltered data if no column config (but still apply basic filters)
      return this._getBasicFilteredData();
    }
    
    // Create a more comprehensive cache key that includes all filter states
    const filterStates = {
      searchTerm: this._state.searchTerm,
      materialCodeFilter: this._state.materialCodeFilter,
      materialCodeFilterExclude: this._state.materialCodeFilterExclude,
      transferFilter: this._state.transferFilter,
      destinationFilter: this._state.destinationFilter,
      abcFilter: this._state.abcFilter,
      blacklistedFilter: this._state.blacklistedFilter,
      lichidareFilter: this._state.lichidareFilter,
      numberFilters: this._state.numberFilters,
      sortColumn: this._state.sortColumn,
      sortDirection: this._state.sortDirection
    };
    
    const cacheKey = `filteredData_${JSON.stringify(filterStates)}`;
    
    console.log('🔍 getFilteredData called. Active filters:', {
      numberFilters: this._state.numberFilters,
      sortColumn: this._state.sortColumn,
      sortDirection: this._state.sortDirection
    });
    
    if (this._cachedComputedValues.has(cacheKey)) {
      console.log('📦 Returning cached filtered data');
      return this._cachedComputedValues.get(cacheKey);
    }

    console.log('🔄 Computing filtered data from scratch');
    return this._computeFilteredData(columnConfig, cacheKey);
  }

  // Helper method to get basic filtered data without column config
  _getBasicFilteredData() {
    let filtered = [...this._state.data];
    
    // Apply search term filter
    if (this._state.searchTerm) {
      const term = this._state.searchTerm.toLowerCase();
      const searchColumns = ['Cod', 'Descriere'];
      filtered = filtered.filter(item =>
        searchColumns.some(key => {
          return item[key] &&
            typeof item[key] === 'string' &&
            item[key].toLowerCase().includes(term);
        })
      );
    }

    // Apply transfer value filter
    if (this._state.transferFilter !== 'all') {
      filtered = filtered.filter(item => {
        const transfer = parseFloat(item.transfer || 0);
        return this._state.transferFilter === 'positive' ? transfer > 0 : transfer === 0;
      });
    }

    console.log('📊 Basic filtered data count:', filtered.length);
    return filtered;
  }

  // Main filtering logic
  _computeFilteredData(columnConfig, cacheKey) {
    let filtered = [...this._state.data];
    console.log('📊 Starting with data items:', filtered.length);
    
    // Apply search term filter
    if (this._state.searchTerm) {
      const term = this._state.searchTerm.toLowerCase();
      const searchColumns = ['Cod', 'Descriere'];
      filtered = filtered.filter(item =>
        searchColumns.some(key => {
          return item[key] &&
            typeof item[key] === 'string' &&
            item[key].toLowerCase().includes(term);
        })
      );
    }

    // Apply transfer value filter
    if (this._state.transferFilter !== 'all') {
      filtered = filtered.filter(item => {
        const transfer = parseFloat(item.transfer || 0);
        return this._state.transferFilter === 'positive' ? transfer > 0 : transfer === 0;
      });
    }

    // Apply destination filter if set and not 'all'
    if (this._state.destinationFilter && this._state.destinationFilter !== 'all') {
      if (columnConfig) {
        const destColumn = columnConfig.find(col => col.isHeaderFilter && col.type === 'string');
        if (destColumn) {
          filtered = filtered.filter(item => item[destColumn.key] === this._state.destinationFilter);
        }
      } else {
        // Fallback to common destination field
        const destColKey = 'Destinatie';
        filtered = filtered.filter(item => item[destColKey] === this._state.destinationFilter);
      }
    }

    // Apply ABC classification filter
    if (this._state.abcFilter && this._state.abcFilter !== 'all') {
      filtered = filtered.filter(item => {
        const abcValue = item.abc_class;
        if (this._state.abcFilter === 'none') {
          return !abcValue || abcValue === '' || abcValue === null || abcValue === undefined;
        } else if (this._state.abcFilter === 'abc') {
          // Show only items with ABC classifications (A, B, C) - exclude None/empty values
          return abcValue === 'A' || abcValue === 'B' || abcValue === 'C';
        } else {
          return abcValue === this._state.abcFilter;
        }
      });
    }

    // Apply Blacklisted filter
    if (this._state.blacklistedFilter && this._state.blacklistedFilter !== 'all') {
      filtered = filtered.filter(item => {
        const blacklistedValue = item.Blacklisted;
        if (this._state.blacklistedFilter === 'yes') {
          // Handle multiple formats: true, 1, '1', 'true', 'Da', 'Yes'
          return blacklistedValue === true || 
                 blacklistedValue === 1 || 
                 blacklistedValue === '1' || 
                 blacklistedValue === 'true' ||
                 (typeof blacklistedValue === 'string' && 
                  (blacklistedValue.toLowerCase() === 'da' || blacklistedValue.toLowerCase() === 'yes'));
        } else if (this._state.blacklistedFilter === 'no') {
          // Handle multiple formats: false, 0, '0', 'false', 'Nu', 'No', '-' AND null/undefined/empty
          return blacklistedValue === false || 
                 blacklistedValue === 0 || 
                 blacklistedValue === '0' || 
                 blacklistedValue === 'false' ||
                 blacklistedValue === null || 
                 blacklistedValue === undefined || 
                 blacklistedValue === '' ||
                 (typeof blacklistedValue === 'string' && 
                  (blacklistedValue.toLowerCase() === 'nu' || 
                   blacklistedValue.toLowerCase() === 'no' || 
                   blacklistedValue === '-'));
        }
        return true;
      });
    }

    // Apply InLichidare filter
    if (this._state.lichidareFilter && this._state.lichidareFilter !== 'all') {
      filtered = filtered.filter(item => {
        const lichidareValue = item.InLichidare;
        if (this._state.lichidareFilter === 'yes') {
          // Handle multiple formats: true, 1, '1', 'true', 'Da', 'Yes'
          return lichidareValue === true || 
                 lichidareValue === 1 || 
                 lichidareValue === '1' || 
                 lichidareValue === 'true' ||
                 (typeof lichidareValue === 'string' && 
                  (lichidareValue.toLowerCase() === 'da' || lichidareValue.toLowerCase() === 'yes'));
        } else if (this._state.lichidareFilter === 'no') {
          // Handle multiple formats: false, 0, '0', 'false', 'Nu', 'No', '-' AND null/undefined/empty
          return lichidareValue === false || 
                 lichidareValue === 0 || 
                 lichidareValue === '0' || 
                 lichidareValue === 'false' ||
                 lichidareValue === null || 
                 lichidareValue === undefined || 
                 lichidareValue === '' ||
                 (typeof lichidareValue === 'string' && 
                  (lichidareValue.toLowerCase() === 'nu' || 
                   lichidareValue.toLowerCase() === 'no' || 
                   lichidareValue === '-'));
        }
        return true;
      });
    }

    // Apply all number filters
    console.log('🔍 Number filter entry check:', {
      hasColumnConfig: !!columnConfig,
      numberFiltersKeys: Object.keys(this._state.numberFilters),
      numberFiltersCount: Object.keys(this._state.numberFilters).length,
      numberFilters: JSON.stringify(this._state.numberFilters),
      columnConfigLength: columnConfig ? columnConfig.length : 0
    });
    
    if (columnConfig && Object.keys(this._state.numberFilters).length > 0) {
      filtered = this._applyNumberFilters(filtered, columnConfig);
    }

    // Apply sorting if enabled
    if (this._state.sortColumn && columnConfig) {
      console.log(`🔄 Applying sorting: ${this._state.sortColumn} ${this._state.sortDirection}`);
      const sortColumn = columnConfig.find(col => col.key === this._state.sortColumn);
      if (sortColumn) {
        filtered = this._sortData(filtered, sortColumn);
        console.log(`✅ Sorting applied`);
      } else {
        console.log(`⚠️ Sort column not found in config: ${this._state.sortColumn}`);
      }
    }

    // Cache and return the result
    this._cachedComputedValues.set(cacheKey, filtered);
    console.log('✅ Final filtered data count:', filtered.length);
    return filtered;
  }

  // Helper method to apply number filters
  _applyNumberFilters(filtered, columnConfig) {
    const allNumberFilters = Object.entries(this._state.numberFilters);
    console.log('🔍 All number filter entries:', allNumberFilters);
    
    const activeNumberFilters = allNumberFilters
      .filter(([, value]) => {
        const isActive = value && value !== 'all';
        console.log(`🔍 Filter check: value="${value}", type=${typeof value}, isActive=${isActive}`);
        return isActive;
      });

    console.log('🔍 Number filter check:', {
      hasColumnConfig: !!columnConfig,
      numberFiltersCount: Object.keys(this._state.numberFilters).length,
      numberFilters: JSON.stringify(this._state.numberFilters),
      allNumberFilters: JSON.stringify(allNumberFilters),
      activeNumberFilters: JSON.stringify(activeNumberFilters),
      activeCount: activeNumberFilters.length
    });

    if (activeNumberFilters.length > 0) {
      console.log('🔍 ENTERING number filter logic with:', JSON.stringify(activeNumberFilters));
      
      // Get the valid number filter columns from the configuration
      const validFilterKeys = columnConfig
        .filter(col => col.type === 'number' && col.isHeaderFilter && col.visible)
        .map(col => col.key);
      
      console.log('📊 Valid number filter columns:', validFilterKeys);
      
      const initialCount = filtered.length;
      
      filtered = filtered.filter(item => {
        const result = activeNumberFilters.every(([key, filterValue]) => {
          // Apply filter only if the key is for a valid, visible number filter column
          if (!validFilterKeys.includes(key)) {
            console.log(`⚠️ Skipping filter for invalid column: ${key}`);
            return true; // Ignore filters for invalid or hidden columns
          }

          // Get the raw value for this column
          const rawValue = item[key];
          
          // Handle cases where the item's value for the key is null, undefined, or empty string
          if (rawValue === null || rawValue === undefined || rawValue === '') {
            // For null/undefined/empty values, exclude from all number filters
            // Only actual numeric zero should match the zero filter
            console.log(`🔍 Null/undefined value for ${key}: rawValue=${rawValue}, filterValue=${filterValue}, shouldInclude=false`);
            return false;
          }

          // Parse the numeric value
          const value = parseFloat(rawValue);
          
          // If the value is not a valid number, exclude it from all filters
          if (isNaN(value)) {
            console.log(`⚠️ Invalid number for ${key}: rawValue=${rawValue}, parsed=${value}`);
            return false;
          }

          // Apply the specific filter
          let shouldInclude = true;
          switch (filterValue) {
            case 'positive': 
              shouldInclude = value > 0;
              break;
            case 'negative': 
              shouldInclude = value < 0;
              break;
            case 'zero': 
              shouldInclude = value === 0;
              break;
            default: 
              shouldInclude = true;
          }
          
          console.log(`🔍 Filter check for ${key}: value=${value}, filterValue=${filterValue}, shouldInclude=${shouldInclude}`);
          return shouldInclude;
        });
        
        return result;
      });
      
      console.log(`🔍 Number filter results: ${initialCount} -> ${filtered.length} items`);
    }

    return filtered;
  }

  // --- Sorting Helper ---
  _sortData(data, sortColumn) {
    if (!data || data.length === 0) return data;
    
    return [...data].sort((a, b) => {
      let aVal = a[this._state.sortColumn];
      let bVal = b[this._state.sortColumn];
      
      // Handle different data types
      switch (sortColumn.type) {
        case 'number':
          aVal = parseFloat(aVal) || 0;
          bVal = parseFloat(bVal) || 0;
          break;
        case 'boolean':
          // Convert various boolean formats to actual booleans for comparison
          aVal = this._parseBooleanValue(aVal);
          bVal = this._parseBooleanValue(bVal);
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
      
      return this._state.sortDirection === 'desc' ? -comparison : comparison;
    });
  }

  // --- Boolean value parsing helper ---
  _parseBooleanValue(value) {
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

  getUniqueDestinations() {
    const cacheKey = 'uniqueDestinations';
    
    if (this._cachedComputedValues.has(cacheKey)) {
      return this._cachedComputedValues.get(cacheKey);
    }

    if (!this._state.data || this._state.data.length === 0) {
      const emptyResult = [];
      this._cachedComputedValues.set(cacheKey, emptyResult);
      return emptyResult;
    }

    // Find the destination column (this would come from column config)
    const destColKey = 'Destinatie'; // This should be configurable
    const unique = [...new Set(this._state.data.map(item => item[destColKey]))].sort();
    
    this._cachedComputedValues.set(cacheKey, unique);
    return unique;
  }

  // --- Action Creators (Convenience Methods) ---
  setLoading(loading) {
    this.dispatch({ type: 'SET_LOADING', payload: loading });
  }

  setError(error) {
    this.dispatch({ type: 'SET_ERROR', payload: error });
  }

  setData(data) {
    this.dispatch({ type: 'SET_DATA', payload: data });
  }

  updateItemTransfer(itemKey, transferValue) {
    this.dispatch({ 
      type: 'UPDATE_ITEM_TRANSFER', 
      payload: { itemKey, transferValue } 
    });
  }

  setBranchesEmit(branchesEmit) {
    this.dispatch({ type: 'SET_BRANCHES_EMIT', payload: branchesEmit });
  }

  setSelectedDestBranches(branches) {
    this.dispatch({ type: 'SET_SELECTED_DEST_BRANCHES', payload: branches });
  }

  setConditionForNecesar(condition) {
    this.dispatch({ type: 'SET_CONDITION_FOR_NECESAR', payload: condition });
  }

  setConditionForLimits(condition) {
    this.dispatch({ type: 'SET_CONDITION_FOR_LIMITS', payload: condition });
  }

  setQueryPanelVisible(visible) {
    this.dispatch({ type: 'SET_QUERY_PANEL_VISIBLE', payload: visible });
  }

  setSearchTerm(term) {
    this.dispatch({ type: 'SET_SEARCH_TERM', payload: term });
  }

  setMaterialCodeFilter(filter) {
    this.dispatch({ type: 'SET_MATERIAL_CODE_FILTER', payload: filter });
  }

  setMaterialCodeFilterExclude(exclude) {
    this.dispatch({ type: 'SET_MATERIAL_CODE_FILTER_EXCLUDE', payload: exclude });
  }

  setTransferFilter(filter) {
    this.dispatch({ type: 'SET_TRANSFER_FILTER', payload: filter });
  }

  setDestinationFilter(filter) {
    this.dispatch({ type: 'SET_DESTINATION_FILTER', payload: filter });
  }

  setAbcFilter(filter) {
    this.dispatch({ type: 'SET_ABC_FILTER', payload: filter });
  }

  setBlacklistedFilter(filter) {
    this.dispatch({ type: 'SET_BLACKLISTED_FILTER', payload: filter });
  }

  setLichidareFilter(filter) {
    this.dispatch({ type: 'SET_LICHIDARE_FILTER', payload: filter });
  }

  setNumberFilter(columnKey, filterValue) {
    this.dispatch({ type: 'SET_NUMBER_FILTER', payload: { columnKey, filterValue } });
  }

  setSorting(column, direction) {
    this.dispatch({ type: 'SET_SORTING', payload: { column, direction } });
  }

  setReplenishmentStrategy(strategy) {
    this.dispatch({ type: 'SET_REPLENISHMENT_STRATEGY', payload: strategy });
  }

  setSuccessiveStrategy(successive) {
    this.dispatch({ type: 'SET_SUCCESSIVE_STRATEGY', payload: successive });
  }

  resetSearchFilters() {
    // Reset only UI search filters that operate on already loaded data
    // Does NOT reset data loading parameters like materialCodeFilter, branchesEmit, etc.
    this.dispatch({ type: 'RESET_SEARCH_FILTERS' });
  }

  resetAllFilters() {
    this.dispatch({ type: 'RESET_ALL_FILTERS' });
  }

  resetData() {
    this.dispatch({ type: 'RESET_DATA' });
  }

  batchUpdate(updates) {
    this.dispatch({ type: 'BATCH_UPDATE', payload: updates });
  }

  // --- Utility Methods ---
  destroy() {
    this._listeners.clear();
    this._cachedComputedValues.clear();
    console.log('🏪 ReplenishmentStore destroyed');
  }

  // --- Filter Interaction Helper ---
  getFilterInteractionInfo() {
    const currentState = this._state;
    
    // Check if we have any active filters
    const hasActiveSearchTerm = currentState.searchTerm && currentState.searchTerm.trim() !== '';
    const hasActiveDestinationFilter = currentState.destinationFilter && currentState.destinationFilter !== 'all';
    const hasOtherFilters = currentState.transferFilter !== 'all' || 
                           currentState.abcFilter !== 'all' || 
                           currentState.blacklistedFilter !== 'all' || 
                           currentState.lichidareFilter !== 'all' ||
                           Object.keys(currentState.numberFilters).some(key => currentState.numberFilters[key] !== 'all');

    if (!hasActiveSearchTerm && !hasActiveDestinationFilter && !hasOtherFilters) {
      return {
        hasFilters: false,
        message: null,
        suggestedAction: null
      };
    }

    // Get current filtered data count
    const filteredData = this.getFilteredData();
    const totalData = currentState.data.length;
    
    if (filteredData.length === 0 && totalData > 0) {
      // No results with current filters
      let message = 'No results found with current filters.';
      let suggestedAction = 'reset_all';
      
      if (hasActiveSearchTerm && hasActiveDestinationFilter) {
        message = `No items match "${currentState.searchTerm}" in destination "${currentState.destinationFilter}".`;
        suggestedAction = 'reset_search_or_destination';
      } else if (hasActiveSearchTerm) {
        message = `No items match "${currentState.searchTerm}".`;
        suggestedAction = 'reset_search';
      } else if (hasActiveDestinationFilter) {
        message = `No items found for destination "${currentState.destinationFilter}".`;
        suggestedAction = 'reset_destination';
      }
      
      return {
        hasFilters: true,
        hasResults: false,
        message,
        suggestedAction,
        activeFilters: {
          searchTerm: hasActiveSearchTerm ? currentState.searchTerm : null,
          destinationFilter: hasActiveDestinationFilter ? currentState.destinationFilter : null,
          hasOthers: hasOtherFilters
        }
      };
    }
    
    return {
      hasFilters: true,
      hasResults: true,
      resultCount: filteredData.length,
      totalCount: totalData,
      message: null,
      activeFilters: {
        searchTerm: hasActiveSearchTerm ? currentState.searchTerm : null,
        destinationFilter: hasActiveDestinationFilter ? currentState.destinationFilter : null,
        hasOthers: hasOtherFilters
      }
    };
  }

  // Helper methods for independent filter resets
  resetSearchOnly() {
    this.dispatch({ type: 'SET_SEARCH_TERM', payload: '' });
  }

  resetDestinationOnly() {
    this.dispatch({ type: 'SET_DESTINATION_FILTER', payload: 'all' });
  }
}

// Create and export a singleton instance
export const replenishmentStore = new ReplenishmentStore();

// Export action types for external use
export const ActionTypes = {
  SET_LOADING: 'SET_LOADING',
  SET_ERROR: 'SET_ERROR',
  SET_DATA: 'SET_DATA',
  UPDATE_ITEM_TRANSFER: 'UPDATE_ITEM_TRANSFER',
  SET_BRANCHES_EMIT: 'SET_BRANCHES_EMIT',
  SET_SELECTED_DEST_BRANCHES: 'SET_SELECTED_DEST_BRANCHES',
  SET_CONDITION_FOR_NECESAR: 'SET_CONDITION_FOR_NECESAR',
  SET_CONDITION_FOR_LIMITS: 'SET_CONDITION_FOR_LIMITS',
  SET_QUERY_PANEL_VISIBLE: 'SET_QUERY_PANEL_VISIBLE',
  SET_SEARCH_TERM: 'SET_SEARCH_TERM',
  SET_MATERIAL_CODE_FILTER: 'SET_MATERIAL_CODE_FILTER',
  SET_TRANSFER_FILTER: 'SET_TRANSFER_FILTER',
  SET_DESTINATION_FILTER: 'SET_DESTINATION_FILTER',
  SET_ABC_FILTER: 'SET_ABC_FILTER',
  SET_BLACKLISTED_FILTER: 'SET_BLACKLISTED_FILTER',
  SET_LICHIDARE_FILTER: 'SET_LICHIDARE_FILTER',
  SET_NUMBER_FILTER: 'SET_NUMBER_FILTER',
  SET_SORTING: 'SET_SORTING',
  SET_REPLENISHMENT_STRATEGY: 'SET_REPLENISHMENT_STRATEGY',
  SET_SUCCESSIVE_STRATEGY: 'SET_SUCCESSIVE_STRATEGY',
  RESET_SEARCH_FILTERS: 'RESET_SEARCH_FILTERS',
  RESET_ALL_FILTERS: 'RESET_ALL_FILTERS',
  RESET_DATA: 'RESET_DATA',
  BATCH_UPDATE: 'BATCH_UPDATE'
};
