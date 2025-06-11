// Top ABC Analysis Container Component
import { LitElement, html, css } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';
import { client } from '../../socketConfig.js';
import './top-abc-chart.js';
import './top-abc-control-panel.js';
import './top-abc-table.js';

export class TopAbcContainer extends LitElement {
  static get properties() {
    return {
      data: { type: Array },
      summary: { type: Array }, // Added for summary data
      totalSales: { type: Number }, // Added for total sales
      token: { type: String },
      loading: { type: Boolean },
      error: { type: String },
      params: { type: Object },
      activeTab: { type: String },
      showSettings: { type: Boolean },
      progress: { type: Object }, // Added for progress tracking
      analysisMode: { type: String }, // Added for mode switching: 'calculate' or 'load'
      loadedAnalysisInfo: { type: Object } // Added for loaded analysis metadata
    };
  }

  createRenderRoot() {
    return this; // Render in light DOM to use global styles
  }

  constructor() {
    super();
    this.data = [];
    this.summary = []; // Initialize summary
    this.totalSales = 0; // Initialize totalSales
    this.token = '';
    this.loading = false;
    this.error = '';
    this.params = {
      dataReferinta: new Date().toISOString().slice(0, 10),
      nrSaptamani: 24,
      seriesL: '',
      branch: '',
      supplier: null,
      mtrl: null,
      cod: '',
      searchType: 1,
      modFiltrareBranch: 'AGENT',
      thresholdA: 80,
      thresholdB: 15
    };
    this.activeTab = 'table';
    this.showSettings = true;
    this.analysisMode = 'calculate'; // Default to calculate mode
    this.loadedAnalysisInfo = null; // Initialize loaded analysis metadata
    this.progress = {
      show: false,
      current: 0,
      total: 0,
      percentage: 0,
      message: '',
      stage: ''
    };
  }

  connectedCallback() {
    super.connectedCallback();
    this.token = sessionStorage.getItem('s1Token');
    if (!this.token) {
      console.log('No token found in session storage, acquiring S1 token automatically...');
      this.acquireS1Token();
      return;
    }

    this.fetchData();
 }

  /**
   * Automatically acquire S1 authentication token
   * This method replicates the connectToS1 pattern used throughout the application
   */
  async acquireS1Token() {
    try {
      console.log('Starting S1 token acquisition...');
      this.loading = true;
      this.error = '';
      
      // Step 1: Ping the S1 service
      await client.service("s1").ping();
      console.log('S1 ping successful');

      // Step 2: Login to get initial token and branch data
      const loginResponse = await client.service("s1").login();
      console.log('S1 login response:', loginResponse);

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

      console.log('S1 authentication response:', authResponse);

      if (!authResponse.success) {
        throw new Error(authResponse.message || 'S1 authentication failed');
      }

      // Step 5: Store the authenticated token and proceed
      this.token = authResponse.clientID;
      sessionStorage.setItem('s1Token', this.token);
      
      console.log('S1 token acquired successfully:', this.token);
      
      // Step 6: Now that we have a token, proceed with data fetching
      this.loading = false;
      this.fetchData();

    } catch (error) {
      console.error('S1 token acquisition failed:', error);
      this.loading = false;
      this.error = `Failed to acquire authentication token: ${error.message}. Please refresh the page and try again.`;
    }
  }

  async fetchData() {
    try {
      // Validate that a branch is selected before proceeding
      if (!this.params.branch || this.params.branch.trim() === '') {
        this.error = 'Please select a branch. Branch selection is mandatory.';
        return;
      }
      
      // Check the analysis mode and call appropriate method
      if (this.analysisMode === 'load') {
        await this.loadSavedAnalysis();
        return;
      }
    
      this.loading = true;
      this.error = '';

      // Create a copy of params and ensure date is properly quoted for SQL
      const params = { ...this.params };
      
      // Ensure dataReferinta is correctly formatted for SQL (needs to be quoted)
      if (params.dataReferinta) {
        // Make sure we're sending the date in quotes (SQL format)
        params.dataReferinta = `'${params.dataReferinta}'`;
      }

      //ensure supplier and mtrl are numbers and if null, set mtrl to 2606178 and supplier to 72235
        if (params.supplier === null) {
            params.supplier = 72235;
        }
        if (params.mtrl === null) {
            params.mtrl = 2606178;
        }
      
      const response = await this.makeAuthenticatedCall(async () => {
        return await client.service('top-abc').getTopAbcAnalysis({
          token: this.token,
          ...params
        });
      }, 'TOP ABC analysis fetch');

      console.log('API Response:', response);

      if (response.success) {
        // Assuming the combined endpoint returns data in response.data
        if (response.data && response.data.DetailedRows) {
          this.data = response.data.DetailedRows || [];
          this.summary = response.data.SummaryRows || [];
          this.totalSales = response.data.TotalPositiveSales || 0;
        } else {
          // Fallback for the older structure if needed, or handle error
          this.data = response.rows || [];
          this.summary = []; // Clear summary if not using combined endpoint
          this.totalSales = 0; // Clear totalSales if not using combined endpoint
          // Optionally, set an error if the expected structure is missing
          // this.error = 'Unexpected response structure from server.';
        }
      } else {
        this.error = response.message || 'An error occurred while fetching data';
        console.error('Error fetching data:', response);
      }
    } catch (error) {
      this.error = `Error: ${error.message || 'Unknown error occurred'}`;
      console.error('Exception:', error);
    } finally {
      this.loading = false;
      
      // Show no data message if there's no error but also no data
      if (!this.error && (!this.data || this.data.length === 0)) {
        this.error = 'No data found for the specified criteria. Try adjusting your filters.';
      }
    }
  }

  async loadSavedAnalysis() {
    try {
      // Validate that a branch is selected before proceeding
      if (!this.params.branch || this.params.branch.trim() === '') {
        this.error = 'Please select a branch to load saved analysis data.';
        return;
      }
      
      this.loading = true;
      this.error = '';

      console.log('Loading saved ABC analysis for branch:', this.params.branch);

      // Call the load saved analysis API with authentication retry
      const response = await this.makeAuthenticatedCall(async () => {
        return await client.service('top-abc').loadSavedAnalysis({
          token: this.token,
          branch: this.params.branch
        });
      }, 'load saved analysis');

      console.log('Load saved analysis response:', response);
      console.log('Response params:', response.params);
      console.log('Response data PeriodParameters:', response.data ? response.data.PeriodParameters : 'N/A');

      if (response.success) {
        // Handle the loaded data structure
        if (response.data) {
          // Check if we have the combined structure with detailed and summary data
          if (response.data.DetailedRows && response.data.SummaryRows) {
            this.data = response.data.DetailedRows || [];
            this.summary = response.data.SummaryRows || [];
            
            // Calculate total sales from loaded detailed data (since stored VALUE might be 0)
            this.totalSales = this.data.reduce((total, item) => {
              const value = typeof item.VALUE === 'number' ? item.VALUE : parseFloat(item.VALUE || 0);
              return total + (value > 0 ? value : 0);
            }, 0);
            
            // If calculated total is still 0, try using the stored TotalPositiveSales
            if (this.totalSales === 0 && response.data.TotalPositiveSales) {
              this.totalSales = response.data.TotalPositiveSales;
            }
            
            // Update period info from loaded analysis metadata if available
            if (response.data.LoadedAnalysis) {
              // Extract date information from loaded analysis
              const loadedDate = response.data.LoadedAnalysis.Date;
              if (loadedDate) {
                // Update params to reflect the loaded analysis period
                // Note: We don't change the UI filters, just display info
                this.loadedAnalysisInfo = {
                  date: loadedDate,
                  branch: response.data.LoadedAnalysis.Branch,
                  message: response.data.LoadedAnalysis.Message
                };
              }
            }
            
            // Extract period parameters from response.params (from the backend fix)
            if (response.params && response.params.dataReferinta && response.params.nrSaptamani) {
              // Update this.params with the loaded period information so getAnalysisPeriod() can display it
              this.params.dataReferinta = response.params.dataReferinta;
              this.params.nrSaptamani = response.params.nrSaptamani;
              this.params.modFiltrareBranch = response.params.modFiltrareBranch || this.params.modFiltrareBranch;
              this.params.seriesL = response.params.seriesL || this.params.seriesL;
              
              console.log('Updated params with loaded period info:', {
                dataReferinta: this.params.dataReferinta,
                nrSaptamani: this.params.nrSaptamani
              });
            }
          } else {
            // Fallback: assume data is directly the detailed rows
            this.data = Array.isArray(response.data) ? response.data : [];
            this.summary = [];
            
            // Calculate total sales from loaded data
            this.totalSales = this.data.reduce((total, item) => {
              const value = typeof item.VALUE === 'number' ? item.VALUE : parseFloat(item.VALUE || 0);
              return total + (value > 0 ? value : 0);
            }, 0);
          }

          // Display success message with loaded data info
          if (this.data.length > 0) {
            const totalSalesText = this.totalSales > 0 ? ` (Total Sales: ${this.totalSales.toLocaleString()})` : '';
            this._showSuccessMessage(`Successfully loaded saved analysis with ${this.data.length} items for branch ${this.getBranchDisplay()}${totalSalesText}.`);
          } else {
            this.error = 'No saved analysis data found for the selected branch. Please run a new analysis first.';
          }
        } else {
          this.error = 'No saved analysis data found for the selected branch.';
        }
      } else {
        this.error = response.message || 'An error occurred while loading saved analysis data';
        console.error('Error loading saved analysis:', response);
      }
    } catch (error) {
      this.error = `Error loading saved analysis: ${error.message || 'Unknown error occurred'}`;
      console.error('Exception during load saved analysis:', error);
    } finally {
      this.loading = false;
      
      // Show no data message if there's no error but also no data
      if (!this.error && (!this.data || this.data.length === 0)) {
        this.error = 'No saved analysis data found for the selected criteria. Please run a new analysis first.';
      }
    }
  }

  calculateSummary(data) {
    // Implement your summary calculation logic here
    // For now, returning an empty array as a placeholder
    return [];
  }

  calculateTotalSales(data) {
    // Implement your total sales calculation logic here
    // For now, returning 0 as a placeholder
    return 0;
  }

  exportToExcel() {
    if (!window.XLSX) {
      this.error = 'XLSX library is not loaded. Cannot export to Excel.';
      console.error('XLSX library not found.');
      return;
    }

    try {
      // Main data sheet
      const mainDataWs = XLSX.utils.json_to_sheet(this.data.map(item => ({
        'Code': item.CODE,
        'Description': item.DESCRIPTION,
        'Class': item.ABC,
        'Value': typeof item.VALUE === 'number' ? item.VALUE : parseFloat(item.VALUE || 0),
        'Cumulative %': typeof item.CUMULATIVEPERC === 'number' ? item.CUMULATIVEPERC : parseFloat(item.CUMULATIVEPERC || 0),
        'Sales %': typeof item.SALESPERC === 'number' ? item.SALESPERC : parseFloat(item.SALESPERC || 0),
        'Branch': item.BRANCH,
        'Supplier': item.MTRSUP // Assuming MTRSUP is supplier ID
      })));

      // Summary data sheet
      const summaryWs = XLSX.utils.json_to_sheet(this.summary.map(item => ({
        'Class': item.ABC,
        'Item Count': item.ITEMCOUNT,
        'Class Total Value': item.CLASSTOTAL,
        'Items %': item.ITEMSPERC,
        'Value %': item.VALUEPERC
      })));

      // Total Sales (could be a small separate sheet or added to summary)
      const totalSalesData = [
        { 'Metric': 'Total Positive Sales', 'Value': this.totalSales }
      ];
      const totalSalesWs = XLSX.utils.json_to_sheet(totalSalesData);

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, mainDataWs, 'ABC Details');
      XLSX.utils.book_append_sheet(wb, summaryWs, 'ABC Summary');
      XLSX.utils.book_append_sheet(wb, totalSalesWs, 'Total Sales');

      // Generate a filename with the current date
      const today = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `TopABC_Analysis_${today}.xlsx`);

    } catch (exportError) {
      this.error = `Error exporting to Excel: ${exportError.message}`;
      console.error('Excel export error:', exportError);
    }
  }

  async handleSaveData() {
    try {
      // Validate that we have data to save
      if (!this.data || this.data.length === 0) {
        this.error = 'No data available to save. Please run an analysis first.';
        return;
      }

      // Validate that a branch is selected
      if (!this.params.branch || this.params.branch.trim() === '') {
        this.error = 'Please select a branch before saving.';
        return;
      }

      this.loading = true;
      this.error = '';
      this._hideProgress(); // Clear any existing progress

      // Determine if we need chunking based on data size
      const CHUNK_SIZE = 2000; // Process in chunks of 2000 items to avoid 413 errors
      const needsChunking = this.data.length > CHUNK_SIZE;

      if (needsChunking) {
        console.log(`Large dataset detected (${this.data.length} items). Using chunked save strategy...`);
        await this._saveDataInChunks(CHUNK_SIZE);
      } else {
        console.log(`Small dataset (${this.data.length} items). Using direct save...`);
        await this._saveDataDirect();
      }

    } catch (error) {
      this._hideProgress(); // Ensure progress is hidden on error
      this.error = `Error saving data: ${error.message || 'Unknown error occurred'}`;
      console.error('Exception during save:', error);
    } finally {
      this.loading = false;
    }
  }

  async _saveDataDirect() {
    // Prepare the save payload
    const savePayload = {
      token: this.token,
      ...this.params,
      data: this.data,
      summary: this.summary
    };

    console.log('Saving ABC analysis data:', savePayload);

    // Call the save API with authentication retry
    const response = await this.makeAuthenticatedCall(async () => {
      return await client.service('top-abc').saveTopAbcAnalysis(savePayload);
    }, 'save analysis data');

    console.log('Save response:', response);

    if (response.success) {
      this._showSuccessMessage(response.message);
    } else {
      this.error = response.message || 'An error occurred while saving data';
      console.error('Error saving data:', response);
    }
  }

  async _saveDataInChunks(chunkSize) {
    try {
      // Show initial progress for reset stage
      this._showProgress('reset', 'Preparing to save large dataset...', 0, 3);
      
      // First, call the reset operation to clear existing data
      console.log('Step 1: Resetting existing data for selected branch(es)...');
      this._showProgress('reset', 'Clearing existing data for selected branch(es) before chunked save...', 1, 3);
      
      const resetResponse = await this.makeAuthenticatedCall(async () => {
        return await client.service('top-abc').resetTopAbcAnalysis({
          token: this.token,
          // dataReferinta: this.params.dataReferinta, // Removed dataReferinta
          branch: this.params.branch
        });
      }, 'reset analysis data');

      console.log('Reset response:', resetResponse); // Log the entire reset response object

      if (!resetResponse.success) {
        this._hideProgress();
        // Log the full response object for better debugging
        console.error('Failed to reset data. Full response:', resetResponse);
        throw new Error(`Failed to reset data: ${resetResponse.message}`);
      }

      // Split data into chunks
      const chunks = [];
      for (let i = 0; i < this.data.length; i += chunkSize) {
        chunks.push(this.data.slice(i, i + chunkSize));
      }

      console.log(`Step 2: Saving data in ${chunks.length} chunks...`);
      this._showProgress('chunks', `Preparing ${chunks.length} chunks for sequential processing...`, 0, chunks.length);
      
      // Small delay to show preparation message
      await new Promise(resolve => setTimeout(resolve, 300));

      // Process chunks sequentially to maintain data integrity
      let totalProcessed = 0;
      let chunkNumber = 1;
      
      for (const chunk of chunks) {
        const chunkMessage = `Processing chunk ${chunkNumber}/${chunks.length} (${chunk.length} items)`;
        console.log(chunkMessage);
        this._updateProgress(chunkNumber - 1, chunks.length, chunkMessage);
        
        const chunkPayload = {
          token: this.token,
          ...this.params,
          data: chunk,
          summary: chunkNumber === 1 ? this.summary : [], // Only send summary with first chunk
          isChunk: true,
          chunkNumber: chunkNumber,
          totalChunks: chunks.length
        };

        const chunkResponse = await this.makeAuthenticatedCall(async () => {
          return await client.service('top-abc').saveTopAbcAnalysisChunk(chunkPayload);
        }, `save chunk ${chunkNumber}`);
        console.log(`Chunk ${chunkNumber} save response:`, chunkResponse); // Log the entire chunk save response object

        if (!chunkResponse.success) {
          this._hideProgress();
          // Log the full response object for better debugging
          console.error(`Failed to save chunk ${chunkNumber}. Full response:`, chunkResponse);
          throw new Error(`Failed to save chunk ${chunkNumber}: ${chunkResponse.message}`);
        }

        totalProcessed += chunk.length;
        
        // Update progress with completion status
        const completionMessage = `Completed chunk ${chunkNumber}/${chunks.length} • ${totalProcessed}/${this.data.length} items saved`;
        console.log(completionMessage);
        this._updateProgress(chunkNumber, chunks.length, completionMessage);
        
        chunkNumber++;
        
        // Small delay to allow UI update and show progress
        await new Promise(resolve => setTimeout(resolve, 150));
      }

      // Show completion stage
      this._showProgress('complete', `Successfully saved all ${totalProcessed} items in ${chunks.length} chunks`, chunks.length, chunks.length);
      
      // Hide progress after showing completion for a moment and show success message
      setTimeout(() => {
        this._hideProgress();
        this._showSuccessMessage(`Successfully saved ${totalProcessed} ABC analysis items using chunked strategy (${chunks.length} chunks processed).`);
      }, 2000);
      
    } catch (error) {
      this._hideProgress();
      throw error;
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
        
        console.log(`Authentication error detected during ${operation}, attempting token refresh...`);
        
        // Clear the existing token and acquire a new one
        this.token = null;
        sessionStorage.removeItem('s1Token');
        
        // Acquire a new token
        await this.acquireS1Token();
        
        // Retry the API call with the new token
        if (this.token) {
          console.log(`Retrying ${operation} with new token...`);
          return await apiCall();
        } else {
          throw new Error('Failed to acquire new authentication token');
        }
      }
      
      // Return the response if no authentication error
      return response;
      
    } catch (error) {
      // Check if this is a network/connection error that might be auth-related
      if (error.message && error.message.includes('fetch')) {
        console.log(`Network error during ${operation}, attempting token refresh...`);
        
        try {
          // Try to acquire a new token
          this.token = null;
          sessionStorage.removeItem('s1Token');
          await this.acquireS1Token();
          
          // Retry with new token if acquisition was successful
          if (this.token) {
            console.log(`Retrying ${operation} after network error...`);
            return await apiCall();
          }
        } catch (retryError) {
          console.error(`Token refresh failed after network error:`, retryError);
        }
      }
      
      // Re-throw the original error if not auth-related or retry failed
      throw error;
    }
  }

  // Progress tracking methods
  _showProgress(stage, message, current = 0, total = 0) {
    this.progress = {
      show: true,
      current: current,
      total: total,
      percentage: total > 0 ? Math.round((current / total) * 100) : 0,
      message: message,
      stage: stage
    };
    this.requestUpdate();
  }

  _updateProgress(current, total, message = '') {
    if (this.progress.show) {
      this.progress = {
        ...this.progress,
        current: current,
        total: total,
        percentage: total > 0 ? Math.round((current / total) * 100) : 0,
        message: message || this.progress.message
      };
      this.requestUpdate();
    }
  }

  _hideProgress() {
    this.progress = {
      show: false,
      current: 0,
      total: 0,
      percentage: 0,
      message: '',
      stage: ''
    };
    this.requestUpdate();
  }

  _showSuccessMessage(message) {
    this.error = '';
    // Create a temporary success message element
    const successAlert = document.createElement('div');
    successAlert.className = 'alert alert-success alert-dismissible fade show mt-3';
    successAlert.innerHTML = `
      <i class="fas fa-check-circle me-2"></i>
      ${message}
      <button type="button" class="btn-close" onclick="this.parentElement.remove()"></button>
    `;
    
    // Insert after the header
    const header = this.querySelector('.abc-header');
    if (header) {
      header.parentNode.insertBefore(successAlert, header.nextSibling);
      // Auto-remove after 5 seconds
      setTimeout(() => successAlert.remove(), 5000);
    }
  }

  handleResetData() {
    try {
      // Confirm reset action
      const confirmMessage = `Are you sure you want to reset the interface?\n\nThis will clear all current data, filters, and charts but will not affect saved data in the database.`;
      
      if (!confirm(confirmMessage)) {
        return;
      }

      // Clear the data and reset interface elements
      this.data = [];
      this.summary = [];
      this.totalSales = 0;
      this.error = '';
      this.loading = false;
      
      // Reset parameters to defaults
      this.params = {
        dataReferinta: new Date().toISOString().slice(0, 10),
        nrSaptamani: 24,
        seriesL: '',
        branch: '',
        supplier: null,
        mtrl: null,
        cod: '',
        searchType: 1,
        modFiltrareBranch: 'AGENT',
        thresholdA: 80,
        thresholdB: 15
      };

      // Reset active tab to table
      this.activeTab = 'table';

      // Show success message
      const successAlert = document.createElement('div');
      successAlert.className = 'alert alert-success alert-dismissible fade show mt-3';
      successAlert.innerHTML = `
        <i class="fas fa-check-circle me-2"></i>
        Interface has been reset successfully. All filters and data have been cleared.
        <button type="button" class="btn-close" onclick="this.parentElement.remove()"></button>
      `;
      
      // Insert after the header
      const header = this.querySelector('.abc-header');
      if (header) {
        header.parentNode.insertBefore(successAlert, header.nextSibling);
        // Auto-remove after 5 seconds
        setTimeout(() => successAlert.remove(), 5000);
      }

      // Trigger a re-render to update all child components
      this.requestUpdate();
      
      console.log('Interface reset completed');
    } catch (error) {
      this.error = `Error resetting interface: ${error.message || 'Unknown error occurred'}`;
      console.error('Exception during interface reset:', error);
    }
  }

  handleParamsChanged(e) {
    this.params = { ...e.detail };
  }

  handleApplyFilters(e) {
    this.params = { ...e.detail };
    this.fetchData();
    this.showSettings = false; // Hide settings panel
  }
  
  // Handle the refresh-data event from the chart component
  handleRefreshData() {
    this.fetchData();
  }

  toggleSettings() {
    this.showSettings = !this.showSettings;
  }

  switchTab(tab) {
    this.activeTab = tab;
  }
  
  // Handle mode change for switching between calculate and load modes
  handleModeChange(e) {
    this.analysisMode = e.target.value;
    
    // Clear any existing data when switching modes
    this.data = [];
    this.summary = [];
    this.totalSales = 0;
    this.error = '';
    this.loadedAnalysisInfo = null; // Clear loaded analysis metadata
    
    // If switching to load mode and branch is selected, automatically load
    if (this.analysisMode === 'load' && this.params.branch && this.params.branch.trim() !== '') {
      this.loadSavedAnalysis();
    }
  }

  // Helper method to get branch display text (code + name)
  getBranchDisplay() {
    if (!this.params.branch) return '';
    
    // Define the branch mapping here to have direct access
    const branches = {
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
    
    // Handle multi-branch case
    const branchCodes = this.params.branch.split(',').map(b => b.trim());
    if (branchCodes.length > 1) {
      return `${branchCodes.length} branches selected`;
    }
    
    // Single branch case: show code + name
    const branchCode = branchCodes[0];
    const branchName = branches[branchCode] || '';
    return branchName ? `${branchCode} - ${branchName}` : branchCode;
  }

  // Simple period info calculation - not reactive, just utility
  getAnalysisPeriod() {
    // If in load mode and we have loaded analysis info, show that instead
    if (this.analysisMode === 'load' && this.loadedAnalysisInfo && this.loadedAnalysisInfo.date) {
      const loadedDate = new Date(this.loadedAnalysisInfo.date);
      const formatDate = (date) => {
        return date.toLocaleDateString('ro-RO', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        });
      };
      
      return `Analiză încărcată din ${formatDate(loadedDate)} pentru ${this.loadedAnalysisInfo.branch || this.getBranchDisplay()}`;
    }
    
    // Default behavior for calculate mode or when no loaded info
    // This will now work for both calculate mode AND load mode when period parameters are available
    if (!this.params.dataReferinta || !this.params.nrSaptamani) {
      return 'Parametrii de perioadă nu sunt disponibili.';
    }

    const referenceDate = new Date(this.params.dataReferinta);
    const weeksAgo = this.params.nrSaptamani;
    
    // Calculate start date (reference date minus number of weeks)
    const startDate = new Date(referenceDate);
    startDate.setDate(startDate.getDate() - (weeksAgo * 7));
    
    // Format dates
    const formatDate = (date) => {
      return date.toLocaleDateString('ro-RO', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
    };

    const startDateStr = formatDate(startDate);
    const endDateStr = formatDate(referenceDate);
    
    return `${startDateStr} - ${endDateStr} (${weeksAgo} săptămâni)`;
  }

  render() {
    return html`

      <div class="abc-container">
        <div class="abc-header d-flex justify-content-between align-items-center mb-3">
          <div class="d-flex align-items-center gap-3">
            <button @click=${this.toggleSettings} class="btn btn-sm btn-outline-secondary">
              <i class="fas ${this.showSettings ? 'fa-eye-slash' : 'fa-eye'}"></i>
              ${this.showSettings ? 'Hide Settings' : 'Show Settings'}
            </button>
            
            <!-- Mode Toggle -->
            <div class="d-flex align-items-center">
              <label class="form-label me-2 mb-0 fw-semibold">Analysis Mode:</label>
              <select class="form-select form-select-sm" @change=${this.handleModeChange} .value=${this.analysisMode}>
                <option value="calculate">Calculate New Analysis</option>
                <option value="load">Load Latest Saved Analysis</option>
              </select>
            </div>
          </div>
          <!-- Button group for save/export/reset actions -->
          <div class="btn-group btn-group-sm">
            <button class="btn btn-success" @click=${this.handleSaveData} ?disabled=${this.loading || this.progress.show || this.data.length === 0}>
              <i class="bi bi-save me-1"></i> Save
            </button>
            <button class="btn btn-secondary" @click=${this.exportToExcel} ?disabled=${this.data.length === 0}>
              <i class="bi bi-file-excel me-1"></i> Export
            </button>
            <button class="btn btn-danger" @click=${this.handleResetData} ?disabled=${this.loading || this.progress.show}
                    data-bs-toggle="tooltip" data-bs-placement="top" title="Clear interface (filters, data, and charts) - does not affect saved data">
              <i class="bi bi-x-circle me-1"></i> Reset
            </button>
          </div>
          ${!this.loading && this.totalSales > 0 && this.params.branch ? html`
            <div class="badge bg-info text-light p-2 fs-6 d-flex align-items-center">
              <i class="fas fa-chart-line me-2"></i>
              <span class="text-light">
                Total Sales: ${this.totalSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                <span class="ms-2 badge bg-light text-dark">
                  Branch: ${this.getBranchDisplay()}
                </span>
              </span>
            </div>
          ` : ''}
        </div>

        ${this.showSettings ? html`
          <top-abc-control-panel 
            .token=${this.token}
            .loading=${this.loading} // Pass loading state
            @params-changed=${this.handleParamsChanged}
            @apply-filters=${this.handleApplyFilters}>
          </top-abc-control-panel>
        ` : ''}

        <!-- Period Info - Shared by Chart and Table -->
        <div class="alert alert-light border d-flex align-items-center mb-3" role="info">
          <i class="fas fa-calendar-alt me-2 text-primary"></i>
          <div>
            <strong>📅 Perioada analizată: ${this.getAnalysisPeriod()}</strong>
            ${this.analysisMode === 'load' && this.loadedAnalysisInfo && this.loadedAnalysisInfo.message ?
              html`<br><small class="text-muted">Detalii analiză încărcată: ${this.loadedAnalysisInfo.message}</small>` :
            this.params.dataReferinta && this.params.nrSaptamani ?
              html`<br><small class="text-muted">Parametri analiză: Data referință: ${this.params.dataReferinta} | Săptămâni analizate: ${this.params.nrSaptamani}</small>` :
              html`<br><small class="text-muted">Parametrii de perioadă nu sunt disponibili.</small>`
            }
          </div>
        </div>

        ${this.error ? html`
          <div class="alert alert-danger d-flex align-items-center mt-3 mb-3" role="alert">
            <i class="fas fa-exclamation-circle me-2"></i>
            <div>${this.error}</div>
          </div>
        ` : ''}
        
        ${this.loading ? html`
          <div class="alert alert-info d-flex align-items-center mt-3 mb-3" role="alert">
            <div class="spinner-border spinner-border-sm me-2" role="status">
              <span class="visually-hidden">Loading...</span>
            </div>
            <div>Loading data...</div>
          </div>
        ` : ''}

        <!-- Progress Indicator for Chunked Save Operations -->
        ${this.progress.show ? html`
          <div class="alert alert-primary d-flex align-items-start mt-3 mb-3" role="alert">
            <div class="me-3">
              <i class="fas ${this.progress.stage === 'reset' ? 'fa-database' : 
                           this.progress.stage === 'chunks' ? 'fa-layer-group' : 
                           this.progress.stage === 'complete' ? 'fa-check-circle' : 'fa-cog'} me-2"></i>
            </div>
            <div class="flex-grow-1">
              <div class="d-flex justify-content-between align-items-center mb-2">
                <strong>${this.progress.stage === 'reset' ? 'Preparing Save Operation' : 
                        this.progress.stage === 'chunks' ? 'Saving Large Dataset' : 
                        this.progress.stage === 'complete' ? 'Save Completed' : 'Processing'}</strong>
                <span class="badge bg-primary">${this.progress.percentage}%</span>
              </div>
              <div class="progress mb-2" style="height: 8px;">
                <div class="progress-bar progress-bar-striped ${this.progress.stage !== 'complete' ? 'progress-bar-animated' : ''}" 
                     role="progressbar" 
                     style="width: ${this.progress.percentage}%"
                     aria-valuenow="${this.progress.percentage}" 
                     aria-valuemin="0" 
                     aria-valuemax="100">
                </div>
              </div>
              <small class="text-muted">${this.progress.message}</small>
              ${this.progress.total > 0 ? html`
                <div class="mt-1">
                  <small class="text-muted">
                    ${this.progress.current.toLocaleString()} / ${this.progress.total.toLocaleString()} 
                    ${this.progress.stage === 'chunks' ? 'chunks processed' : 'items processed'}
                  </small>
                </div>
              ` : ''}
            </div>
          </div>
        ` : ''}

        <!-- Total Sales now displayed in header -->

        ${!this.loading && this.summary.length > 0 ? html`
          <div class="card mb-4 border-light shadow-sm">
            <div class="card-header bg-light d-flex justify-content-between align-items-center">
              <h5 class="card-title mb-0">Summary by Class</h5>
              <div class="badge bg-secondary">
                ${this.summary.length} Categories
              </div>
            </div>
            <div class="card-body p-0">
              <table class="table table-sm table-bordered table-hover mb-0">
                <thead class="table-light">
                  <tr>
                    <th>Class</th>
                    <th>Item Count</th>
                    <th>Class Total</th>
                    <th>Items %</th>
                    <th>Value %</th>
                  </tr>
                </thead>
                <tbody>
                  ${this.summary.map(item => html`
                    <tr>
                      <td>
                        <span class="badge ${item.ABC === 'A' ? 'bg-success' : 
                                          item.ABC === 'B' ? 'bg-primary' : 
                                          'bg-warning text-light'}">${item.ABC}</span>
                      </td>
                      <td class="text-end">${item.ITEMCOUNT || 0}</td>
                      <td class="text-end">${(item.CLASSTOTAL || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td class="text-end">${(item.ITEMSPERC || 0).toFixed(2)}%</td>
                      <td class="text-end">${(item.VALUEPERC || 0).toFixed(2)}%</td>
                    </tr>
                  `)}
                </tbody>
              </table>
            </div>
          </div>
        ` : ''}

        <ul class="nav nav-tabs mb-3">
          <li class="nav-item">
            <a class="nav-link ${this.activeTab === 'chart' ? 'active' : ''}" href="#" @click=${(e) => {e.preventDefault(); this.switchTab('chart');}}>
              <i class="fas fa-chart-pie me-1"></i> Chart View
            </a>
          </li>
          <li class="nav-item">
            <a class="nav-link ${this.activeTab === 'table' ? 'active' : ''}" href="#" @click=${(e) => {e.preventDefault(); this.switchTab('table');}}>
              <i class="fas fa-table me-1"></i> Table View
            </a>
          </li>
        </ul>

        <div class="tab-content">
          <div class="tab-pane fade ${this.activeTab === 'chart' ? 'show active' : ''}" id="chart-tab">
            ${this.activeTab === 'chart' ? html`
              <top-abc-chart 
                .token=${this.token}
                .data=${this.data}
                .params=${this.params}
                @refresh-data=${this.handleRefreshData}>
              </top-abc-chart>
            ` : ''}
          </div>
          <div class="tab-pane fade ${this.activeTab === 'table' ? 'show active' : ''}" id="table-tab">
            ${this.activeTab === 'table' ? html`
              <top-abc-table .data=${this.data}></top-abc-table>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }
}

// Register the custom element
customElements.define('top-abc-container', TopAbcContainer);
