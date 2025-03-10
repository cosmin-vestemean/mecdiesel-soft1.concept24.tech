import { shared } from './shared.js';
import { getItemsFromService } from './dataFetching.js';

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

  //find the lengthier item as object and assign it to columnNo
  var itemsClone = [...items];
  itemsClone.sort((a, b) => Object.keys(b).length - Object.keys(a).length);
  var columnNo = Object.keys(itemsClone[0]).length;
  var cells = "<th>Row</th>";
  for (var i = 0; i < columnNo; i++) {
    //do not display is_signaled
    if (Object.keys(items[0])[i].toLowerCase() == "is_signaled") {
      continue;
    } else {
      cells += `<th>${Object.keys(items[0])[i]}</th>`;
    }
  }
  $(htmlElementId).append(`<thead><tr>
    ${cells}
  </tr></thead>`);

  var cells = "";
  var rowCounter = 0;
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
  items.forEach((item) => {
    rowCounter++;
    //if item has key is_signaled and its value is 0, it's just a secondary grade info, so paint it info
    if (Object.keys(item).includes("is_signaled") && item.is_signaled == 0) {
      cells += `<tr class="table-light">`;
    } else {
      cells += `<tr>`;
    }
    //cells += `<tr>`;
    //append row number
    cells += `<td>${rowCounter + skipNr}</td>`;
    //append values
    for (var i = 0; i < columnNo; i++) {
      switch (Object.keys(item)[i].toLowerCase()) {
        case "stoc":
          if (Object.values(item)[i] == 0) {
            if (item.is_signaled > 0) {
              cells += `<td class="fw-bold text-danger">${
                Object.values(item)[i]
              }<i class="fas fa-caret-down me-1"></i></td>`;
            } else {
              cells += `<td>${Object.values(item)[i]}</td>`;
            }
          } else {
            if (Object.values(item)[i] > 0) {
              if (item.is_processed == -1 && item.is_available == -1) {
                cells += `<td>${Object.values(item)[i]}</td>`;
              } else {
                cells += `<td class="fw-bold text-success">${
                  Object.values(item)[i]
                }<i class="fas fa-caret-up me-1"></i></td>`;
              }
            }
          }
          break;
        case "is_processed":
          if (item.is_processed == -1) {
            cells += `<td class="table-light">-</td>`;
          } else {
            cells += `<td>${Object.values(item)[i]}</td>`;
          }
          break;
        case "is_available":
          if (item.is_available == -1) {
            cells += `<td class="table-light">-</td>`;
          } else {
            cells += `<td>${Object.values(item)[i]}</td>`;
          }
          break;
        //do not display is_signaled
        case "is_signaled":
          break;
        default:
          cells += `<td>${Object.values(item)[i]}</td>`;
          break;
      }
    }
    cells += `</tr>`;
  });
  $(htmlElementId).append(`<tbody>${cells}</tbody>`);
}

export { renderTable, renderData };