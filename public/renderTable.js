import { shared } from './shared.js';
import { getItemsFromService } from './dataFetching.js';
import './dataTable.js';

function renderTable(dbtable, htmltable, skip = 0) {
  var options = {};
  switch (dbtable) {
    case "mec_item":
      options = {
        $limit: shared.htmlLimit,
        Company_ID: 2,
        $sort: {
          Modify_date: -1,
        },
      };
      if (skip) {
        options.$skip = skip;
      }
      getItemsFromService(dbtable, htmltable, options);
      break;
    case "mec_item_producer_relation":
      options = {
        $limit: shared.htmlLimit,
        Company_ID: 2,
        $sort: {
          Modify_date: -1,
        },
      };
      if (skip) {
        options.$skip = skip;
      }
      getItemsFromService(dbtable, htmltable, options);
      break;
    case "site_product_changes_history":
      options = {
        $limit: shared.htmlLimit,
        $sort: {
          updated_at: -1,
        },
      };
      if (skip) {
        options.$skip = skip;
      }
      getItemsFromService(dbtable, htmltable, options);
      break;
    case "site_product_frequent_changes":
      options = {
        $limit: shared.htmlLimit,
        company_id: 2,
        $sort: {
          updated_at: -1,
        },
      };
      if (skip) {
        options.$skip = skip;
      }
      getItemsFromService(dbtable, htmltable, options);
      break;
    case "mec_item_altref":
      options = {
        $limit: shared.htmlLimit,
        $sort: {
          Item: 1,
        },
      };
      if (skip) {
        options.$skip = skip;
      }
      getItemsFromService(dbtable, htmltable, options);
      break;
    case "mec_ro_item_rel_supplier":
      options = {
        $limit: shared.htmlLimit,
        $sort: {
          mec_code: 1,
        },
      };
      if (skip) {
        options.$skip = skip;
      }
      getItemsFromService(dbtable, htmltable, options);
      break;
  }
}

function renderData(items, htmlElementId) {
  console.log("rendering " + htmlElementId);
  console.log(items);
  
  if (!items || (items && items.length == 0)) {
    const dataTable = document.querySelector(htmlElementId);
    if (dataTable) {
      dataTable.items = [];
    }
    return;
  }
  
  var skipNr = 0;
  switch (htmlElementId) {
    case "#items":
      skipNr = shared.skip;
      break;
    case "#errors": 
      skipNr = shared.skipErr;
      break;
    case "#convAuto":
      skipNr = shared.skipConvAuto;
      break;
    case "#mappings":
      skipNr = shared.skipMappings;
      break;
    case "#stockChanges":
      skipNr = shared.skipStock;
      break;
  }
  
  // Set properties directly on the custom element
  const dataTable = document.querySelector(htmlElementId);
  if (dataTable) {
    dataTable.skipNr = skipNr;
    dataTable.items = items; // This triggers a render in the custom element
    
    // Store pagination info as attributes for later use
    dataTable.setAttribute('data-skip', skipNr);
    dataTable.setAttribute('data-count', items.length);
  }
}

export { renderTable, renderData };