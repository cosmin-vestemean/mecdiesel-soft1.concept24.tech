var codes = [];
var htmlLimit = 100;
const socket = io();
const client = feathers();
const socketClient = feathers.socketio(socket);

client.configure(socketClient);

function getItemsFromService(dbtable, htmltable, q) {
  $("#messages").html("Loading items from CDB table " + dbtable + "...");
  client
    .service(dbtable)
    .find({
      query: q,
    })
    .then((res) => {
      renderData(res.data, htmltable);
      $("#messages").html("");
    });
}

//first load
var table = "mec_item";

renderTable(table, "#items");

//on select change set table variable to selected value
$("#tables").change(() => {
  table = $("#tables").val();
  skip = 0;
  $("#searchItems").val("");
  renderTable(table, "#items");
});

function renderTable(dbtable, htmltable, skip = 0) {
  var options = {};
  switch (dbtable) {
    case "mec_item":
      options = {
        $limit: htmlLimit,
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
        $limit: htmlLimit,
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
        $limit: htmlLimit,
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
        $limit: htmlLimit,
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
        $limit: htmlLimit,
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
        $limit: htmlLimit,
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

//pagination code: call find with skip and limit for buttons next and previous
var skip = 0,
  skipErr = 0,
  skipConvAuto = 0,
  skipMappings = 0,
  skipStock = 0;

//first button
$("#firstItems").click(() => {
  skip = 0;
  renderTable(table, "#items", skip);
});

$("#firstErrors").click(() => {
  skipErr = 0;
  getS1Data("Loading messages, please wait...", "#errors", getErrors);
});

//conv auto
$("#firstConvAuto").click(() => {
  skipConvAuto = 0;
  getS1Data(
    "Loading mesagerie conversie automata, please wait...",
    "#convAuto",
    getMesagerieConvAuto
  );
});

$("#firstMappings").click(() => {
  skipMappings = 0;
  getS1Data("Loading mappings, please wait...", "#mappings", getMappings);
});

$("#firstStockChanges").click(() => {
  skipStock = 0;
  getS1Data("Loading stock, please wait...", "#stockChanges", getSchimbareStoc);
});

//next button
$("#nextItems").click(() => {
  paginate(1);
});

$("#nextErrors").click(() => {
  paginateErr(1);
});

$("#nextConvAuto").click(() => {
  paginateConvAuto(1);
});

$("#nextMappings").click(() => {
  paginateMappings(1);
});

$("#nextStockChanges").click(() => {
  paginateStock(1);
});

//previous button
$("#prevItems").click(() => {
  paginate(-1);
});

$("#prevErrors").click(() => {
  paginateErr(-1);
});

$("#prevConvAuto").click(() => {
  paginateConvAuto(-1);
});

$("#prevMappings").click(() => {
  paginateMappings(-1);
});

$("#prevStockChanges").click(() => {
  paginateStock(-1);
});

//function to paginate
function paginate(direction) {
  skip += direction * htmlLimit;
  if (skip < 0) {
    skip = 0;
  }
  renderTable(table, "#items", skip);
}

function paginateErr(direction) {
  skipErr += direction * htmlLimit;
  if (skipErr < 0) {
    skipErr = 0;
  }
  getS1Data("Loading messages, please wait...", "#errors", getErrors);
}

function paginateConvAuto(direction) {
  skipConvAuto += direction * htmlLimit;
  if (skipConvAuto < 0) {
    skipConvAuto = 0;
  }
  getS1Data(
    "Loading mesagerie conversie automata, please wait...",
    "#convAuto",
    getMesagerieConvAuto
  );
}

function paginateMappings(direction) {
  skipMappings += direction * htmlLimit;
  if (skipMappings < 0) {
    skipMappings = 0;
  }
  getS1Data("Loading mappings, please wait...", "#mappings", getMappings);
}

function paginateStock(direction) {
  skipStock += direction * htmlLimit;
  if (skipStock < 0) {
    skipStock = 0;
  }
  getS1Data("Loading stock, please wait...", "#stockChanges", getSchimbareStoc);
}

//render items
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
      skipNr = skip;
      break;
    case "#errors":
      skipNr = skipErr;
      break;
    case "#convAuto":
      skipNr = skipConvAuto;
      break;
    case "#mappings":
      skipNr = skipMappings;
      break;
    case "#stockChanges":
      skipNr = skipStock;
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

//register s1 service and methods
client.use("s1", socketClient.service("s1"), {
  methods: [
    "ping",
    "login",
    "authenticate",
    "getMappings",
    "getErrors",
    "getMesagerieConvAuto",
    "makeBatchRequest",
    "getSchimbareStoc",
    "getAllSoSourceObjectsRo",
    "getAllFprmsForSoSource",
    "getAllSeriesForFprms",
    "getPrintTemplates",
    "getAllPrintTemplatesForSoSource",
    "processListOfStocks",
    "getSqlDataset",
  ],
});

function connectToS1(next) {
  new Promise((resolve, reject) => {
    client
      .service("s1")
      .ping()
      .then((res) => {
        //console.log("ping response", res);
      });

    client
      .service("s1")
      .login()
      .then((res) => {
        //if res.success is false, show error message
        if (!res.success) {
          alert(res.message);
          return;
        }

        const token = res.clientID;
        const objs = res.objs;
        let branches = [];
        objs.forEach((obj) => {
          branches.push(obj.BRANCH);
        });

        //find BRANCH, MODULE, REFID, USERID value for branchname "HQ"
        const loginData = objs.filter((obj) => {
          return obj.BRANCHNAME === "HQ";
        })[0];

        const appId = res.appid;

        //call authenticate service
        client
          .service("s1")
          .authenticate({
            service: "authenticate",
            clientID: token,
            company: loginData.COMPANY,
            branch: loginData.BRANCH,
            module: loginData.MODULE,
            refid: loginData.REFID,
            userid: loginData.USERID,
            appId: appId,
          })
          .then((res) => {
            //log next function name
            //console.log("next function: " + next.name);
            resolve(next(res.clientID));
          });
      });
  });
}

//get mappings
function getMappings(token, next) {
  client
    .service("s1")
    .getMappings({
      token: token,
      skip_rows: skipMappings,
      fetch_next_rows: htmlLimit,
    })
    .then((res) => {
      next(res.rows);
    });
}

//get errors
function getErrors(token, next) {
  client
    .service("s1")
    .getErrors({
      token: token,
      skip_rows: skipErr,
      fetch_next_rows: htmlLimit,
    })
    .then((res) => {
      //console.log(res);
      next(res.rows);
    });
}

function getMesagerieConvAuto(token, next) {
  client
    .service("s1")
    .getMesagerieConvAuto({
      token: token,
      skip_rows: skipConvAuto,
      fetch_next_rows: htmlLimit,
    })
    .then((res) => {
      //console.log(res);
      next(res.rows);
    });
}

//get schimbare stoc
function getSchimbareStoc(token, next, mec_code = null) {
  const options = {
    token: token,
    skip_rows: skipStock,
    fetch_next_rows: htmlLimit,
  };
  //if elem with id stockChangesCheckbox is checked, add stoc:0 to options
  if ($("#stockChangesCheckbox").is(":checked")) {
    options.stoc = 0;
  } else {
    options.stoc = null;
  }

  //if elem with id stockChangesCheckboxVerbose is checked, add verbose:1 to options
  if ($("#stockChangesCheckboxVerbose").is(":checked")) {
    options.is_signaled = 1;
  } else {
    options.is_signaled = null;
  }

  //if searchStockChanges input has value, add mec_code to options
  if (mec_code) {
    options.mec_code = mec_code;
  } else {
    options.mec_code = null;
  }

  console.log("getSchimbareStoc options", options);

  client
    .service("s1")
    .getSchimbareStoc(options)
    .then((res) => {
      next(res.rows);
    });
}

//get all so source objects ro
function getAllSoSourceObjectsRo(token, next) {
  client
    .service("s1")
    .getAllSoSourceObjectsRo({
      token: token,
    })
    .then((res) => {
      next(res.rows);
    });
}

//get all fprms for so source
function getAllFprmsForSoSource(token, sosource, next) {
  client
    .service("s1")
    .getAllFprmsForSoSource({
      token: token,
      sosource: sosource,
    })
    .then((res) => {
      next(res.rows);
    });
}

//get all series for fprms
function getAllSeriesForFprms(token, sosource, fprms, next) {
  client
    .service("s1")
    .getAllSeriesForFprms({
      token: token,
      sosource: sosource,
      fprms: fprms,
    })
    .then((res) => {
      next(res.rows);
    });
}

//get print templates
function getPrintTemplates(token, sosource, fprms, series, next) {
  client
    .service("s1")
    .getPrintTemplates({
      token: token,
      sosource: sosource,
      fprms: fprms,
      series: series,
    })
    .then((res) => {
      next(res.rows);
    });
}

function getAllPrintTemplatesForSoSource(token, sosource, next) {
  client
    .service("s1")
    .getAllPrintTemplatesForSoSource({
      token: token,
      sosource: sosource,
    })
    .then((res) => {
      next(res.rows);
    });
}

//call connectToS1 function
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
  //add options to select element (connectToS1 => getAllSoSourceObjectsRo => sosourceOptions)
  getAllSoSourceObjectsRo(token, (sosourceOptions) => {
    addOptions(sosourceOptions, ".sosource", "sosource");
  });
});

function addOptions(data, elemId, dataKey) {
  if (!data) {
    console.log(dataKey, "no data");
    return;
  } else {
    //console.log(dataKey, data);
  }
  var options = "";
  data.forEach((item) => {
    options += `<option value="${item[dataKey]}">${item.name}</option>`;
  });
  $(elemId).html(options);
}

//on click of button "itemsButton" show div "itemsContent" and hide div "mappingsContent"
$("#itemsButton").click(() => {
  hideAllButArray(["itemsContent", "searchItems", "tables", "tablesLabel"]);
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
  "searchErrors",
  "searchStockChanges",
  "stockChangesSelect",
  "stockChangesCheckbox",
  "stockChangesLabel",
  "stockChangesCheckboxVerbose",
  "stockChangesLabelVerbose",
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

//same for button "mappingsButton"
$("#mappingsButton").click(() => {
  hideAllButArray(["mappingsContent"]);
});

//error button
$("#errorsButton").click(() => {
  hideAllButArray(["errorsContent", "searchErrors"]);
  //create search box under errorsButton, same width as errorsButton
  //create input element
  if (!document.getElementById("searchErrors")) {
    var input = document.createElement("input");
    input.setAttribute("type", "text");
    input.setAttribute("id", "searchErrors");
    input.setAttribute("class", "form-control");
    input.setAttribute("placeholder", "Cautare cod...");
    input.style.width = "100%";
    //no spellcheck
    input.setAttribute("spellcheck", "false");
    //append input to errorsButton if not already appended
    if (!document.getElementById("searchErrors")) {
      document.getElementById("errorsButton").appendChild(input);
      //on input change, after 5 letters, search errors like message with getErrors
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
});

//batch app button
$("#batchButton").click(() => {
  hideAllButArray(["batchApp", "batchSize", "batchTable", "batchStatus"]);
});

//stock changes button
$("#stockChangesButton").click(() => {
  //add search box under stockChangesButton, same width as stockChanges
  //create input element
  if (!document.getElementById("searchStockChanges")) {
    var input = document.createElement("input");
    input.setAttribute("type", "text");
    input.setAttribute("id", "searchStockChanges");
    input.setAttribute("class", "form-control");
    input.setAttribute("placeholder", "Cautare cod...");
    input.style.width = "100%";
    //no spellcheck
    input.setAttribute("spellcheck", "false");
    //append input to stockChangesButton if not already appended
    if (!document.getElementById("searchStockChanges")) {
      document.getElementById("stockChangesButton").appendChild(input);
      //on input change, after 5 letters, search stock changes like mec_code with getSchimbareStoc
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
});

// Add checkbox change handler
$("#stockChangesCheckbox").change(() => {
  getS1Data(
    "Loading stock changes, please wait...", 
    "#stockChanges", 
    getSchimbareStoc
  );
});

// Add right after the stockChangesCheckbox change handler
$("#showLightLines").change(() => {
  const isChecked = $("#showLightLines").is(":checked");
  if (isChecked) {
    $("#stockChanges .table-light").show();
  } else {
    $("#stockChanges .table-light").hide();
  }
});

//print config button
$("#printConfigButton").click(() => {
  hideAllButArray(["print_config"]);
  connectToS1((token) => {
    getAllSoSourceObjectsRo(token, (sosourceOptions) => {
      addOptions(sosourceOptions, ".sosource", "sosource");
    });
  });
});

//simultate click on "mappingsButton"
$("#mappingsButton").click();

document.getElementById("errorsReload").onclick = () => {
  getS1Data("Loading messages, please wait...", "#errors", getErrors);
  document.getElementById("searchErrors").value = "";
};

document.getElementById("convAutoReload").onclick = () => {
  getS1Data(
    "Loading mesagerie conversie automata, please wait...",
    "#convAuto",
    getMesagerieConvAuto
  );
};

document.getElementById("convAutoReload").onclick = () => {
  getS1Data(
    "Loading mesagerie conversie auto, please wait...",
    "#convAuto",
    getMesagerieConvAuto
  );
};

function getS1Data(message, htmlElementId, next) {
  $("#messages").html(message);
  connectToS1((token) => {
    next(token, (data) => {
      $(htmlElementId).html("");
      renderData(data, htmlElementId);
      $("#messages").html("");
    });
  });
}

//stock changes reload button
document.getElementById("stockChangesReload").onclick = () => {
  getS1Data(
    "Loading stock changes, please wait...",
    "#stockChanges",
    getSchimbareStoc
  );
};

document.getElementById("mappingsReload").onclick = () => {
  getS1Data("Loading mappings, please wait...", "#mappings", getMappings);
};

document.getElementById("itemsReload").onclick = () => {
  renderTable(table, "#items");
};

var isStopped = false;
//pause button
document.getElementById("stopBatch").onclick = () => {
  $("#batchStatus").html("Stopped");
  isStopped = true;
  $("#process").prop("disabled", false);
  $("upload").prop("disabled", false);
};

//upload id is input type file. load local excel file by xlsx.js method into array of objects; excel file has only one column and it represents codes (text)
document.getElementById("upload").onchange = () => {
  $("#batchStatus").html("Loading codes...");
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
    //write file name
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

    //write codes
    renderData(codes, "#batchTable");
  };

  fr.readAsArrayBuffer(files.item(0));

  $("#batchStatus").html("");
};

//process button
document.getElementById("process").onclick = () => {
  //verify if one of the radio buttons is checked (moveItemsOnline, stockEvidence); they are contained in btnGroup id batchRadio
  var checked = false;

  //disable process button, upload button
  $("#process").prop("disabled", true);
  $("#upload").prop("disabled", true);
  $("#batchRadio").prop("disabled", true);
  //case id of checked radio button
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

//batch process list
function batchProcessList(next) {
  //make batches of #batcheSize codes[i][Object.keys(codes[i])[0]
  //and send them one by one to function connectToS1(makeBatchRequest)) and wait! for response
  //then call batchProcessList() again with next batch
  //when all batches are processed, show message "Batch process finished"
  //if error, show message "Batch process failed"

  //batch size
  var batchSize = $("#batchSize").val();
  //batch size must be between 1 and 1000
  if (batchSize < 1 || batchSize > 100) {
    $("#batchStatus").html("Batch size must be between 1 and 100");
    return;
  }

  //start batch process
  $("#batchStatus").html("Batch process started");

  //make batches
  var batch = [];
  for (var i = 0; i < codes.length; i++) {
    batch.push(codes[i][Object.keys(codes[i])[0]]);
    if (batch.length == batchSize) {
      break;
    }
  }

  //make batch request
  try {
    //log next function
    console.log("next", next.name);
    connectToS1((token) => {
      next(token, batch).then((res) => {
        console.log("res", res);
        if (codes.length > 0) {
          //remove batch from codes
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
          //change val of upload to empty
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
    //change val of upload to empty
    $("#upload").val("");
  }
}

//make batch request
async function makeBatchRequest(token, batch) {
  //console.log("makeBatchRequest batch", batch);
  await client
    .service("s1")
    .makeBatchRequest({
      token: token,
      codes: batch,
    })
    .then((res) => {
      console.log("batch response", res);
      //append response
      $("#batchMessages").append(res.message + " in " + res.duration + "<br>");
      return res;
    })
    .catch((err) => {
      console.log("batch error", err);
      return err;
    });
}

//process list of stocks
async function processListOfStocks(token, batch) {
  //console.log("processListOfStocks batch", batch);
  await client
    .service("s1")
    .processListOfStocks({
      token: token,
      codes: batch,
    })
    .then((res) => {
      console.log("processListOfStocks API response", res);
      //append response
      $("#batchMessages").append(res.message);
      return res;
    })
    .catch((err) => {
      console.log("batch error", err);
      return err;
    });
}
//on searchItems input change, after 5 letters, search items like mec_code with getItemsFromService
document.getElementById("searchItems").oninput = () => {
  if ($("#searchItems").val().length > 4) {
    var query = {};
    switch (table) {
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
      //mec_ro_item_rel_supplier
      case "mec_ro_item_rel_supplier":
        query = {
          Item: $("#searchItems").val(),
        };
        break;
    }
    getItemsFromService(table, "#items", query);
  }
  if ($("#searchItems").val().length == 0) {
    renderTable(table, "#items");
  }
};

//click on items50 button => htmlLimit = 50
document.getElementById("items50").onclick = () => {
  htmlLimit = 50;
  renderTable(table, "#items");
  getS1Data("", "#mappings", getMappings);
  getS1Data("", "#errors", getErrors);
  getS1Data("", "#convAuto", getMesagerieConvAuto);
  getS1Data("", "#stockChanges", getSchimbareStoc);
};

//click on items100 button => htmlLimit = 50
document.getElementById("items50").onclick = () => {
  htmlLimit = 50;
  renderTable(table, "#items");
  getS1Data("", "#mappings", getMappings);
  getS1Data("", "#errors", getErrors);
  getS1Data("", "#convAuto", getMesagerieConvAuto);
  getS1Data("", "#stockChanges", getSchimbareStoc);
};

document.getElementById("items100").onclick = () => {
  htmlLimit = 100;
  renderTable(table, "#items");
  getS1Data("", "#mappings", getMappings);
  getS1Data("", "#errors", getErrors);
  getS1Data("", "#convAuto", getMesagerieConvAuto);
  getS1Data("", "#stockChanges", getSchimbareStoc);
};

document.getElementById("items200").onclick = () => {
  htmlLimit = 200;
  renderTable(table, "#items");
  getS1Data("", "#mappings", getMappings);
  getS1Data("", "#errors", getErrors);
  getS1Data("", "#convAuto", getMesagerieConvAuto);
  getS1Data("", "#stockChanges", getSchimbareStoc);
};

document.getElementById("items500").onclick = () => {
  htmlLimit = 500;
  renderTable(table, "#items");
  getS1Data("", "#mappings", getMappings);
  getS1Data("", "#errors", getErrors);
  getS1Data("", "#convAuto", getMesagerieConvAuto);
  getS1Data("", "#stockChanges", getSchimbareStoc);
};

document.getElementById("items1000").onclick = () => {
  htmlLimit = 1000;
  renderTable(table, "#items");
  getS1Data("", "#mappings", getMappings);
  getS1Data("", "#errors", getErrors);
  getS1Data("", "#convAuto", getMesagerieConvAuto);
  getS1Data("", "#stockChanges", getSchimbareStoc);
};

//print config section
//1. we have table #printConfig with rows
//2. Each row has 4 columns: sosource, fprms, series, printTemplate
//3. for each row, when sosource is changed, we get all fprms for sosource in that row
//4. for each row, when fprms is changed, we get all series for fprms in that row
//5. for each row, when series is changed, we get all printTemplates for series in that row

//find sosource element in row, then fprms in same row, then series in same row, then printTemplate in same row
//then get all fprms for sosource

//when sosource is changed, get all fprms for sosource
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

//same for fprms
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

//same for series
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
        //if one template then assign it to printTemplate
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

//stockChangesSelect getSchimbareStoc with like option selected
