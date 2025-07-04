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
import './strategy-panel.js'; // Will be used as quick-panel
import './data-table.js';

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
    
    console.log('📦 Container synced from store - branchesEmit:', this.branchesEmit, 'selectedDestBranches:', this.selectedDestBranches);
  }

  // --- Data Fetching and Actions ---
  async _handleLoadData() {
    replenishmentStore.setLoading(true);
    replenishmentStore.setError('');
    
    // Only reset search-related filters, not all filters
    replenishmentStore.resetSearchFilters();
    
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
        setConditionForLimits: currentState.setConditionForLimits
      });

      // Set data in store
      replenishmentStore.setData(response);

      // Hide query panel after successfully loading data
      replenishmentStore.setQueryPanelVisible(false);

      // Dispatch custom event to indicate data has been loaded
      this.dispatchEvent(new CustomEvent('data-loaded', {
        bubbles: true,
        composed: true,
        detail: { 
          dataCount: Array.isArray(response) ? response.length : 0,
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
   * Show confirmation dialog with transfer summary
   */
  async _showConfirmationDialog(transferOrders) {
    const totalOrders = transferOrders.length;
    const totalItems = transferOrders.reduce((sum, order) => sum + order.totalItems, 0);
    const totalQuantity = transferOrders.reduce((sum, order) => sum + order.totalQuantity, 0);
    const totalBlacklistedItems = transferOrders.reduce((sum, order) => sum + order.blacklistedItemsCount, 0);

    const ordersList = transferOrders.map(order => {
      let orderLine = `• ${order.sourceName} → ${order.destinationName}: ${order.totalItems} produse (cantitate: ${order.totalQuantity.toFixed(2)})`;
      
      if (order.blacklistedItemsCount > 0) {
        orderLine += ` ⚠️  ${order.blacklistedItemsCount} blacklisted`;
      }
      
      return orderLine;
    }).join('\n');

    let message = `🚀 CONFIRMARE TRANSFER ÎN SOFTONE ERP

📊 SUMAR GENERAL:
• ${totalOrders} comenzi de transfer
• ${totalItems} produse în total  
• Cantitate totală: ${totalQuantity.toFixed(2)}`;

    if (totalBlacklistedItems > 0) {
      message += `
• ⚠️  ${totalBlacklistedItems} produse blacklisted incluse`;
    }

    message += `

📋 DETALII COMENZI:
${ordersList}`;

    if (totalBlacklistedItems > 0) {
      message += `

⚠️  ATENȚIE - PRODUSE BLACKLISTED:
• Există ${totalBlacklistedItems} produse marcate ca blacklisted
• Acestea sunt incluse deoarece ați completat manual cantitățile
• Verificați dacă acest lucru este intenționat`;
    }

    message += `

🔒 INFORMAȚII IMPORTANTE:
• Comenzile vor fi create în SoftOne ERP cu seria 3130
• Form: "Mec - Comenzi sucursale"
• 🧪 TRANSFER REAL DE TEST: Comentariu "TEST TEST TEST A NU SE PROCESA"
• ⚠️  ATENȚIE: Aceasta va fi o comandă REALĂ în SoftOne!
• Procesul NU poate fi anulat după confirmare
• Verificați toate datele înainte de a continua

Doriți să continuați cu transferul REAL?`;

    return confirm(message);
  }

  /**
   * Process all transfer orders to SoftOne
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

        try {
          console.log(`📤 [DEBUG] Calling _sendSingleTransferOrder for ${order.destinationName}...`);
          const result = await this._sendSingleTransferOrder(order);
          console.log(`📥 [DEBUG] Received result for ${order.destinationName}:`, result);
          
          if (result.success) {
            successCount++;
            console.log(`✅ [DEBUG] Order ${i + 1} successful: ID ${result.id}`);
          } else {
            errorCount++;
            console.error(`❌ [DEBUG] Order ${i + 1} failed:`, result.message || 'Unknown error');
          }
          
          results.push({
            order,
            result,
            orderNumber: i + 1
          });

        } catch (error) {
          errorCount++;
          console.error(`❌ [DEBUG] Order ${i + 1} failed with exception:`, error);
          
          results.push({
            order,
            result: { success: false, message: error.message },
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

      // Show final results
      console.log(`📊 [LOADING STATE] Calling _showTransferResults...`);
      console.log(`📊 [LOADING STATE] Loading state before showing results:`, replenishmentStore.getState().loading);
      this._showTransferResults(results, successCount, errorCount);
      console.log(`📊 [LOADING STATE] _showTransferResults completed.`);

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
          // SoftOne returned error - check for error codes and determine if retryable
          const errorCode = response.code || 0;
          const errorMessage = response.message || 'Unknown SoftOne error';
          
          // Determine if error is retryable based on SoftOne error codes
          const isRetryableError = this._isSoftOneErrorRetryable(errorCode);
          
          console.error(`❌ SoftOne error [${errorCode}] for ${order.destinationName}:`, errorMessage);
          return {
            success: false,
            message: `SoftOne error [${errorCode}]: ${errorMessage}`,
            response: response,
            noRetry: !isRetryableError,
            realMode: true,
            errorCode: errorCode
          };
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
    
    // All attempts failed
    console.error(`❌ [REAL MODE] All attempts failed for ${order.destinationName}`);
    return {
      success: false,
      message: `Transfer failed after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`,
      error: lastError,
      attempts: attempt,
      realMode: true
    };
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
          COMMENTS: "TEST TEST TEST A NU SE PROCESA"
        }],
        MTRDOC: [{
          BRANCHSEC: parseInt(order.destinationBranch)
        }],
        ITELINES: itelines
      }
    };
  }

  /**
   * Show final transfer results to user
   */
  _showTransferResults(results, successCount, errorCount) {
    console.log('📋 [LOADING STATE] Preparing transfer results dialog...');
    console.log('📋 [LOADING STATE] Results summary:', { total: results.length, success: successCount, errors: errorCount });
    
    const totalOrders = results.length;
    
    let message = `🎉 TRANSFER REAL ÎN SOFTONE COMPLETAT!\n\n`;
    message += `📊 REZULTATE FINALE:\n`;
    message += `• Comenzi procesate: ${totalOrders}\n`;
    message += `• ✅ Succese: ${successCount}\n`;
    message += `• ❌ Erori: ${errorCount}\n`;
    message += `• 📈 Rata de succes: ${((successCount / totalOrders) * 100).toFixed(1)}%\n`;
    message += `• 🧪 Comentariu test: "TEST TEST TEST A NU SE PROCESA"\n\n`;

    if (successCount > 0) {
      message += `✅ COMENZI REUȘITE:\n`;
      results.filter(r => r.result.success).forEach(r => {
        const itemCount = r.order.totalItems;
        const quantity = r.order.totalQuantity.toFixed(2);
        const blacklisted = r.order.blacklistedItemsCount > 0 ? ` (${r.order.blacklistedItemsCount} blacklisted)` : '';
        message += `• ${r.order.destinationName}: ID S1 #${r.result.id}\n`;
        message += `  └ ${itemCount} produse, cantitate ${quantity}${blacklisted}\n`;
      });
      message += `\n`;
    }

    if (errorCount > 0) {
      message += `❌ COMENZI EȘUATE (necesită atenție):\n`;
      results.filter(r => !r.result.success).forEach(r => {
        const itemCount = r.order.totalItems;
        const quantity = r.order.totalQuantity.toFixed(2);
        message += `• ${r.order.destinationName}: ${r.result.message || 'Eroare necunoscută'}\n`;
        message += `  └ ${itemCount} produse, cantitate ${quantity} - NETRANSFERATE\n`;
      });
      message += `\n`;
    }

    if (errorCount > 0) {
      message += `🔄 ACȚIUNI URMĂTOARE:\n`;
      message += `• Verificați erorile raportate mai sus\n`;
      message += `• Pentru comenzile eșuate, încercați din nou mai târziu\n`;
      message += `• Contactați suportul tehnic dacă problemele persistă\n`;
    } else {
      message += `🎊 TOATE COMENZILE AU FOST TRANSFERATE CU SUCCES!\n`;
      message += `Puteți verifica comenzile în SoftOne folosind ID-urile de mai sus.`;
    }

    alert(message);
    console.log('📋 [LOADING STATE] Transfer results dialog shown to user');
    console.log('📋 [LOADING STATE] Final raport transfer:', {
      totalOrders,
      successCount,
      errorCount,
      successRate: ((successCount / totalOrders) * 100).toFixed(1) + '%',
      results
    });
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
    
    const currentFilteredData = replenishmentStore.getFilteredData();
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
          case 'clear':
            updatedItem.transfer = 0;
            dataUpdated = true;
            skippedReasons.applied++;
            console.log(`✅ Cleared transfer for item ${updatedItem.mtrl || 'unknown'}`);
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
    const strategyPanel = this.querySelector('strategy-panel');
    // DataTable now connects directly to store, no need for event listener

    if (manipulationPanel) {
      console.log('Found manipulation panel, adding event listener');
      manipulationPanel.addEventListener('update-property', this._handleManipulationUpdate.bind(this));
    }

    if (strategyPanel) {
      console.log('Found strategy panel, adding event listener');
      strategyPanel.addEventListener('update-property', this._handleStrategyUpdate.bind(this));
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

    return html`
      <div class="container-fluid mt-2">
        ${this.error ? html`<div class="alert alert-danger alert-dismissible fade show" role="alert">
                            ${this.error}
                            <button type="button" class="btn-close" @click=${() => this.error = ''} aria-label="Close"></button>
                          </div>` : ''}

        <!-- Query panel with animation for showing/hiding -->
        <div class="query-panel-container ${this.queryPanelVisible ? 'visible' : 'hidden'}">
          <query-panel
            .branches=${this.branches}
            @load-data=${this._handleLoadData}
            @save-data=${this._handleSaveData}
            @reset-data=${this._handleResetData}>
          </query-panel>
        </div>

        <!-- Layout with manipulation panel only - quick panel is floating -->
        <div class="row g-2 mb-3">
          <!-- Manipulation panel (search) taking full width -->
          <div class="col-12">
            <manipulation-panel
              .searchTerm=${this.searchTerm}
              .transferFilter=${this.transferFilter}
              .totalCount=${totalCount}
              .filteredCount=${filteredCount}
              @update-property=${this._handleManipulationUpdate}
              @export-data=${this._handleExportData}>
            </manipulation-panel>
          </div>
        </div>

        <!-- Floating quick panel - positioned with CSS -->
        <quick-panel
          .selectedReplenishmentStrategy=${this.selectedReplenishmentStrategy}
          .isSuccessiveStrategy=${this.isSuccessiveStrategy}
          .loading=${this.loading}
          .queryPanelVisible=${this.queryPanelVisible}
          ?disabled=${!this.data || this.data.length === 0}
          @toggle-query-panel=${this._handleToggleQueryPanel}
          @apply-strategy=${this._handleApplyStrategy}
          @update-property=${this._handleStrategyUpdate}>
        </quick-panel>

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
}

customElements.define('branch-replenishment-container', BranchReplenishmentContainer);
