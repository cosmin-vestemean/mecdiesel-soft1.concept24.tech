import { client } from './socketConfig.js';
import { renderData } from './renderTable.js';
import { 
  getItemsFromService, connectToS1, getMappings, getErrors,
  getMesagerieConvAuto, getSchimbareStoc, getAllSoSourceObjectsRo
} from './dataFetching.js';
import { shared } from './shared.js';

// Wait for DOM to be ready
$(document).ready(() => {
  // Initial data load
  connectToS1((token) => {
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
  });

  // Initialize event handlers
  import('./userInteractions.js')
    .then(module => {
      module.initializeUserInteractions();
    });
});
