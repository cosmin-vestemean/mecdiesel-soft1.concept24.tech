// Loading State Monitor for Live Testing
// Copy and paste this into the browser console to monitor loading state in real-time

console.log('🔍 [LOADING MONITOR] Starting loading state monitor...');

// Create a simple UI monitor
const monitorDiv = document.createElement('div');
monitorDiv.id = 'loading-state-monitor';
monitorDiv.style.cssText = `
  position: fixed;
  top: 10px;
  right: 10px;
  background: rgba(0,0,0,0.9);
  color: white;
  padding: 15px;
  border-radius: 8px;
  font-family: monospace;
  font-size: 12px;
  z-index: 9999;
  min-width: 300px;
  border: 2px solid #007bff;
`;

monitorDiv.innerHTML = `
  <div style="color: #00ff00; font-weight: bold;">🔍 Loading State Monitor</div>
  <div>Loading: <span id="monitor-loading">unknown</span></div>
  <div>Error: <span id="monitor-error">unknown</span></div>
  <div>Data Count: <span id="monitor-data">unknown</span></div>
  <div>Last Update: <span id="monitor-time">never</span></div>
  <div style="margin-top: 10px;">
    <button onclick="window.testTransfer()" style="background: #28a745; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer; margin-right: 5px;">Test Transfer</button>
    <button onclick="this.parentElement.parentElement.remove()" style="background: #dc3545; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer;">Close</button>
  </div>
`;

document.body.appendChild(monitorDiv);

// Monitor function
function updateMonitor() {
  try {
    if (window.replenishmentStore) {
      const state = window.replenishmentStore.getState();
      
      document.getElementById('monitor-loading').textContent = state.loading;
      document.getElementById('monitor-loading').style.color = state.loading ? '#ffc107' : '#28a745';
      
      document.getElementById('monitor-error').textContent = state.error || 'none';
      document.getElementById('monitor-error').style.color = state.error ? '#dc3545' : '#28a745';
      
      document.getElementById('monitor-data').textContent = state.data ? state.data.length : 0;
      document.getElementById('monitor-time').textContent = new Date().toLocaleTimeString();
    } else {
      document.getElementById('monitor-loading').textContent = 'Store not found';
      document.getElementById('monitor-loading').style.color = '#dc3545';
    }
  } catch (error) {
    console.error('Monitor error:', error);
  }
}

// Test function
window.testTransfer = async function() {
  console.log('🧪 [LOADING MONITOR] Starting test transfer...');
  
  try {
    const component = document.querySelector('branch-replenishment-container');
    if (!component) {
      console.error('❌ [LOADING MONITOR] Component not found!');
      alert('Component not found! Make sure you are on the branch replenishment page.');
      return;
    }

    // Setup minimal test data
    if (window.replenishmentStore) {
      const currentState = window.replenishmentStore.getState();
      
      if (!currentState.data || currentState.data.length === 0) {
        console.log('🔧 [LOADING MONITOR] Setting up test data...');
        
        const testData = [{
          mtrl: 'TEST001',
          mtrldesc: 'Test Product',
          transfer: 1,
          branchD: '1200',
          keyField: 'test1'
        }];
        
        window.replenishmentStore.setData(testData);
        window.replenishmentStore.setBranchesEmit('1000');
        window.replenishmentStore.setSelectedDestBranches(['1200']);
        
        console.log('✅ [LOADING MONITOR] Test data set up');
      }

      // Mock confirmation dialog to avoid user interaction
      const originalConfirm = component._showConfirmationDialog;
      component._showConfirmationDialog = () => {
        console.log('✅ [LOADING MONITOR] Auto-confirming transfer dialog');
        return Promise.resolve(true);
      };

      // Mock client to simulate quick success
      const originalClient = window.client;
      window.client = {
        service: () => ({
          setData: () => {
            console.log('✅ [LOADING MONITOR] Mock successful response');
            return Promise.resolve({ success: true, id: 'TEST123' });
          }
        })
      };

      console.log('🚀 [LOADING MONITOR] Triggering _handleSaveData...');
      
      // Call the actual method
      await component._handleSaveData();
      
      // Restore originals
      component._showConfirmationDialog = originalConfirm;
      window.client = originalClient;
      
      console.log('✅ [LOADING MONITOR] Test transfer completed');
      
    } else {
      console.error('❌ [LOADING MONITOR] Store not available');
      alert('Store not available! Make sure you are on the branch replenishment page.');
    }
    
  } catch (error) {
    console.error('❌ [LOADING MONITOR] Test error:', error);
    alert(`Test error: ${error.message}`);
  }
};

// Start monitoring
const monitorInterval = setInterval(updateMonitor, 200);
updateMonitor(); // Initial update

console.log('✅ [LOADING MONITOR] Monitor started - updating every 200ms');
console.log('📋 [LOADING MONITOR] Instructions:');
console.log('  1. Navigate to the branch replenishment page');
console.log('  2. Watch the monitor in the top-right corner');
console.log('  3. Click "Test Transfer" to test the loading state fix');
console.log('  4. Or use the regular UI and watch loading state changes');

// Cleanup function (optional)
window.stopLoadingMonitor = function() {
  clearInterval(monitorInterval);
  const monitor = document.getElementById('loading-state-monitor');
  if (monitor) monitor.remove();
  console.log('🛑 [LOADING MONITOR] Monitor stopped and removed');
};
