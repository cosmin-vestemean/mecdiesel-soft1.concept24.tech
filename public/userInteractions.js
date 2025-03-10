import { shared } from './shared.js';
import { renderTable } from './renderTable.js';
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
import { paginate, paginateErr, paginateConvAuto, paginateMappings, paginateStock } from './pagination.js';

// Create a loading indicator function
function showLoading(elementId, message = 'Loading...') {
  const loadingHtml = `
    <div class="d-flex align-items-center">
      <div class="spinner-border text-primary spinner-border-sm me-2" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
      <span>${message}</span>
    </div>
  `;
  $(elementId).html(loadingHtml);
}

export function initializeUserInteractions() {
  // First hide all content initially
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
    "searchErrors",
    "searchStockChanges",
    "stockChangesSelect",
    "stockChangesCheckbox",
    "stockChangesLabel",
    "stockChangesCheckboxVerbose",
    "stockChangesLabelVerbose",
  ];
  
  // Hide all elements at startup
  arrOfHtmlElements.forEach(elem => {
    $("#" + elem).hide();
  });
  
  //show #mainContent, hidden by default with d-none class
  $("#mainContent").removeClass("d-none");
  
  // Show loading indicator when rendering table
  showLoading("#items", "Loading table data...");
  renderTable(shared.table, "#items");

  $("#tables").change(() => {
    showLoading("#items", "Loading table data...");
    shared.table = $("#tables").val();
    shared.skip = 0;
    $("#searchItems").val("");
    renderTable(shared.table, "#items");
  });

  $("#firstItems").click(() => {
    showLoading("#items", "Loading first page...");
    shared.skip = 0;
    renderTable(shared.table, "#items", shared.skip);
  });

  $("#firstErrors").click(() => {
    showLoading("#errors", "Loading first page of messages...");
    shared.skipErr = 0;
    getS1Data("Loading messages, please wait...", "#errors", getErrors);
  });

  $("#firstConvAuto").click(() => {
    showLoading("#convAuto", "Loading first page of conversie automata...");
    shared.skipConvAuto = 0;
    getS1Data(
      "Loading mesagerie conversie automata, please wait...",
      "#convAuto",
      getMesagerieConvAuto
    );
  });

  $("#firstMappings").click(() => {
    showLoading("#mappings", "Loading first page of mappings...");
    shared.skipMappings = 0;
    getS1Data("Loading mappings, please wait...", "#mappings", getMappings);
  });

  $("#firstStockChanges").click(() => {
    showLoading("#stockChanges", "Loading first page of stock changes...");
    shared.skipStock = 0;
    getS1Data("Loading stock, please wait...", "#stockChanges", getSchimbareStoc);
  });

  $("#nextItems").click(() => {
    showLoading("#items", "Loading next page...");
    paginate(1);
  });

  $("#nextErrors").click(() => {
    showLoading("#errors", "Loading next page...");
    paginateErr(1);
  });

  $("#nextConvAuto").click(() => {
    showLoading("#convAuto", "Loading next page...");
    paginateConvAuto(1);
  });

  $("#nextMappings").click(() => {
    showLoading("#mappings", "Loading next page...");
    paginateMappings(1);
  });

  $("#nextStockChanges").click(() => {
    showLoading("#stockChanges", "Loading next page...");
    paginateStock(1);
  });

  $("#prevItems").click(() => {
    showLoading("#items", "Loading previous page...");
    paginate(-1);
  });

  $("#prevErrors").click(() => {
    showLoading("#errors", "Loading previous page...");
    paginateErr(-1);
  });

  $("#prevConvAuto").click(() => {
    showLoading("#convAuto", "Loading previous page...");
    paginateConvAuto(-1);
  });

  $("#prevMappings").click(() => {
    showLoading("#mappings", "Loading previous page...");
    paginateMappings(-1);
  });

  $("#prevStockChanges").click(() => {
    showLoading("#stockChanges", "Loading previous page...");
    paginateStock(-1);
  });

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

  // Keep existing click handlers, but add loading indicators
  $("#itemsButton").click(() => {
    hideAllButArray(["itemsContent", "searchItems", "tables", "tablesLabel"]);
    showLoading("#items", "Loading items...");
    renderTable(shared.table, "#items");
  });

  $("#mappingsButton").click(() => {
    hideAllButArray(["mappingsContent"]);
    showLoading("#mappings", "Loading mappings...");
    getS1Data("Loading mappings, please wait...", "#mappings", getMappings);
  });

  $("#errorsButton").click(() => {
    hideAllButArray(["errorsContent", "searchErrors"]);
    showLoading("#errors", "Loading messages...");
    getS1Data("Loading messages, please wait...", "#errors", getErrors);
    
    // Rest of the code remains the same
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
    showLoading("#convAuto", "Loading conversie automata...");
    getS1Data(
      "Loading mesagerie conversie automata, please wait...",
      "#convAuto",
      getMesagerieConvAuto
    );
  });

  $("#batchButton").click(() => {
    hideAllButArray(["batchApp", "batchSize", "batchTable", "batchStatus"]);
  });

  $("#stockChangesButton").click(() => {
    hideAllButArray([
      "stockChangesContent",
      "searchStockChanges",
      "stockChangesSelect",
      "stockChangesCheckbox",
      "stockChangesLabel",
      "stockChangesCheckboxVerbose",
      "stockChangesLabelVerbose",
    ]);
    
    showLoading("#stockChanges", "Loading stock changes...");
    getS1Data(
      "Loading stock changes, please wait...",
      "#stockChanges",
      getSchimbareStoc
    );
    
    // Rest of the code remains the same
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
  });

  $("#stockChangesCheckbox").change(() => {
    showLoading("#stockChanges", "Refreshing stock changes...");
    getS1Data(
      "Loading stock changes, please wait...", 
      "#stockChanges", 
      getSchimbareStoc
    );
  });

  $("#printConfigButton").click(() => {
    hideAllButArray(["print_config"]);
    $("#print_config").html('<div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div> Loading configuration...');
    connectToS1((token) => {
      getAllSoSourceObjectsRo(token, (sosourceOptions) => {
        addOptions(sosourceOptions, ".sosource", "sosource");
      });
    });
  });

  // Initialize with mappings tab active
  $("#mappingsButton").click();

  // Add loading indicators to reload buttons
  document.getElementById("errorsReload").onclick = () => {
    showLoading("#errors", "Reloading messages...");
    getS1Data("Loading messages, please wait...", "#errors", getErrors);
    document.getElementById("searchErrors").value = "";
  };

  document.getElementById("convAutoReload").onclick = () => {
    showLoading("#convAuto", "Reloading conversie automata...");
    getS1Data(
      "Loading mesagerie conversie automata, please wait...",
      "#convAuto",
      getMesagerieConvAuto
    );
  };

  document.getElementById("stockChangesReload").onclick = () => {
    showLoading("#stockChanges", "Reloading stock changes...");
    getS1Data(
      "Loading stock changes, please wait...",
      "#stockChanges",
      getSchimbareStoc
    );
  };

  document.getElementById("mappingsReload").onclick = () => {
    showLoading("#mappings", "Reloading mappings...");
    getS1Data("Loading mappings, please wait...", "#mappings", getMappings);
  };

  document.getElementById("itemsReload").onclick = () => {
    showLoading("#items", "Reloading items...");
    renderTable(shared.table, "#items");
  };

  // The batch processing logic with loading indicators
  document.getElementById("stopBatch").onclick = () => {
    $("#batchStatus").html("Stopped");
    isStopped = true;
    $("#process").prop("disabled", false);
    $("#upload").prop("disabled", false);
  };

  document.getElementById("upload").onchange = () => {
    $("#batchStatus").html('<div class="spinner-border spinner-border-sm text-primary me-2" role="status"></div> Loading codes...');
    var files = document.getElementById("upload").files;
    if (files.length <= 0) {
      $("#batchStatus").html("No file selected");
      console.log("No file selected");
      return false;
    } else if (
      files[0].type !==
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    ) {
      $("#batchStatus").html("Only xlsx files allowed");
      console.log("Only xlsx files allowed");
      return false;
    } else if (files[0].size > 1000000) {
      $("#batchStatus").html("File size must be less than 1MB");
      console.log("File size must be less than 1MB");
      return false;
    } else {
      $("#batchFileName").html(files[0].name);
      console.log("File name: " + files[0].name);
      $("#batchStatus").html("");
    }

    var fr = new FileReader();

    fr.onload = function (e) {
      var data = new Uint8Array(e.target.result);
      var workbook = XLSX.read(data, { type: "array" });
      workbook.SheetNames.forEach(function (sheetName) {
        var roa = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
        if (roa.length > 0) {
          codes = roa;
        }
      });

      renderData(codes, "#batchTable");
    };

    fr.readAsArrayBuffer(files.item(0));

    $("#batchStatus").html("");
  };

  document.getElementById("process").onclick = () => {
    var checked = false;

    $("#process").prop("disabled", true);
    $("#upload").prop("disabled", true);
    $("#batchRadio").prop("disabled", true);
    if (document.getElementById("moveItemsOnline").checked) {
      checked = true;
      $("#batchStatus").html('<div class="spinner-border spinner-border-sm text-primary me-2" role="status"></div> Processing list for sending to webshop...');
      batchProcessList(makeBatchRequest);
    } else if (document.getElementById("stockEvidence").checked) {
      checked = true;
      $("#batchStatus").html('<div class="spinner-border spinner-border-sm text-primary me-2" role="status"></div> Processing list for stock evidence...');
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

    $("#batchStatus").html('<div class="spinner-border spinner-border-sm text-primary me-2" role="status"></div> Batch process started');

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

  // Add loading indicators for searching
  document.getElementById("searchItems").oninput = () => {
    if ($("#searchItems").val().length > 4) {
      showLoading("#items", "Searching...");
      var query = {};
      switch (shared.table) {
        case "mec_item":
          query = {
            Item: $("#searchItems").val(),
          };
          break;
        case "mec_item_producer_relation":
          query = {
            Item: $("#searchItems").val(),
          };
          break;
        case "site_product_changes_history":
          query = {
            mec_code: $("#searchItems").val(),
          };
          break;
        case "site_product_frequent_changes":
          query = {
            mec_code: $("#searchItems").val(),
          };
          break;
        case "mec_item_altref":
          query = {
            Item: $("#searchItems").val(),
          };
          break;
        case "mec_ro_item_rel_supplier":
          query = {
            Item: $("#searchItems").val(),
          };
          break;
      }
      getItemsFromService(shared.table, "#items", query);
    }
    if ($("#searchItems").val().length == 0) {
      renderTable(shared.table, "#items");
    }
  };

  // Add loading indicators for pagination limit changes
  document.getElementById("items50").onclick = () => {
    shared.htmlLimit = 50;
    updateAllTables();
  };

  document.getElementById("items100").onclick = () => {
    shared.htmlLimit = 100;
    updateAllTables();
  };

  document.getElementById("items200").onclick = () => {
    shared.htmlLimit = 200;
    updateAllTables();
  };

  document.getElementById("items500").onclick = () => {
    shared.htmlLimit = 500;
    updateAllTables();
  };

  document.getElementById("items1000").onclick = () => {
    shared.htmlLimit = 1000;
    updateAllTables();
  };
  
  // Helper function to update all tables with loading indicators
  function updateAllTables() {
    showLoading("#items", "Updating tables...");
    renderTable(shared.table, "#items");
    
    showLoading("#mappings", "Updating mappings...");
    getS1Data("", "#mappings", getMappings);
    
    showLoading("#errors", "Updating messages...");
    getS1Data("", "#errors", getErrors);
    
    showLoading("#convAuto", "Updating conversie automata...");
    getS1Data("", "#convAuto", getMesagerieConvAuto);
    
    showLoading("#stockChanges", "Updating stock changes...");
    getS1Data("", "#stockChanges", getSchimbareStoc);
  }

  $(document).on("change", ".sosource", function () {
    var row = $(this).closest("tr");
    var sosource = $(this).val();
    var fprms = row.find(".fprms");
    
    fprms.html('<option>Loading...</option>');
    
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
    var row = $(this).closest("tr");
    var fprms = $(this).val();
    var sosource = row.find(".sosource");
    var seriesCell = row.find(".series");
    
    seriesCell.html('<option>Loading...</option>');
    
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
      
      var printTemplate = row.find(".printTemplates");
      printTemplate.html('<option>Loading...</option>');
      
      getAllPrintTemplatesForSoSource(token, sosource.val(), (templates) => {
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
    
    // Add a temporary "Loading..." option
    if (printTemplate.find('option:contains("Loading templates...")').length === 0) {
      printTemplate.append('<option>Loading templates...</option>');
    }
    
    connectToS1((token) => {
      getPrintTemplates(
        token,
        sosource.val(),
        fprms.val(),
        series,
        (templates) => {
          if (templates && templates.length == 1) {
            printTemplate.val(templates[0].templates);
          }
        }
      );
    });
  });
}