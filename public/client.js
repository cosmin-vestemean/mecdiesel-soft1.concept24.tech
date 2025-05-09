import { client } from './socketConfig.js';
import { renderData } from './renderTable.js';
import { 
  getItemsFromService, connectToS1, getMappings, getErrors,
  getMesagerieConvAuto, getSchimbareStoc, getAllSoSourceObjectsRo
} from './dataFetching.js';
import { shared } from './shared.js';

// Wrap initialization logic in a function
function initializeApp() {
  // Use the stored token/clientID from login if available
  const token = sessionStorage.getItem('s1Token'); 

  if (!token) {
    console.error("No token found after login. Cannot initialize app.");
    // Optionally redirect back to login or show an error
    return; 
  }

  // Initial data load using the obtained token
  // Note: connectToS1 might not be needed if login already established connection/token
  // Adjust data fetching calls to use the stored token directly
  getMappings(token, (mappings) => {
    renderData(mappings, "#mappings");
  });
  getErrors(token, (errors) => {
    renderData(errors, "#errors");
  });
  getMesagerieConvAuto(token, (mesagerie) => {
    renderData(mesagerie, "#convAuto");
  });
  getSchimbareStoc(token, (schimbareStoc) => {
    renderData(schimbareStoc, "#stockChanges");
  });

  // Initialize event handlers
  import('./userInteractions.js')
    .then(module => {
      module.initializeUserInteractions();
    });
}

// Expose the initialization function globally so login.js can call it
window.initializeApp = initializeApp;
