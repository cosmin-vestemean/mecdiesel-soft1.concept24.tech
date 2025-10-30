import { shared } from './shared.js';
import { renderTable, renderData } from './renderTable.js';
import {
  getS1Data,
  getSchimbareStoc,
  getErrors,
  getMesagerieConvAuto,
  getMappings,
  connectToS1,
  getAllSoSourceObjectsRo,
  getAllFprmsForSoSource,
  getAllSeriesForFprms,
  getPrintTemplates,
  getAllPrintTemplatesForSoSource,
  getItemsFromService
} from './dataFetching.js';
import { client } from './socketConfig.js';
import { paginationManager } from './paginationManager.js';
import { hierarchicalNav } from './hierarchical-navigation.js';

let codes = [];
let isStopped = false;

// Define the batch request functions
function makeBatchRequest(token, batch) {
  return client.service("s1").makeBatchRequest({
    token: token,
    codes: batch
  });
}

function processListOfStocks(token, batch) {
  return client.service("s1").processListOfStocks({
    token: token,
    codes: batch
  });
}

export function initializeUserInteractions() {
  //show #mainContent, hidden by default with d-none class
  $("#mainContent").removeClass("d-none");
  renderTable(shared.table, "#items");

  $("#tables").change(() => {
    shared.table = $("#tables").val();
    shared.skip = 0;
    $("#searchItems").val("");
    renderTable(shared.table, "#items");
  });

  $("#firstItems").click(() => {
    shared.skip = 0;
    renderTable(shared.table, "#items", shared.skip);
  });

  $("#firstErrors").click(() => {
    shared.skipErr = 0;
    getS1Data("Loading messages, please wait...", "#errors", getErrors);
  });

  $("#firstConvAuto").click(() => {
    shared.skipConvAuto = 0;
    getS1Data(
      "Loading mesagerie conversie automata, please wait...",
      "#convAuto",
      getMesagerieConvAuto
    );
  });

  $("#firstMappings").click(() => {
    shared.skipMappings = 0;
    getS1Data("Loading mappings, please wait...", "#mappings", getMappings);
  });

  $("#firstStockChanges").click(() => {
    shared.skipStock = 0;
    getS1Data("Loading stock, please wait...", "#stockChanges", getSchimbareStoc);
  });

  $("#nextItems").click(() => {
    paginationManager.paginate(1);
  });

  $("#nextErrors").click(() => {
    paginationManager.paginate(1);
  });

  $("#nextConvAuto").click(() => {
    paginationManager.paginate(1);
  });

  $("#nextMappings").click(() => {
    paginationManager.paginate(1);
  });

  $("#nextStockChanges").click(() => {
    paginationManager.paginate(1);
  });

  $("#prevItems").click(() => {
    paginationManager.paginate(-1);
  });

  $("#prevErrors").click(() => {
    paginationManager.paginate(-1);
  });

  $("#prevConvAuto").click(() => {
    paginationManager.paginate(-1);
  });

  $("#prevMappings").click(() => {
    paginationManager.paginate(-1);
  });

  $("#prevStockChanges").click(() => {
    paginationManager.paginate(-1);
  });

  const arrOfHtmlElements = [
    "itemsContent",
    "tables",
    "tablesLabel",
    "searchItems",
    "mappingsContent",
    "errorsContent",
    "convAutoContent",
    "stockChangesContent",
    "batchApp",
    "batchSize",
    "print_config",
    "branchReplenishContent", // Make sure this is included
    "searchErrors",
    "searchStockChanges",
    "stockChangesSelect",
    "stockChangesCheckbox",
    "stockChangesLabel",
    "stockChangesCheckboxVerbose",
    "stockChangesLabelVerbose",
    "necesarAchizitiiContent",
    "topAbcContent",
  ];

  function hideAllButArray(arr) {
    arrOfHtmlElements.forEach((elem) => {
      if (!arr.includes(elem)) {
        $("#" + elem).hide();
      }
    });

    arr.forEach((elem) => {
      $("#" + elem).show();
    });
  }

  // Updated tab handlers to work with hierarchical navigation
  $("#mappingsButton").click(() => {
    hideAllButArray(["mappingsContent"]);
    paginationManager.setActiveTab("mappingsButton");
  });

  $("#errorsButton").click(() => {
    hideAllButArray(["errorsContent", "searchErrors"]);
    paginationManager.setActiveTab("errorsButton");
    if (!document.getElementById("searchErrors")) {
      var input = document.createElement("input");
      input.setAttribute("type", "text");
      input.setAttribute("id", "searchErrors");
      input.setAttribute("class", "form-control");
      input.setAttribute("placeholder", "Cautare cod...");
      input.style.width = "100%";
      input.setAttribute("spellcheck", "false");
      if (!document.getElementById("searchErrors")) {
        document.getElementById("errorsButton").appendChild(input);
        document.getElementById("searchErrors").oninput = async () => {
          if ($("#searchErrors").val().length > 4) {
            const SQL =
              "select date as [Data inregistrarii], executed [Ref. interna] , message [Mesaj], MTRL, code [Cod], isBatchProcessing [Batch], usr [Utilizator] " +
              "from CCCITALYSYNCLOG " +
              "where code like '%" +
              $("#searchErrors").val() +
              "%' " +
              "order by date desc, mtrl desc, CCCITALYSYNCLOG DESC ";
            console.log(SQL);

            connectToS1((token) => {
              client
                .service("s1")
                .getSqlDataset({
                  token: token,
                  SQL: SQL,
                })
                .then((res) => {
                  console.log(res);
                  renderData(res.rows, "#errors");
                });
            });
          }

          if ($("#searchErrors").val().length == 0) {
            getS1Data("Loading messages, please wait...", "#errors", getErrors);
          }
        };
      }
    } else {
      $("#searchErrors").show();
    }
  });

  $("#convAutoButton").click(() => {
    hideAllButArray(["convAutoContent"]);
    paginationManager.setActiveTab("convAutoButton");
  });

  $("#batchButton").click(() => {
    hideAllButArray(["batchApp", "batchSize", "batchTable", "batchStatus"]);
    paginationManager.setActiveTab("batchButton");
  });

  $("#stockChangesButton").click(() => {
    if (!document.getElementById("searchStockChanges")) {
      var input = document.createElement("input");
      input.setAttribute("type", "text");
      input.setAttribute("id", "searchStockChanges");
      input.setAttribute("class", "form-control");
      input.setAttribute("placeholder", "Cautare cod...");
      input.style.width = "100%";
      input.setAttribute("spellcheck", "false");
      if (!document.getElementById("searchStockChanges")) {
        document.getElementById("stockChangesButton").appendChild(input);
        document.getElementById("searchStockChanges").oninput = () => {
          if ($("#searchStockChanges").val().length > 4) {
            connectToS1((token) => {
              getSchimbareStoc(
                token,
                (schimbareStoc) => {
                  renderData(schimbareStoc, "#stockChanges");
                },
                $("#searchStockChanges").val()
              );
            });
          }

          if ($("#searchStockChanges").val().length == 0) {
            getS1Data(
              "Loading stock changes, please wait...",
              "#stockChanges",
              getSchimbareStoc
            );
          }
        };
      }
    } else {
      $("#searchStockChanges").show();
    }

    hideAllButArray([
      "stockChangesContent",
      "searchStockChanges",
      "stockChangesSelect",
      "stockChangesCheckbox",
      "stockChangesLabel",
      "stockChangesCheckboxVerbose",
      "stockChangesLabelVerbose",
    ]);
    
    // Update active tab in pagination manager
    paginationManager.setActiveTab("stockChangesButton");
  });

  $("#stockChangesCheckbox").change(() => {
    getS1Data(
      "Loading stock changes, please wait...",
      "#stockChanges",
      getSchimbareStoc
    );
  });

  $("#printConfigButton").click(() => {
    hideAllButArray(["print_config"]);
    paginationManager.setActiveTab("printConfigButton");
    connectToS1((token) => {
      getAllSoSourceObjectsRo(token, (sosourceOptions) => {
        addOptions(sosourceOptions, ".sosource", "sosource");
      });
    });
  });

  $("#branchReplenishButton").click(() => {
    hideAllButArray(["branchReplenishContent"]);
    paginationManager.setActiveTab("branchReplenishButton");
  });

  //necesarAchizitiiButton
  $("#necesarAchizitiiButton").click(() => {
    hideAllButArray(["necesarAchizitiiContent"]);
    paginationManager.setActiveTab("necesarAchizitiiButton");
  });

  $("#topAbcButton").click(() => {
    hideAllButArray(["topAbcContent"]);
    paginationManager.setActiveTab("topAbcButton");
  });

  // Update items button handler to work with hierarchical navigation
  $("#itemsButton").click(() => {
    hideAllButArray(["itemsContent", "searchItems", "tables", "tablesLabel"]);
    paginationManager.setActiveTab("itemsButton");
  });

  $("#mappingsButton").click();

  document.getElementById("errorsReload").onclick = () => {
    shared.skipErr = 0; // Reset skip value
    getS1Data("Loading messages, please wait...", "#errors", getErrors);
    // Clear the search input value
    const searchErrors = document.getElementById("searchErrors");
    if (searchErrors) {
      searchErrors.value = "";
    }
    // Update pagination status
    paginationManager.updatePaginationStatus();
  };

  document.getElementById("convAutoReload").onclick = () => {
    shared.skipConvAuto = 0; // Reset skip value
    getS1Data(
      "Loading mesagerie conversie auto, please wait...",
      "#convAuto",
      getMesagerieConvAuto
    );
    // Update pagination status
    paginationManager.updatePaginationStatus();
  };

  document.getElementById("stockChangesReload").onclick = () => {
    shared.skipStock = 0; // Reset skip value
    getS1Data(
      "Loading stock changes, please wait...",
      "#stockChanges",
      getSchimbareStoc
    );
    // Update pagination status
    paginationManager.updatePaginationStatus();
  };

  document.getElementById("mappingsReload").onclick = () => {
    shared.skipMappings = 0; // Reset skip value
    getS1Data("Loading mappings, please wait...", "#mappings", getMappings);
    // Update pagination status
    paginationManager.updatePaginationStatus();
  };

  document.getElementById("itemsReload").onclick = () => {
    shared.skip = 0; // Reset skip value
    renderTable(shared.table, "#items");
    // Update pagination status
    paginationManager.updatePaginationStatus();
  };

  document.getElementById("stopBatch").onclick = () => {
    $("#batchStatus").html("Stopped");
    isStopped = true;
    $("#process").prop("disabled", false);
    $("upload").prop("disabled", false);
  };

  document.getElementById("upload").onchange = () => {
    $("#batchStatus").html("Loading codes...");
    const files = document.getElementById("upload").files;

    if (!validateUploadFile(files)) return;

    const fr = new FileReader();
    fr.onload = function (e) {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: "array" });

      workbook.SheetNames.forEach(function (sheetName) {
        const roa = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
        if (roa.length > 0) {
          codes = roa;
        }
      });

      const batchTable = document.querySelector('#batchTable');
      if (batchTable) {
        batchTable.items = codes;
        // Force layout recalculation
        setTimeout(() => {
          batchTable.requestUpdate();
          document.getElementById('batchApp').dispatchEvent(new Event('resize'));
        }, 100);
      }
    };

    fr.readAsArrayBuffer(files.item(0));
    $("#batchStatus").html("");
  };

  // Helper function to validate upload file
  function validateUploadFile(files) {
    if (files.length <= 0) {
      $("#batchStatus").html("No file selected");
      return false;
    }
    if (files[0].type !== "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
      $("#batchStatus").html("Only xlsx files allowed");
      return false;
    }
    if (files[0].size > 1000000) {
      $("#batchStatus").html("File size must be less than 1MB");
      return false;
    }

    $("#batchFileName").html(files[0].name);
    return true;
  }

  document.getElementById("process").onclick = () => {
    var checked = false;

    $("#process").prop("disabled", true);
    $("#upload").prop("disabled", true);
    $("#batchRadio").prop("disabled", true);
    if (document.getElementById("moveItemsOnline").checked) {
      checked = true;
      $("#batchStatus").html("Processing list for sending to webshop...");
      batchProcessList(makeBatchRequest);
    } else if (document.getElementById("stockEvidence").checked) {
      checked = true;
      $("#batchStatus").html("Processing list for stock evidence...");
      batchProcessList(processListOfStocks);
    }
    if (!checked) {
      $("#batchStatus").html("Please select an option");
      $("#process").prop("disabled", false);
      $("#upload").prop("disabled", false);
      $("#batchRadio").prop("disabled", false);
      return;
    }
  };

  function batchProcessList(next) {
    var batchSize = $("#batchSize").val();
    if (batchSize < 1 || batchSize > 100) {
      $("#batchStatus").html("Batch size must be between 1 and 100");
      return;
    }

    $("#batchStatus").html("Batch process started");

    var batch = [];
    for (var i = 0; i < codes.length; i++) {
      batch.push(codes[i][Object.keys(codes[i])[0]]);
      if (batch.length == batchSize) {
        break;
      }
    }

    try {
      console.log("next", next.name);
      connectToS1((token) => {
        next(token, batch).then((res) => {
          console.log("res", res);
          if (codes.length > 0) {
            codes.splice(0, batchSize);
            renderData(codes, "#batchTable");
            if (isStopped) {
              return;
            } else {
              batchProcessList(next);
            }
          } else {
            $("#batchStatus").html(
              "Batch process finished, last file processed: " +
              $("#upload").val().split("\\").pop()
            );
            $("#process").prop("disabled", false);
            $("#upload").prop("disabled", false);
            $("#upload").val("");
          }
        });
      });
    } catch (err) {
      console.log(err);
      $("#batchStatus").html(
        "Batch process failed, last file processed: " +
        $("#upload").val().split("\\").pop()
      );
      $("#process").prop("disabled", false);
      $("#upload").prop("disabled", false);
      $("#upload").val("");
    }
  }

  document.getElementById("searchItems").oninput = () => {
    const searchTerm = $("#searchItems").val();

    if (searchTerm.length > 4) {
      let query = {};
      switch (shared.table) {
        case "mec_item":
        case "mec_item_producer_relation":
        case "mec_item_altref":
          query = { Item: searchTerm };
          break;
        case "site_product_changes_history":
        case "site_product_frequent_changes":
        case "mec_ro_item_rel_supplier":
          query = { mec_code: searchTerm };
          break;
        default:
          query = {};
      }

      getItemsFromService(shared.table, "#items", query)
        .then((items) => {
          renderData(items, "#items");
        })
        .catch((error) => {
          console.error("Item search failed", error);
        });
    }

    if (searchTerm.length === 0) {
      renderTable(shared.table, "#items");
    }
  };

  document.getElementById("items50").onclick = () => {
    shared.htmlLimit = 50;
    renderTable(shared.table, "#items");
    getS1Data("", "#mappings", getMappings);
    getS1Data("", "#errors", getErrors);
    getS1Data("", "#convAuto", getMesagerieConvAuto);
    getS1Data("", "#stockChanges", getSchimbareStoc);
    // Update pagination status after changing limit
    paginationManager.updatePaginationStatus();
  };

  document.getElementById("items100").onclick = () => {
    shared.htmlLimit = 100;
    renderTable(shared.table, "#items");
    getS1Data("", "#mappings", getMappings); 6
    getS1Data("", "#errors", getErrors);
    getS1Data("", "#convAuto", getMesagerieConvAuto);
    getS1Data("", "#stockChanges", getSchimbareStoc);
    // Update pagination status after changing limit
    paginationManager.updatePaginationStatus();
  };

  document.getElementById("items200").onclick = () => {
    shared.htmlLimit = 200;
    renderTable(shared.table, "#items");
    getS1Data("", "#mappings", getMappings);
    getS1Data("", "#errors", getErrors);
    getS1Data("", "#convAuto", getMesagerieConvAuto);
    getS1Data("", "#stockChanges", getSchimbareStoc);
    // Update pagination status after changing limit
    paginationManager.updatePaginationStatus();
  };

  document.getElementById("items500").onclick = () => {
    shared.htmlLimit = 500;
    renderTable(shared.table, "#items");
    getS1Data("", "#mappings", getMappings);
    getS1Data("", "#errors", getErrors);
    getS1Data("", "#convAuto", getMesagerieConvAuto);
    getS1Data("", "#stockChanges", getSchimbareStoc);
    // Update pagination status after changing limit
    paginationManager.updatePaginationStatus();
  };

  document.getElementById("items1000").onclick = () => {
    shared.htmlLimit = 1000;
    renderTable(shared.table, "#items");
    getS1Data("", "#mappings", getMappings);
    getS1Data("", "#errors", getErrors);
    getS1Data("", "#convAuto", getMesagerieConvAuto);
    getS1Data("", "#stockChanges", getSchimbareStoc);
    // Update pagination status after changing limit
    paginationManager.updatePaginationStatus();
  };

  $(document).on("change", ".sosource", function () {
    var sosource = $(this).val();
    var row = $(this).closest("tr");
    var fprms = row.find(".fprms");
    connectToS1((token) => {
      getAllFprmsForSoSource(token, sosource, (frpms) => {
        fprms.html("");
        for (var i = 0; i < frpms.length; i++) {
          fprms.append(
            '<option value="' +
            frpms[i].fprms +
            '">' +
            frpms[i].name +
            "</option>"
          );
        }
      });
    });
    var series = row.find(".series");
    series.html("");
    var printTemplate = row.find(".printTemplates");
    printTemplate.html("");
  });

  $(document).on("change", ".fprms", function () {
    var fprms = $(this).val();
    var row = $(this).closest("tr");
    var sosource = row.find(".sosource");
    var seriesCell = row.find(".series");
    connectToS1((token) => {
      getAllSeriesForFprms(token, sosource.val(), fprms, (series) => {
        seriesCell.html("");
        for (var i = 0; i < series.length; i++) {
          seriesCell.append(
            '<option value="' +
            series[i].series +
            '">' +
            series[i].name +
            "</option>"
          );
        }
      });
      getAllPrintTemplatesForSoSource(token, sosource.val(), (templates) => {
        console.log("print templates for sosource=" + sosource.val(), templates);
        var printTemplate = row.find(".printTemplates");
        printTemplate.html("");
        for (var i = 0; i < templates.length; i++) {
          printTemplate.append(
            '<option value="' +
            templates[i].templates +
            '">' +
            templates[i].name +
            "</option>"
          );
        }
      });
    });
  });

  $(document).on("change", ".series", function () {
    var series = $(this).val();
    var row = $(this).closest("tr");
    var sosource = row.find(".sosource");
    var fprms = row.find(".fprms");
    var printTemplate = row.find(".printTemplates");
    connectToS1((token) => {
      getPrintTemplates(
        token,
        sosource.val(),
        fprms.val(),
        series,
        (templates) => {
          console.log("implicit template", templates);
          if (templates.length == 1) {
            printTemplate.val(templates[0].templates);
          }
          if (!templates || templates.length == 0) {
            console.log(
              "no template found for sosource=" +
              sosource.val() +
              " fprms=" +
              fprms.val() +
              " series=" +
              series
            );
          }
        }
      );
    });
  });

  window.addEventListener('resize', () => {
    const batchApp = document.getElementById('batchApp');
    if (batchApp) {
      const batchTable = document.querySelector('#batchTable');
      if (batchTable) {
        batchTable.requestUpdate();
      }
    }
  });

  // Update tab click handlers to set active tab
  const tabButtons = document.querySelectorAll('[data-bs-toggle="tab"]');
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      paginationManager.setActiveTab(button.id);
    });
  });

  // Global pagination controls
  document.getElementById('firstPage').addEventListener('click', () => {
    paginationManager.first();
  });

  document.getElementById('prevPage').addEventListener('click', () => {
    paginationManager.paginate(-1);
  });

  document.getElementById('nextPage').addEventListener('click', () => {
    paginationManager.paginate(1);
  });

  const logoutButton = document.getElementById('logoutButton');
  if (logoutButton && !logoutButton.dataset.boundLogout) {
    // Clear session data and return to the login screen cleanly
    logoutButton.addEventListener('click', () => {
      sessionStorage.removeItem('s1Token');
      sessionStorage.removeItem('s1SessionToken');
      localStorage.removeItem('layoutCollapsed');
      localStorage.removeItem('sidebarCollapsed');
      localStorage.removeItem('headerVisible');
      window.location.href = window.location.origin + window.location.pathname;
    });
    logoutButton.dataset.boundLogout = 'true';
  }

  if (!window.__preventDefaultReloadHandlerAttached) {
    // Prevent accidental browser refresh/reload and navigation that resets the app state
    
    // Prevent keyboard-triggered reload (F5, Ctrl+R, Cmd+R)
    window.addEventListener('keydown', (event) => {
      if (event.key === 'F5' || (event.key === 'r' && (event.ctrlKey || event.metaKey))) {
        event.preventDefault();
        console.log('Reload prevented - use logout button to exit');
      }
    });
    
    // Prevent right-click context menu
    window.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      console.log('Context menu disabled');
    });
    
    // Prevent mouse button reload (usually button 3 or 4)
    window.addEventListener('mousedown', (event) => {
      if (event.button === 3 || event.button === 4) {
        event.preventDefault();
        console.log('Navigation prevented - use logout button to exit');
      }
    });
    
    // Prevent back/forward navigation
    window.addEventListener('popstate', (event) => {
      event.preventDefault();
      // Push state back to prevent navigation
      history.pushState(null, '', window.location.href);
      console.log('Back/forward navigation prevented - use logout button to exit');
    });
    
    // Set initial history state
    history.pushState(null, '', window.location.href);
    
    // Prevent beforeunload (browser close/refresh attempts)
    window.addEventListener('beforeunload', (event) => {
      // Show browser confirmation dialog
      event.preventDefault();
      event.returnValue = 'Are you sure you want to leave? App state will be lost.';
      return event.returnValue;
    });
    
    window.__preventDefaultReloadHandlerAttached = true;
  }
}