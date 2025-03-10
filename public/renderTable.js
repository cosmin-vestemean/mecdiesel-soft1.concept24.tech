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
  $(htmlElementId).empty();
  
  if (!items || (items && items.length == 0)) {
    $(htmlElementId).append(
      `<tr><td><h2 class="text-danger">No data</h2></td></tr>`
    );
    return;
  }
  
  if (Object.keys(items[0]).includes("is_signaled")) {
    //remove class table-striped from table htmlElementId
    $(htmlElementId).removeClass("table-striped");
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
  
  // Create table header
  const columns = Object.keys(items[0]);
  const headerRow = document.createElement('tr');
  
  // Add header cells
  columns.forEach(column => {
    const headerCell = document.createElement('th');
    headerCell.textContent = column;
    headerRow.appendChild(headerCell);
  });
  
  // Create a table header element and append the header row
  const tableHeader = document.createElement('thead');
  tableHeader.appendChild(headerRow);
  
  // Create table body
  const tableBody = document.createElement('tbody');
  
  // Add data rows
  items.forEach((item, index) => {
    const dataRow = document.createElement('tr');
    
    // Add special styling for signaled items if applicable
    if (item.is_signaled) {
      dataRow.classList.add('table-warning');
    }
    
    // Add data cells
    columns.forEach(column => {
      const cell = document.createElement('td');
      
      // Handle different data types appropriately
      if (item[column] === null || item[column] === undefined) {
        cell.textContent = '';
      } else if (typeof item[column] === 'object') {
        cell.textContent = JSON.stringify(item[column]);
      } else {
        cell.textContent = item[column];
      }
      
      dataRow.appendChild(cell);
    });
    
    tableBody.appendChild(dataRow);
  });
  
  // Add the index number to the table element for pagination tracking
  const dataTable = document.querySelector(htmlElementId);
  if (dataTable) {
    dataTable.setAttribute('data-skip', skipNr);
    dataTable.setAttribute('data-count', items.length);
    
    // Clear and update the data-table content
    dataTable.innerHTML = '';
    dataTable.appendChild(tableHeader);
    dataTable.appendChild(tableBody);
  }
}

export { renderTable, renderData };