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
import './strategy-bar.js'; // New horizontal strategy bar
import './data-table.js';
import './s1-transfer-modal.js';
import './diagnostic-modal.js';

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
      materialCodeFilter: { type: String },
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
      debugMode: { type: Boolean },
      diagnostics: { type: Array },

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
    this.materialCodeFilter = state.materialCodeFilter;
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
    this.debugMode = state.debugMode;
    this.diagnostics = state.diagnostics;
    
    console.log('📦 Container synced from store - branchesEmit:', this.branchesEmit, 'selectedDestBranches:', this.selectedDestBranches);
  }

  // --- Data Fetching and Actions ---
  async _handleLoadData() {
    replenishmentStore.setLoading(true);
    replenishmentStore.setError('');
    
    // Only reset search-related filters, not all filters
    replenishmentStore.resetSearchFilters();
    
    // Clear previous diagnostics
    replenishmentStore.clearDiagnostics();
    
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
        setConditionForLimits: currentState.setConditionForLimits,
        materialCodeFilter: currentState.materialCodeFilter || null,  // Add material code filter
        materialCodeFilterExclude: currentState.materialCodeFilterExclude !== undefined ? currentState.materialCodeFilterExclude : false,  // Add material code filter exclude
        debug: currentState.debugMode  // Add debug mode parameter
      });

      // Handle response structure (backward compatibility)
      let dataRows, diagnostics;
      
      if (Array.isArray(response)) {
        // Old format (backward compatibility)
        dataRows = response;
        diagnostics = [];
      } else if (response.rows && Array.isArray(response.rows)) {
        // New format with diagnostics
        dataRows = response.rows;
        diagnostics = response.diagnostics || [];
      } else {
        // Unexpected format
        throw new Error('Invalid response format from server');
      }

      // Set data in store
      replenishmentStore.setData(dataRows);
      
      // Set diagnostics if debug mode was enabled (always set, even if empty, to clear previous diagnostics)
      if (currentState.debugMode) {
        replenishmentStore.setDiagnostics(diagnostics);
        console.log(`🐛 Debug: ${diagnostics.length} diagnostic entries received`);
        
        if (diagnostics.length > 0) {
          console.log('🐛 Debug: First diagnostic entry:', diagnostics[0]);
        }
      } else {
        // Clear diagnostics if debug mode is disabled
        replenishmentStore.setDiagnostics([]);
      }

      // Hide query panel after successfully loading data
      replenishmentStore.setQueryPanelVisible(false);

      // Dispatch custom event to indicate data has been loaded
      this.dispatchEvent(new CustomEvent('data-loaded', {
        bubbles: true,
        composed: true,
        detail: { 
          dataCount: dataRows.length,
          diagnosticsCount: diagnostics.length,
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
          diagnosticsCount: 0,
          filtersReset: true,
          error: error.message
        }
      }));
    } finally {
      replenishmentStore.setLoading(false);
    }
  }

  async _handleSaveData() {
    console.log('🚀 [LOADING STATE] Starting SoftOne transfer process...');
    console.log('🚀 [LOADING STATE] Current loading state:', replenishmentStore.getState().loading);
    
    try {
      // Validate we have necessary data
      const currentState = replenishmentStore.getState();
      console.log('🔍 [LOADING STATE] Validating data...');
      
      if (!currentState.data || currentState.data.length === 0) {
        console.log('❌ [LOADING STATE] No data available - showing alert');
        alert('Nu există date pentru transfer. Vă rugăm să încărcați datele mai întâi.');
        return;
      }

      if (!currentState.branchesEmit) {
        console.log('❌ [LOADING STATE] No source branch - showing alert');
        alert('Nu este selectată filiala emitentă. Vă rugăm să selectați o filială sursă.');
        return;
      }

      if (!currentState.selectedDestBranches || currentState.selectedDestBranches.length === 0) {
        console.log('❌ [LOADING STATE] No destination branches - showing alert');
        alert('Nu sunt selectate filiale destinație. Vă rugăm să selectați cel puțin o filială destinație.');
        return;
      }

      // Prepare transfer orders by destination branch
      console.log('📋 [LOADING STATE] Preparing transfer orders...');
      const transferOrders = this._prepareTransferOrders();
      
      if (transferOrders.length === 0) {
        console.log('❌ [LOADING STATE] No transfer orders - showing alert');
        alert('Nu există produse cu cantități de transfer > 0. Vă rugăm să aplicați o strategie sau să completați manual cantitățile.');
        return;
      }

      // Show confirmation dialog
      console.log('💬 [LOADING STATE] Showing confirmation dialog...');
      if (!await this._showConfirmationDialog(transferOrders)) {
        console.log('🚫 [LOADING STATE] Transfer cancelled by user');
        return;
      }

      // Process transfers - this already has its own try/catch/finally
      console.log('🚀 [LOADING STATE] Starting transfer processing...');
      console.log('🚀 [LOADING STATE] Loading state before _processSoftOneTransfers:', replenishmentStore.getState().loading);
      
      await this._processSoftOneTransfers(transferOrders);
      
      console.log('✅ [LOADING STATE] Transfer processing completed');
      console.log('✅ [LOADING STATE] Final loading state:', replenishmentStore.getState().loading);
      
    } catch (error) {
      console.error('❌ [LOADING STATE] Error in _handleSaveData:', error);
      console.log('❌ [LOADING STATE] Setting error and clearing loading state...');
      replenishmentStore.setError(`Transfer error: ${error.message}`);
      replenishmentStore.setLoading(false);
      console.log('❌ [LOADING STATE] Loading state after error:', replenishmentStore.getState().loading);
    }
  }

  /**
   * Prepare transfer orders grouped by destination branch
   * Only includes orders with items that have transfer > 0
   */
  _prepareTransferOrders() {
    const currentState = replenishmentStore.getState();
    const transferOrders = [];

    // Group transfers by destination branch
    currentState.selectedDestBranches.forEach(destBranch => {
      const itemsForDest = currentState.data.filter(item => {
        const hasTransfer = parseFloat(item.transfer || 0) > 0;
        const isCorrectDestination = item.branchD === destBranch;
        
        // Only include if has transfer quantity and correct destination
        // Note: Blacklisted items are included if user manually set transfer quantity
        // This respects the user's decision to override blacklist status
        return hasTransfer && isCorrectDestination;
      });

      // Only create order if we have items with transfer > 0
      if (itemsForDest.length > 0) {
        const totalItems = itemsForDest.length;
        const totalQuantity = itemsForDest.reduce((sum, item) => sum + parseFloat(item.transfer || 0), 0);
        
        // Count blacklisted items that user chose to include
        const blacklistedItems = itemsForDest.filter(item => this.isItemBlacklisted(item));
        
        transferOrders.push({
          destinationBranch: destBranch,
          destinationName: this.branches[destBranch] || destBranch,
          sourceBranch: currentState.branchesEmit,
          sourceName: this.branches[currentState.branchesEmit] || currentState.branchesEmit,
          items: itemsForDest,
          totalItems,
          totalQuantity,
          blacklistedItemsCount: blacklistedItems.length,
          status: 'pending'
        });
        
        if (blacklistedItems.length > 0) {
          console.log(`⚠️  Order for ${this.branches[destBranch]} includes ${blacklistedItems.length} blacklisted items - user override detected`);
        }
      }
    });

    console.log(`📋 Prepared ${transferOrders.length} transfer orders:`, transferOrders);
    return transferOrders;
  }

  /**
   * Show confirmation dialog with transfer summary using the new modal
   */
  async _showConfirmationDialog(transferOrders) {
    try {
      // Get current token
      const token = await this.acquireS1Token();
      
      // Create modal if it doesn't exist
      let modal = document.querySelector('s1-transfer-modal');
      if (!modal) {
        modal = document.createElement('s1-transfer-modal');
        document.body.appendChild(modal);
      }

      // Show confirmation
      modal.showConfirmation(transferOrders, token);

      return new Promise((resolve) => {
        const handleConfirmed = () => {
          cleanup();
          resolve(true);
        };

        const handleCancelled = () => {
          cleanup();
          resolve(false);
        };

        const cleanup = () => {
          modal.removeEventListener('confirmed', handleConfirmed);
          modal.removeEventListener('cancelled', handleCancelled);
        };

        modal.addEventListener('confirmed', handleConfirmed);
        modal.addEventListener('cancelled', handleCancelled);
      });
    } catch (error) {
      console.error('Error showing confirmation dialog:', error);
      // Fallback to old alert-based confirmation
      return confirm('Confirmați transferul în SoftOne?');
    }
  }

  /**
   * Process all transfer orders to SoftOne with modal integration
   */
  async _processSoftOneTransfers(transferOrders) {
    console.log('🔄 [LOADING STATE] Starting SoftOne transfers processing...');
    console.log('🔄 [LOADING STATE] Transfer orders:', transferOrders);
    
    // Set loading state
    console.log('🔄 [LOADING STATE] Setting loading to TRUE...');
    replenishmentStore.setLoading(true);
    console.log('🔄 [LOADING STATE] Loading state after setting to true:', replenishmentStore.getState().loading);
    replenishmentStore.setError('');

    const results = [];
    let successCount = 0;
    let errorCount = 0;
    
    // Get modal reference
    let modal = document.querySelector('s1-transfer-modal');
    if (!modal) {
      modal = document.createElement('s1-transfer-modal');
      document.body.appendChild(modal);
    }

    // Setup modal event listeners
    this._setupModalEventListeners(modal);

    // Start processing in modal
    modal.startProcessing();
    
    // Add timeout protection (30 minutes max for all transfers)
    const TOTAL_TIMEOUT_MS = 30 * 60 * 1000;
    console.log(`⏰ [LOADING STATE] Setting ${TOTAL_TIMEOUT_MS/1000/60} minute timeout...`);
    const timeoutId = setTimeout(() => {
      console.error('⏰ [LOADING STATE] Transfer process timeout reached (30 minutes)');
      console.log('⏰ [LOADING STATE] Timeout - setting error and clearing loading...');
      replenishmentStore.setError('Transfer timeout: Process took too long to complete');
      replenishmentStore.setLoading(false);
      console.log('⏰ [LOADING STATE] Timeout - loading state after clearing:', replenishmentStore.getState().loading);
    }, TOTAL_TIMEOUT_MS);

    try {
      console.log(`🔄 [LOADING STATE] Processing ${transferOrders.length} orders...`);
      
      // Process each order sequentially to avoid overwhelming the server
      for (let i = 0; i < transferOrders.length; i++) {
        const order = transferOrders[i];
        console.log(`📤 [DEBUG] Processing order ${i + 1}/${transferOrders.length} for ${order.destinationName}...`);

        // Update modal with processing status
        modal.updateProgress(i, 'processing');

        try {
          console.log(`📤 [DEBUG] Calling _sendSingleTransferOrder for ${order.destinationName}...`);
          const result = await this._sendSingleTransferOrder(order);
          console.log(`📥 [DEBUG] Received result for ${order.destinationName}:`, result);
          
          if (result.success) {
            successCount++;
            console.log(`✅ [DEBUG] Order ${i + 1} successful: ID ${result.id}`);
            modal.updateProgress(i, 'success', result);
          } else {
            errorCount++;
            console.error(`❌ [DEBUG] Order ${i + 1} failed:`, result.message || 'Unknown error');
            
            // Enhanced error details for modal
            const enhancedError = await this._enhanceErrorDetails(result);
            modal.updateProgress(i, 'failed', enhancedError);
          }
          
          results.push({
            order,
            result,
            orderNumber: i + 1
          });

        } catch (error) {
          errorCount++;
          console.error(`❌ [DEBUG] Order ${i + 1} failed with exception:`, error);
          
          // Build structured error for consistency with SoftOne responses
          const errorResult = { 
            success: false, 
            message: `Exception during transfer: ${error.message}`,
            messages: [`Exception during transfer`, error.message || 'Unknown error'],
            error: error.code || error.response?.code || -1, // Error code for lookup
            originalError: error,
            // Additional context
            destinationName: order.destinationName,
            orderInfo: {
              destination: order.destinationName,
              items: order.details?.length || 0,
              totalQuantity: order.details?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0
            }
          };
          
          const enhancedError = await this._enhanceErrorDetails(errorResult);
          modal.updateProgress(i, 'failed', enhancedError);
          
          results.push({
            order,
            result: errorResult,
            orderNumber: i + 1
          });
        }

        // Small delay between requests to be gentle on the server
        if (i < transferOrders.length - 1) {
          console.log(`⏳ [DEBUG] Waiting 500ms before next request...`);
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      console.log(`📊 [DEBUG] All orders processed. Success: ${successCount}, Errors: ${errorCount}`);
      console.log(`📊 [DEBUG] Results:`, results);

      // Show final results in modal
      console.log(`📊 [LOADING STATE] Showing modal results...`);
      modal.showResults();
      console.log(`📊 [LOADING STATE] Modal results displayed.`);

    } catch (error) {
      console.error(`❌ [LOADING STATE] Critical error in _processSoftOneTransfers:`, error);
      console.log(`❌ [LOADING STATE] Setting error message and preparing to clear loading...`);
      replenishmentStore.setError(`Critical transfer error: ${error.message}`);
    } finally {
      // Clear timeout protection
      clearTimeout(timeoutId);
      console.log(`🏁 [LOADING STATE] Finally block - clearing timeout and setting loading to false`);
      console.log(`🏁 [LOADING STATE] Loading state BEFORE clearing:`, replenishmentStore.getState().loading);
      replenishmentStore.setLoading(false);
      console.log(`🏁 [LOADING STATE] Loading state AFTER clearing:`, replenishmentStore.getState().loading);
      console.log(`🏁 [LOADING STATE] FINAL STATE CHECK:`, replenishmentStore.getState());
    }
  }

  /**
   * Send a single transfer order to SoftOne (REAL MODE with retry logic)
   */
  async _sendSingleTransferOrder(order, maxRetries = 3) {
    console.log(`� [REAL MODE] Processing S1 transfer for ${order.destinationName}...`);
    
    let attempt = 0;
    let lastError = null;
    
    while (attempt < maxRetries) {
      try {
        attempt++;
        console.log(`📤 Attempt ${attempt}/${maxRetries} for ${order.destinationName}`);
        
        // Get or refresh S1 token
        const token = await this.acquireS1Token();
        
        // Build the SoftOne JSON payload
        const s1Payload = this._buildS1Payload(order);
        s1Payload.clientID = token; // Add token to payload
        
        console.log('📋 S1 Payload for', order.destinationName, ':', JSON.stringify(s1Payload, null, 2));
        
        // Make REAL call to SoftOne via backend with timeout protection
        const REQUEST_TIMEOUT_MS = 60000; // 60 seconds per request
        const responsePromise = client.service('s1').setData(s1Payload);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout after 60 seconds')), REQUEST_TIMEOUT_MS)
        );
        
        const response = await Promise.race([responsePromise, timeoutPromise]);
        
        console.log('📥 S1 Response for', order.destinationName, ':', response);
        
        if (response.success) {
          console.log(`✅ [REAL MODE] Transfer successful for ${order.destinationName}`);
          return {
            success: true,
            id: response.id || 'unknown', // SoftOne returns "id" field on success
            message: `Transfer successful for ${order.destinationName}`,
            response: response,
            realMode: true
          };
        } else {
          // SoftOne returned error - build enhanced error details structure
          const errorCode = response.code || response.error || 0;
          const errorMessage = response.message || response.messages || 'Unknown SoftOne error';
          
          // Determine if error is retryable based on SoftOne error codes
          const isRetryableError = this._isSoftOneErrorRetryable(errorCode);
          
          console.error(`❌ SoftOne error [${errorCode}] for ${order.destinationName}:`, errorMessage);
          
          // Build structured error response for modal enhancement
          const errorResult = {
            success: false,
            message: Array.isArray(errorMessage) ? errorMessage.join('; ') : errorMessage,
            messages: Array.isArray(errorMessage) ? errorMessage : [errorMessage],
            error: errorCode, // This is the error code that will be looked up
            response: response,
            noRetry: !isRetryableError,
            realMode: true,
            // Additional debugging info
            originalResponse: response,
            destinationName: order.destinationName,
            orderInfo: {
              destination: order.destinationName,
              items: order.details?.length || 0,
              totalQuantity: order.details?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0
            }
          };
          
          return errorResult;
        }
        
      } catch (error) {
        console.error(`❌ Attempt ${attempt} failed for ${order.destinationName}:`, error);
        lastError = error;
        
        // Check if this is a retry-able error
        const isRetryable = this._isRetryableError(error);
        
        if (!isRetryable || attempt >= maxRetries) {
          console.error(`❌ Non-retryable error or max attempts reached for ${order.destinationName}`);
          break;
        }
        
        // Wait before retry (exponential backoff)
        const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        console.log(`⏳ Waiting ${delayMs}ms before retry for ${order.destinationName}...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
    
    // All attempts failed - build enhanced error structure
    console.error(`❌ [REAL MODE] All attempts failed for ${order.destinationName}`);
    
    const failedResult = {
      success: false,
      message: `Transfer failed after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`,
      messages: [`Transfer failed after ${maxRetries} attempts`, lastError?.message || 'Unknown error'],
      error: lastError?.code || lastError?.response?.code || -1, // Error code for lookup
      attempts: attempt,
      realMode: true,
      // Additional context for debugging
      lastError: lastError,
      destinationName: order.destinationName,
      orderInfo: {
        destination: order.destinationName,
        items: order.details?.length || 0,
        totalQuantity: order.details?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0,
        maxRetries: maxRetries
      }
    };
    
    return failedResult;
  }

  /**
   * Determine if a SoftOne error code indicates a retryable error
   * Based on SoftOne documentation error codes
   */
  _isSoftOneErrorRetryable(errorCode) {
    // Retryable errors (session, authentication, temporary issues)
    const retryableErrors = [
      -101, // Invalid Request, session has expired! (Web Account time expiration)
      -100, // Invalid Request, session has expired! (Deep linking smart command)
      -7,   // Session has expired (Web Account "FinalDate" expired)
      -1,   // Invalid request. Please login first
      11,   // Internal error
      20,   // Internal error
      99,   // Internal error
      13,   // Invalid request, "reqID" expired
      213,  // Invalid request, "reqID" expired
      102   // "ReqId" not found on Server!
    ];
    
    // Non-retryable errors (business logic, validation, permanent issues)
    const nonRetryableErrors = [
      -12,  // Invalid Web Service call
      -11,  // Invalid Request. Licence must include a "Web Service Connector" module
      -10,  // Login fails. Username contains illegal characters
      -9,   // Invalid Request. Ensure that your request is valid
      -8,   // Invalid request. User account is not active!
      -6,   // Invalid AppId. Ensure that your request includes a valid AppId
      -5,   // Web Services Licenses Exceeded!
      -4,   // Number of registered devices exceeded!
      -3,   // Access denied. Selected module not activated!
      -2,   // Authenticate fails due to invalid credentials
      0,    // Business error
      12,   // Deprecated service
      14,   // Invalid request.(WS)
      101,  // Invalid request. Insufficient access rights to perform the operation!
      112,  // Invalid editor
      1001, // Please ensure :Username, Password, User is Active and has Administrator right
      1002, // Invalid domain ('DOMAIN') or already in use
      1010, // General Web Account Error
      2001  // Invalid request, Data does not exist
    ];
    
    // Check if explicitly retryable
    if (retryableErrors.includes(errorCode)) {
      console.log(`🔄 SoftOne error ${errorCode} is retryable (session/auth/temporary)`);
      return true;
    }
    
    // Check if explicitly non-retryable
    if (nonRetryableErrors.includes(errorCode)) {
      console.log(`🚫 SoftOne error ${errorCode} is not retryable (business/validation/permanent)`);
      return false;
    }
    
    // Unknown error codes - default to non-retryable for safety
    console.log(`⚠️  Unknown SoftOne error code ${errorCode} - defaulting to non-retryable`);
    return false;
  }

  /**
   * Check if an error is retryable (network, auth, timeout errors)
   */
  _isRetryableError(error) {
    // Network errors, timeouts, auth errors are retryable
    const retryableErrors = [
      'network', 'timeout', 'authentication', 'token', 
      'connection', 'fetch', 'ECONNRESET', 'ETIMEDOUT',
      'unauthorized', 'session', 'expired'
    ];
    
    const errorMessage = error.message?.toLowerCase() || '';
    const isRetryable = retryableErrors.some(keyword => errorMessage.includes(keyword));
    
    console.log(`🔍 Error "${error.message}" is ${isRetryable ? 'RETRYABLE' : 'NOT RETRYABLE'}`);
    return isRetryable;
  }

  /**
   * Build SoftOne setData JSON payload for a transfer order
   */
  _buildS1Payload(order) {
    const itelines = order.items.map(item => ({
      MTRL: item.mtrl,
      QTY1: item.transfer.toString()
    }));
    
    return {
      service: "setData",
      appId: 2002,
      OBJECT: "ITEDOC",
      FORM: "Mec - Comenzi sucursale",
      KEY: "",
      DATA: {
        ITEDOC: [{
          SERIES: "3130",
          BRANCH: parseInt(order.sourceBranch),
          COMMENTS: `Transfer către ${order.destinationName} - Generată automat din sistem replenishment`
        }],
        MTRDOC: [{
          BRANCHSEC: parseInt(order.destinationBranch)
        }],
        ITELINES: itelines
      }
    };
  }

  /**
   * Show final transfer results (now handled by modal, keeping for compatibility)
   */
  _showTransferResults(results, successCount, errorCount) {
    console.log('📋 [LOADING STATE] Transfer results now shown in modal');
    console.log('📋 [LOADING STATE] Results summary:', { 
      total: results.length, 
      success: successCount, 
      errors: errorCount 
    });
    
    const totalOrders = results.length;
    console.log('📋 [LOADING STATE] Final raport transfer:', {
      totalOrders,
      successCount,
      errorCount,
      successRate: ((successCount / totalOrders) * 100).toFixed(1) + '%',
      results
    });
    
    // Results are now displayed in the modal, no more alert dialogs
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
    
  const currentFilteredData = replenishmentStore.getFilteredData(columnConfig);
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
          case 'apply_zero':
            // Apply 0 to all filtered items (respects successive flag)
            updatedItem.transfer = 0;
            dataUpdated = true;
            skippedReasons.applied++;
            console.log(`✅ Applied 0 to item ${updatedItem.mtrl || 'unknown'}`);
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

  _handleClearTransfers() {
    const currentState = replenishmentStore.getState();

    if (!currentState.data.length) {
      console.warn('Clear transfers skipped: No data loaded');
      return;
    }

    let dataUpdated = false;
    const newData = currentState.data.map(item => {
      const currentTransfer = parseFloat(item.transfer || 0);
      if (currentTransfer === 0 && item.transfer === 0) {
        return item;
      }

      dataUpdated = dataUpdated || isNaN(currentTransfer) || currentTransfer !== 0 || item.transfer !== 0;
      return { ...item, transfer: 0 };
    });

    if (dataUpdated) {
      replenishmentStore.setData(newData);
      console.log('✅ Cleared transfer quantities for all items.');
    } else {
      console.log('ℹ️  Clear transfers skipped: All items already have zero transfer.');
    }
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

  // --- Diagnostic Modal Methods ---
  
  /**
   * Show diagnostic modal with exclusion reasons
   */
  _showDiagnosticModal() {
    const currentState = replenishmentStore.getState();
    const modal = document.querySelector('diagnostic-modal');
    if (modal) {
      modal.show(currentState.diagnostics);
    } else {
      console.error('Diagnostic modal not found in DOM');
    }
  }


  // --- S1 Authentication Methods ---
  
  /**
   * Automatically acquire S1 authentication token
   * This method replicates the connectToS1 pattern used throughout the application
   */
  async acquireS1Token() {
    try {
      console.log('🔐 Starting S1 token acquisition...');
      
      // Step 1: Ping the S1 service
      await client.service("s1").ping();
      console.log('✅ S1 ping successful');

      // Step 2: Login to get initial token and branch data
      const loginResponse = await client.service("s1").login();
      console.log('🔄 S1 login response:', loginResponse);

      if (!loginResponse.success) {
        throw new Error(loginResponse.message || 'S1 login failed');
      }

      const token = loginResponse.clientID;
      const objs = loginResponse.objs;
      
      if (!token || !objs) {
        throw new Error('Invalid login response: missing token or branch data');
      }

      // Step 3: Find HQ branch data (used for authentication)
      const loginData = objs.filter((obj) => obj.BRANCHNAME === "HQ")[0];
      
      if (!loginData) {
        throw new Error('HQ branch data not found in login response');
      }

      const appId = loginResponse.appid;

      // Step 4: Authenticate with the S1 service to get a valid session token
      const authResponse = await client.service("s1").authenticate({
        service: "authenticate",
        clientID: token,
        company: loginData.COMPANY,
        branch: loginData.BRANCH,
        module: loginData.MODULE,
        refid: loginData.REFID,
        userid: loginData.USERID,
        appId: appId,
      });

      console.log('🔄 S1 authentication response:', authResponse);

      if (!authResponse.success) {
        throw new Error(authResponse.message || 'S1 authentication failed');
      }

      // Step 5: Store the authenticated token
      const authenticatedToken = authResponse.clientID;
      sessionStorage.setItem('s1Token', authenticatedToken);
      
      console.log('✅ S1 token acquired successfully:', authenticatedToken);
      
      return authenticatedToken;

    } catch (error) {
      console.error('❌ S1 token acquisition failed:', error);
      throw new Error(`Failed to acquire S1 authentication token: ${error.message}`);
    }
  }

  /**
   * Make an authenticated API call with automatic token refresh on authentication errors
   * @param {Function} apiCall - Function that makes the API call
   * @param {string} operation - Description of the operation for error messages
   * @returns {Promise} - The API response
   */
  async makeAuthenticatedCall(apiCall, operation = 'API call') {
    try {
      // First attempt with existing token
      const response = await apiCall();
      
      // Check for authentication errors (common patterns)
      if (!response.success && response.message && 
          (response.message.includes('authentication') || 
           response.message.includes('token') || 
           response.message.includes('unauthorized') ||
           response.message.includes('session'))) {
        
        console.log(`🔄 Authentication error detected during ${operation}, attempting token refresh...`);
        
        // Acquire a new token
        const newToken = await this.acquireS1Token();
        
        // Retry the API call with the new token
        if (newToken) {
          console.log(`🔄 Retrying ${operation} with new token...`);
          return await apiCall(newToken);
        } else {
          throw new Error('Failed to acquire new authentication token');
        }
      }
      
      // Return the response if no authentication error
      return response;
      
    } catch (error) {
      // Check if this is a network/connection error that might be auth-related
      if (error.message && error.message.includes('fetch')) {
        console.log(`🔄 Network error during ${operation}, attempting token refresh...`);
        
        try {
          // Try to acquire a new token
          const newToken = await this.acquireS1Token();
          
          // Retry with new token if acquisition was successful
          if (newToken) {
            console.log(`🔄 Retrying ${operation} after network error...`);
            return await apiCall(newToken);
          }
        } catch (retryError) {
          console.error(`❌ Token refresh failed after network error:`, retryError);
        }
      }
      
      // Re-throw the original error if not auth-related or retry failed
      throw error;
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
    // DataTable now connects directly to store, no need for event listener

    if (manipulationPanel) {
      console.log('Found manipulation panel, adding event listener');
      manipulationPanel.addEventListener('update-property', this._handleManipulationUpdate.bind(this));
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
    console.log('🐛 Render - diagnostics:', this.diagnostics, 'debugMode:', this.debugMode);

    return html`
      <div class="container-fluid mt-2">
        <!-- Top Bar: Hide Query Panel button (left) + Strategy Bar (right, visible when query panel hidden) -->
        <div class="d-flex justify-content-between align-items-center mb-2">
          <button class="btn btn-sm ${this.queryPanelVisible ? 'btn-outline-secondary' : 'btn-outline-primary'}" 
                  @click=${this._handleToggleQueryPanel}>
            <i class="bi ${this.queryPanelVisible ? 'bi-chevron-up' : 'bi-chevron-down'}"></i>
            ${this.queryPanelVisible ? 'Hide Query Panel' : 'Show Query Panel'}
          </button>
          
          ${!this.queryPanelVisible ? html`
            <strategy-bar
              @apply-strategy=${this._handleApplyStrategy}
              @clear-transfers=${this._handleClearTransfers}>
            </strategy-bar>
          ` : ''}
        </div>

        ${this.error ? html`<div class="alert alert-danger alert-dismissible fade show" role="alert">
                            ${this.error}
                            <button type="button" class="btn-close" @click=${() => this.error = ''} aria-label="Close"></button>
                          </div>` : ''}

        ${this.diagnostics && this.diagnostics.length > 0 ? html`
          <div class="alert alert-warning alert-dismissible fade show d-flex align-items-center" role="alert">
            <i class="fas fa-exclamation-triangle me-2"></i>
            <div class="flex-grow-1">
              <strong>Diagnostic:</strong> ${this.diagnostics.length} materiale au fost excluse din rezultate.
            </div>
            <button type="button" class="btn btn-sm btn-outline-warning me-2" @click=${this._showDiagnosticModal}>
              <i class="fas fa-search me-1"></i> Afișează Diagnostic
            </button>
            <button type="button" class="btn-close" @click=${() => replenishmentStore.clearDiagnostics()} aria-label="Close"></button>
          </div>
        ` : ''}

        <!-- Query panel with animation for showing/hiding -->
        <div class="query-panel-container ${this.queryPanelVisible ? 'visible' : 'hidden'}">
          <query-panel
            .branches=${this.branches}
            @load-data=${this._handleLoadData}
            @save-data=${this._handleSaveData}
            @reset-data=${this._handleResetData}>
          </query-panel>
        </div>

        <!-- Layout with manipulation panel only -->
        <div class="row g-2 mb-2">
          <!-- Manipulation panel (search) taking full width -->
          <div class="col-12">
            <manipulation-panel
              .searchTerm=${this.searchTerm}
              .transferFilter=${this.transferFilter}
              .totalCount=${totalCount}
              .filteredCount=${filteredCount}
              .loading=${this.loading}
              @update-property=${this._handleManipulationUpdate}
              @export-data=${this._handleExportData}
              @save-data=${this._handleSaveData}>
            </manipulation-panel>
          </div>
        </div>

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

        <!-- Diagnostic Modal -->
        <diagnostic-modal></diagnostic-modal>
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

  /**
   * Setup modal event listeners for handling user interactions
   */
  _setupModalEventListeners(modal) {
    // Handle retry single order
    modal.addEventListener('retry-order', async (e) => {
      const { orderIndex, order } = e.detail;
      console.log(`🔄 Retrying order ${orderIndex} for ${order.destinationName}`);
      
      try {
        const result = await this._sendSingleTransferOrder(order);
        
        if (result.success) {
          console.log(`✅ Retry successful for ${order.destinationName}`);
          modal.updateProgress(orderIndex, 'success', result);
        } else {
          console.log(`❌ Retry failed for ${order.destinationName}`);
          const enhancedError = await this._enhanceErrorDetails(result);
          modal.updateProgress(orderIndex, 'failed', enhancedError);
        }
      } catch (error) {
        console.error(`❌ Retry error for ${order.destinationName}:`, error);
        const errorResult = { 
          success: false, 
          message: error.message,
          error: error.code || -1
        };
        const enhancedError = await this._enhanceErrorDetails(errorResult);
        modal.updateProgress(orderIndex, 'failed', enhancedError);
      }
    });

    // Handle retry all failed
    modal.addEventListener('retry-all-failed', async (e) => {
      const { failedOrders } = e.detail;
      console.log(`🔄 Retrying ${failedOrders.length} failed orders`);
      
      for (const failedItem of failedOrders) {
        const { order, index } = failedItem;
        
        try {
          modal.updateProgress(index, 'processing');
          const result = await this._sendSingleTransferOrder(order);
          
          if (result.success) {
            modal.updateProgress(index, 'success', result);
          } else {
            const enhancedError = await this._enhanceErrorDetails(result);
            modal.updateProgress(index, 'failed', enhancedError);
          }
        } catch (error) {
          const errorResult = { 
            success: false, 
            message: error.message,
            error: error.code || -1
          };
          const enhancedError = await this._enhanceErrorDetails(errorResult);
          modal.updateProgress(index, 'failed', enhancedError);
        }
        
        // Small delay between retries
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Refresh results view
      modal.showResults();
    });

    // Handle cancel remaining transfers
    modal.addEventListener('cancel-remaining', () => {
      console.log('🛑 User cancelled remaining transfers');
      // This would be implemented if we support cancellation during processing
    });

    // Handle modal close
    modal.addEventListener('closed', () => {
      console.log('📋 Transfer modal closed');
      // Optional: Clean up or refresh data
    });
  }

  /**
   * Enhance error details with SoftOne documentation lookup
   * @param {Object} result - Error result object with structure:
   *   {
   *     success: false,
   *     message: string,
   *     messages: string[],
   *     error: number, // Error code for lookup
   *     ...other properties
   *   }
   */
  async _enhanceErrorDetails(result) {
    const enhancedError = {
      ...result,
      message: result.message || 'Unknown error',
      messages: result.messages || [result.message || 'Unknown error'],
      error: result.error || result.code || -1, // Normalize error code field
      softOneDocumentation: null,
      // Add timestamp for debugging
      enhancedAt: new Date().toISOString()
    };

    // Try to lookup error code in SoftOne documentation
    const errorCode = enhancedError.error;
    if (errorCode && errorCode !== -1) {
      try {
        console.log(`🔍 Looking up SoftOne error code: ${errorCode}`);
        enhancedError.softOneDocumentation = await this._lookupSoftOneErrorCode(errorCode);
        console.log(`📖 Documentation found for error ${errorCode}:`, enhancedError.softOneDocumentation);
      } catch (lookupError) {
        console.warn('Failed to lookup SoftOne error code:', lookupError);
        enhancedError.softOneDocumentation = `Error code: ${errorCode} - verificați documentația SoftOne pentru detalii suplimentare`;
      }
    } else {
      console.warn('No valid error code found for documentation lookup:', result);
      enhancedError.softOneDocumentation = 'Nu s-a găsit un cod de eroare valid pentru documentație';
    }

    return enhancedError;
  }

  /**
   * Lookup SoftOne error code in documentation with enhanced descriptions
   * @param {number|string} errorCode - The SoftOne error code
   * @returns {string} Enhanced error description with documentation links
   */
  async _lookupSoftOneErrorCode(errorCode) {
    // Common SoftOne error codes with enhanced descriptions and solutions
    const commonErrors = {
      '-101': {
        description: 'Invalid Request, session has expired! (Web Account time expiration)',
        solution: 'Sesiunea a expirat. Aplicația va încerca să se reconecteze automat.',
        category: 'Authentication'
      },
      '-100': {
        description: 'Invalid Request, session has expired! (Deep linking smart command)',
        solution: 'Sesiunea a expirat în timpul execuției comenzii. Reîncercați operația.',
        category: 'Authentication'
      },
      '-12': {
        description: 'Invalid Web Service call',
        solution: 'Apelul serviciului web este invalid. Verificați parametrii transmisi.',
        category: 'Request Validation'
      },
      '-11': {
        description: 'Invalid Request. Licence must include a "Web Service Connector" module',
        solution: 'Licența SoftOne nu include modulul "Web Service Connector". Contactați administratorul.',
        category: 'Licensing'
      },
      '-10': {
        description: 'Login fails. Username contains illegal characters',
        solution: 'Numele de utilizator conține caractere invalide. Verificați configurația.',
        category: 'Authentication'
      },
      '-9': {
        description: 'Invalid Request. Ensure that your request is valid',
        solution: 'Cererea este invalidă. Verificați formatul și conținutul datelor transmise.',
        category: 'Request Validation'
      },
      '-8': {
        description: 'Invalid request. User account is not active!',
        solution: 'Contul de utilizator nu este activ. Contactați administratorul.',
        category: 'Authentication'
      },
      '-7': {
        description: 'Session has expired (Web Account "FinalDate" expired)',
        solution: 'Sesiunea a expirat. Aplicația va încerca să se reconecteze automat.',
        category: 'Authentication'
      },
      '-6': {
        description: 'Invalid AppId. Ensure that your request includes a valid AppId',
        solution: 'AppId invalid. Verificați configurația aplicației.',
        category: 'Configuration'
      },
      '-5': {
        description: 'Web Services Licenses Exceeded!',
        solution: 'S-a depășit numărul de licențe pentru servicii web. Contactați administratorul.',
        category: 'Licensing'
      },
      '-4': {
        description: 'Number of registered devices exceeded!',
        solution: 'S-a depășit numărul de dispozitive înregistrate. Contactați administratorul.',
        category: 'Licensing'
      },
      '-3': {
        description: 'Access denied. Selected module not activated!',
        solution: 'Modulul selectat nu este activat în licență. Contactați administratorul.',
        category: 'Licensing'
      },
      '-2': {
        description: 'Authenticate fails due to invalid credentials',
        solution: 'Autentificare eșuată - credențiale invalide. Verificați username/password.',
        category: 'Authentication'
      },
      '-1': {
        description: 'Invalid request. Please login first',
        solution: 'Cerere invalidă - este necesară autentificarea. Aplicația va încerca să se reconecteze.',
        category: 'Authentication'
      },
      '0': {
        description: 'Business error',
        solution: 'Eroare de business logic. Verificați datele introduse și regulile de validare.',
        category: 'Business Logic'
      },
      '11': {
        description: 'Internal error',
        solution: 'Eroare internă SoftOne. Reîncercați operația sau contactați suportul.',
        category: 'Internal'
      },
      '12': {
        description: 'Deprecated service',
        solution: 'Serviciul este depreciat. Contactați echipa de dezvoltare pentru actualizare.',
        category: 'Deprecated'
      },
      '13': {
        description: 'Invalid request, "reqID" expired',
        solution: 'ID-ul cererii a expirat. Reîncercați operația.',
        category: 'Request Validation'
      },
      '14': {
        description: 'Invalid request.(WS)',
        solution: 'Cerere invalidă pentru serviciul web. Verificați formatul datelor.',
        category: 'Request Validation'
      },
      '20': {
        description: 'Internal error',
        solution: 'Eroare internă SoftOne. Reîncercați operația sau contactați suportul.',
        category: 'Internal'
      },
      '99': {
        description: 'Internal error',
        solution: 'Eroare internă SoftOne. Reîncercați operația sau contactați suportul.',
        category: 'Internal'
      },
      '101': {
        description: 'Invalid request. Insufficient access rights to perform the operation!',
        solution: 'Drepturi de acces insuficiente. Contactați administratorul pentru permisiuni.',
        category: 'Authorization'
      },
      '102': {
        description: '"ReqId" not found on Server!',
        solution: 'ID-ul cererii nu a fost găsit pe server. Reîncercați operația.',
        category: 'Request Validation'
      },
      '112': {
        description: 'Invalid editor',
        solution: 'Editor invalid. Verificați configurația editorului folosit.',
        category: 'Configuration'
      },
      '213': {
        description: 'Invalid request, "reqID" expired',
        solution: 'ID-ul cererii a expirat. Reîncercați operația.',
        category: 'Request Validation'
      },
      '1001': {
        description: 'Please ensure :Username, Password, User is Active and has Administrator right',
        solution: 'Verificați: username, password, utilizatorul este activ și are drepturi de administrator.',
        category: 'Authentication'
      },
      '1002': {
        description: 'Invalid domain (\'DOMAIN\') or already in use',
        solution: 'Domeniul este invalid sau deja în folosire. Verificați configurația.',
        category: 'Configuration'
      },
      '1010': {
        description: 'General Web Account Error',
        solution: 'Eroare generală de cont web. Verificați configurația contului.',
        category: 'Authentication'
      },
      '2001': {
        description: 'Invalid request, Data does not exist',
        solution: 'Datele solicitate nu există. Verificați că înregistrările sunt valide.',
        category: 'Data Validation'
      }
    };

    const codeStr = errorCode.toString();
    const errorInfo = commonErrors[codeStr];
    
    if (errorInfo) {
      return `🔍 ${errorInfo.description}

💡 Soluție: ${errorInfo.solution}

📂 Categorie: ${errorInfo.category}

📖 Pentru mai multe detalii, consultați documentația oficială SoftOne la:
https://www.softone.gr/ws/#errorcodes`;
    }

    // For unknown error codes, provide general guidance with more helpful info
    return `⚠️ Cod de eroare necunoscut: ${errorCode}

Acest cod de eroare nu este recunoscut în baza de date comună de erori SoftOne.

💡 Recomandări:
• Verificați că toate câmpurile obligatorii sunt completate corect
• Asigurați-vă că datele respectă formatul așteptat
• Verificați că utilizatorul are permisiunile necesare
• Consultați logurile SoftOne pentru detalii suplimentare

📖 Pentru documentația completă și coduri de eroare actualizate:
https://www.softone.gr/ws/#errorcodes

🆘 Dacă problema persistă, contactați echipa de suport cu codul ${errorCode}.`;
  }
}

customElements.define('branch-replenishment-container', BranchReplenishmentContainer);
