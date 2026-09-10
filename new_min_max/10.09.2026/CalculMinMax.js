/* global X */

/*
TODO: 
1. serii exceptate (seriesL)
2. reinitializare valori min max cu code starts with TODO: DONE
3. Dupa testarea noului mecanism, se vor sterge functiile vechi ufn_vanzariWks, ufn_vanzariPerBranch, ufn_vanzariPerCompany si jobul vechi din menu
*/

const isInDubugMode = false;

function insertCalculatedMinMax(params) {
  var vSucursale = params.vSucursale;
  var vFurnizor = params.vFurnizor;
  var vArticol = params.vArticol;
  var vItemCode = params.vItemCode;
  var vWWSAL = params.vWWSAL;
  var vPSAL = params.vPSAL;
  var vSSF = params.vSSF;
  var vLT = params.vLT;
  var vRP = params.vRP;
  var vSL = params.vSL;
  var vOF = params.vOF;
  var vPerioada = params.vPerioada;
  var vData = params.vData;
  var vSeriiExceptateVanzare = ""; // TODO: Add serii exceptate
  var isVerbose = params.isVerbose || false;
  var isAPI = params.isAPI || false; // Flag to indicate if called as API

  //validare parametrii
  if (!vSucursale) {
    return "Nu a fost selectata sucursala.";
  }

  var messages = "";
  var operationTimings = {}; // Object to store timing information

  //add params to messages
  messages += JSON.stringify(params, null, 2) + "\n";

  // Helper function to update UI in real-time if not in API mode
  function updateUIMessage(message) {
    messages += message;

    // Update UI in real-time if not in API mode and CCCCALCULMINMAXVT exists
    if (!isAPI) {
      try {
        CCCCALCULMINMAXVT.MESSAGES = messages;
        X.PROCESSMESSAGES(); // Force UI update
      } catch (e) {
        // Silently fail if UI update fails
      }
    }

    return message;
  }

  // Helper function to time operations
  function timeOperation(operationName, callback) {
    var startTime = new Date().getTime();

    if (1 === 1) {
      updateUIMessage("Starting operation: " + operationName + "\n");
    }

    var result = callback();

    if (1 === 1) {
      var endTime = new Date().getTime();
      var elapsedSeconds = ((endTime - startTime) / 1000).toFixed(2);
      operationTimings[operationName] = parseFloat(elapsedSeconds);
      updateUIMessage(
        "Completed operation: " +
          operationName +
          " in " +
          elapsedSeconds +
          " seconds\n"
      );
    }

    return result;
  }

  var cteDefinition = buildCteDefinition();

  function buildCteDefinition() {
    var cte = [];
    cte.push(
      "WITH rg (wk) AS (SELECT 1 AS wk UNION ALL SELECT a.wk + 1 AS wk FROM rg a WHERE a.wk < " +
        vPerioada +
        ")"
    );
    cte.push(
      "v AS (SELECT * FROM dbo.ufn_vanzariWksOptimized('" +
        vData +
        "', " +
        vPerioada +
        ", '" +
        vSeriiExceptateVanzare +
        "', '" +
        vSucursale +
        "', " +
        vFurnizor +
        ", " +
        vArticol +
        ", '" +
        vItemCode +
        "'))"
    );

    return cte.join(", ");
  }

  var fromDefinition = buildFromDefinition();

  function buildFromDefinition() {
    // Table t1: Base query with cross joins
    function buildT1Query() {
      return (
        "SELECT rg.wk " +
        ",v1.mtrl " +
        ",v.mtrsup " +
        ",v3.branch " +
        ",v1.CODARTICOL " +
        ",v1.DENUMARTICOL " +
        ",COALESCE(v.pcswk, 0) pcswk " +
        ",COALESCE(v.wkflag, 0) wkflag " +
        "FROM rg " +
        "CROSS JOIN ( " +
        "  SELECT DISTINCT mtrl " +
        "    ,CODARTICOL " +
        "    ,DENUMARTICOL " +
        "  FROM v " +
        "  ) v1 " +
        "CROSS JOIN ( " +
        "  SELECT DISTINCT branch " +
        "  FROM v " +
        "  ) v3 " +
        "LEFT JOIN v ON ( " +
        "    rg.wk = v.wk " +
        "    AND v1.mtrl = v.mtrl " +
        "    AND v3.branch = v.branch " +
        "    )"
      );
    }

    // Table t2: First level joining
    function buildT2Query() {
      return (
        "SELECT t1.mtrl " +
        ",t1.wk " +
        ",( " +
        "  SELECT mtrsup " +
        "  FROM mtrl " +
        "  WHERE mtrl = t1.mtrl " +
        "  ) mtrsup " +
        ",t1.branch " +
        ",t1.pcswk " +
        ",t1.wkflag " +
        ",t1.CODARTICOL " +
        ",t1.DENUMARTICOL " +
        "FROM (" +
        buildT1Query() +
        ") t1"
      );
    }

    // Table t3: Aggregation with statistics
    function buildT3Query() {
      return (
        "SELECT mtrsup " +
        ",mtrl " +
        ",CODARTICOL " +
        ",DENUMARTICOL " +
        ",branch " +
        ",COALESCE(sum(COALESCE(wkflag, 0)), 0) wksofsales " +
        ",COALESCE(sum(COALESCE(pcswk, 0)), 0) pcswhprd " +
        ",avg(cast(COALESCE(pcswk, 0) AS DECIMAL(18, 8))) avgpcs " +
        ",stdev(COALESCE(pcswk, 0)) stddev " +
        "FROM (" +
        buildT2Query() +
        ") t2 " +
        "GROUP BY mtrl " +
        "  ,CODARTICOL " +
        "  ,DENUMARTICOL " +
        "  ,mtrsup " +
        "  ,branch"
      );
    }

    // Table t4: Safety stock and cycle stock calculations
    function buildT4Query() {
      return (
        "SELECT mtrsup " +
        ",mtrl " +
        ",CODARTICOL " +
        ",DENUMARTICOL " +
        ",branch " +
        ",wksofsales " +
        ",pcswhprd " +
        ",avgpcs " +
        ",stddev " +
        ",CASE " +
        "  WHEN wksofsales < " +
        vWWSAL +
        "    THEN 0 " +
        "  ELSE COALESCE(stddev, 0) * " +
        vSSF +
        " * sqrt(" +
        vLT +
        " / 7.00000000) " +
        "  END safetystock " +
        ",CASE " +
        "  WHEN wksofsales < " +
        vWWSAL +
        "    THEN 0 " +
        "  ELSE COALESCE(avgpcs, 0) * (" +
        vLT +
        " / 7.00000000) " +
        "  END LTstock " +
        ",CASE " +
        "  WHEN wksofsales < " +
        vWWSAL +
        "    THEN 0 " +
        "  ELSE COALESCE(avgpcs, 0) * (" +
        vRP +
        " / 7.00000000) " +
        "  END cyclestock " +
        "FROM (" +
        buildT3Query() +
        ") t3 " +
        "WHERE pcswhprd >= " +
        vPSAL +
        "  AND wksofsales >= " +
        vWWSAL
      );
    }

    // Table t5: Main query with safety calculations
    function buildT5Query() {
      return (
        "SELECT mtrsup " +
        ",mtrl " +
        ",CODARTICOL " +
        ",DENUMARTICOL " +
        ",branch " +
        ",wksofsales " +
        ",pcswhprd " +
        ",avgpcs " +
        ",stddev " +
        ",safetystock " +
        ",cyclestock " +
        ",LTstock " +
        ",CASE " +
        "  WHEN wksofsales < " +
        vWWSAL +
        "    THEN 0 " +
        "  ELSE COALESCE(LTstock, 0) * (100.00000000 / " +
        vSL +
        " - 1) " +
        "  END SLTS " +
        "FROM (" +
        buildT4Query() +
        ") t4"
      );
    }

    return "FROM (" + buildT5Query() + ") t5 ";
  }

  var sucursaleTempTableQuery = buildSucursaleTempTableQuery();

  function buildSucursaleTempTableQuery() {
    return (
      cteDefinition +
      " SELECT mtrl " +
      ", CODARTICOL " +
      ",:X.SYS.COMPANY company " +
      ",( SELECT ISNULL(MAX(ISNULL(LINENUM, 0)), 0) + 1 FROM MTRBRNLIMITS WHERE mtrl = t5.mtrl AND branch = t5.branch AND whouse = t5.branch ) LINENUM " +
      ",(select REMAINLIMMIN from MTRBRNLIMITS where branch=t5.branch and whouse=t5.branch and mtrl=t5.mtrl) REMAINLIMMIN " +
      ",(select REMAINLIMMAX from MTRBRNLIMITS where branch=t5.branch and whouse=t5.branch and mtrl=t5.mtrl) REMAINLIMMAX " +
      ",branch " +
      ",t5.branch whouse " +
      ",CEILING((safetystock + SLTS + LTstock) * ((100 + " +
      vOF +
      ") / 100.00000000)) CCCMINAUTO " +
      ",CEILING((safetystock + SLTS + LTstock + cyclestock) * ((100 + " +
      vOF +
      ") / 100.00000000)) CCCMAXAUTO " +
      ",GETDATE() CCCDATACALCMINMAX " +
      "INTO #myMTRBRNLIMITS " +
      fromDefinition +
      "ORDER BY CODARTICOL " +
      ",branch"
    );
  }

  var sucursaleMergeQuery =
    "MERGE MTRBRNLIMITS AS target " +
    "USING #myMTRBRNLIMITS AS source " +
    "ON (target.company = source.company " +
    "    AND target.mtrl = source.mtrl " +
    "    AND target.branch = source.branch " +
    "    AND target.whouse = source.whouse) " +
    "WHEN MATCHED THEN " +
    "    UPDATE SET " +
    "    target.CCCMINAUTO = source.CCCMINAUTO, " +
    "    target.CCCMAXAUTO = source.CCCMAXAUTO, " +
    "    target.CCCDATACALCMINMAX = source.CCCDATACALCMINMAX " +
    "WHEN NOT MATCHED BY TARGET THEN " +
    "    INSERT (mtrl, company, linenum, branch, whouse, CCCMINAUTO, CCCMAXAUTO, REMAINLIMMIN, REMAINLIMMAX, CCCDATACALCMINMAX) " +
    "    VALUES (source.mtrl, source.company, source.linenum, source.branch, source.whouse, " +
    "            source.CCCMINAUTO, source.CCCMAXAUTO, source.REMAINLIMMIN, source.REMAINLIMMAX, source.CCCDATACALCMINMAX);";

  var sucursaleCleanupQuery =
    "IF OBJECT_ID(N'tempdb..#myMTRBRNLIMITS') IS NOT NULL BEGIN DROP TABLE #myMTRBRNLIMITS END";

  // Split into two separate queries
  var zeroAllMinMaxSucursaleQuery = isVerbose
    ? "UPDATE MTRBRNLIMITS " +
      "SET CCCMINAUTO = 0, CCCMAXAUTO = 0, CCCDATACALCMINMAX = GETDATE() " +
      "OUTPUT inserted.mtrl, inserted.branch, inserted.whouse, " +
      "deleted.CCCMINAUTO AS OldMinAuto, inserted.CCCMINAUTO AS NewMinAuto, " +
      "deleted.CCCMAXAUTO AS OldMaxAuto, inserted.CCCMAXAUTO AS NewMaxAuto " +
      "WHERE company = 1000 AND branch IN (" +
      vSucursale +
      ")"
    : "UPDATE MTRBRNLIMITS " +
      "SET CCCMINAUTO = 0, CCCMAXAUTO = 0, CCCDATACALCMINMAX = GETDATE() " +
      "WHERE company = 1000 AND branch IN (" +
      vSucursale +
      ")";

  // Add the conditions from your existing code
  if (vItemCode) {
    zeroAllMinMaxSucursaleQuery +=
      " AND mtrl IN (SELECT mtrl FROM MTRL WHERE code LIKE '" +
      vItemCode +
      "')";
  }

  if (vArticol !== 2606178) {
    zeroAllMinMaxSucursaleQuery += " AND mtrl = " + vArticol;
  }

  var codArticolListQuery = "SELECT DISTINCT CODARTICOL FROM #myMTRBRNLIMITS";

  function retriveCodArticolList() {
    var message = "";
    try {
      var datasetCA = X.GETSQLDATASET(codArticolListQuery, null);
      if (datasetCA.RECORDCOUNT > 0) {
        message +=
          "Au fost gasite " +
          datasetCA.RECORDCOUNT +
          " articole pentru care se actualizeaza valorile min max." +
          "\n";
        datasetCA.FIRST;
        while (!datasetCA.Eof) {
          message += datasetCA.CODARTICOL + "\n";
          datasetCA.NEXT;
        }
      } else {
        message +=
          "Nu au fost gasite articole pentru care sa se actualizeze valorile min max." +
          "\n";
      }
    } catch (e) {
      if (isInDubugMode) {
        message += "Lista articole: Nimic de afisat in debug mode.\n";
      } else {
        message +=
          "Eroare la extragerea listei de articole: " + e.message + "\n";
      }
    } finally {
      return message;
    }
  }

  /*
    var zeroAllMinMaxHQQuery = 'UPDATE MTRL SET CCCMINAUTO = 0, CCCMAXAUTO = 0, CCCDATACALCMINMAX = GETDATE() where company = :X.SYS.COMPANY';
    if (vItemCode) {
        zeroAllMinMaxHQQuery += " and mtrl in (select mtrl from MTRL where code like '" + vItemCode + "')";
    }

    if (vArticol !== 2606178) {
        zeroAllMinMaxHQQuery += " and mtrl = " + vArticol;
    }
    */

  var hqQuery =
    "BEGIN TRANSACTION; BEGIN TRY " +
    cteDefinition +
    " UPDATE m " +
    "SET m.CCCMINAUTOCOMP = CEILING((t5.safetystock + t5.SLTS + t5.LTstock) * ((100 + " +
    vOF +
    ") / 100.00000000)) " +
    ",m.CCCMAXAUTOCOMP = CEILING((t5.safetystock + t5.SLTS + t5.LTstock + t5.cyclestock) * ((100 + " +
    vOF +
    ") / 100.00000000)) " +
    ",m.CCCDATACALCMINMAX = GETDATE() " +
    fromDefinition +
    "INNER JOIN mtrl m ON (m.mtrl = t5.mtrl); " +
    "COMMIT TRANSACTION; " +
    "END TRY " +
    "BEGIN CATCH " +
    "IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION; " +
    "THROW; " +
    "END CATCH;";

  // Function to execute SQL safely with appropriate method based on what's needed
  function executeSql(sqlQuery, needsDataset) {
    if (isInDubugMode) {
      updateUIMessage(sqlQuery + "\n");
      return null;
    } else {
      var startTime = isVerbose ? new Date().getTime() : 0;
      var result;

      if (needsDataset) {
        result = X.GETSQLDATASET(sqlQuery, null);
      } else {
        result = X.RUNSQL(sqlQuery, null);
      }

      if (isVerbose) {
        var endTime = new Date().getTime();
        var elapsedSeconds = ((endTime - startTime) / 1000).toFixed(2);
        updateUIMessage(
          "SQL execution completed in " + elapsedSeconds + " seconds\n"
        );
      }

      return result;
    }
  }

  function startProcessing() {
    var processingStartTime = new Date().getTime();

    // Process based on branch selection
    if (vSucursale != 1000) {
      // Process for branches (similar to the SBSL branch-specific logic)
      updateUIMessage("Se proceseaza pentru sucursale." + "\n");

      // Step 1: Zero all min max values for selected branches and get results
      var zeroingResult = timeOperation("Zeroing min-max values", function () {
        // Always use GETSQLDATASET when we have OUTPUT clause
        if (isVerbose) {
          return executeSql(zeroAllMinMaxSucursaleQuery, true); // Get dataset with changed records
        } else {
          // Non-verbose version doesn't use OUTPUT, so use RUNSQL
          return executeSql(zeroAllMinMaxSucursaleQuery, false);
        }
      });

      // Only process dataset results if we used the verbose query with OUTPUT
      if (isVerbose && zeroingResult && zeroingResult.RECORDCOUNT > 0) {
        if (zeroingResult.RECORDCOUNT < 100) {
          updateUIMessage("Records zeroed summary:\n");

          zeroingResult.FIRST;
          while (!zeroingResult.Eof) {
            updateUIMessage(
              "MTRL: " +
                zeroingResult.mtrl +
                ", Branch: " +
                zeroingResult.branch +
                ", OldMinAuto: " +
                zeroingResult.OldMinAuto +
                ", NewMinAuto: " +
                zeroingResult.NewMinAuto +
                ", OldMaxAuto: " +
                zeroingResult.OldMaxAuto +
                ", NewMaxAuto: " +
                zeroingResult.NewMaxAuto +
                "\n"
            );
            zeroingResult.NEXT;
          }
        } else {
          updateUIMessage(
            "Zeroed " +
              zeroingResult.RECORDCOUNT +
              " records (too many to display individually).\n"
          );
        }
      } else if (isVerbose) {
        updateUIMessage("No records found for zeroing.\n");
      }

      // Step 2: Create temporary table
      timeOperation(
        "Creating temporary table with newly calculated values",
        function () {
          return executeSql(sucursaleTempTableQuery, false);
        }
      );

      // Step 3: Get list of CODARTICOL from temp table - show regardless of verbose mode
      var articolList = timeOperation("Retrieving article list", function () {
        return retriveCodArticolList();
      });
      // Display articolList always, regardless of verbose mode
      updateUIMessage(articolList);

      // Step 4: Merge changes using single statement
      timeOperation("Merging data", function () {
        return executeSql(sucursaleMergeQuery, false);
      });

      // Step 5: Clean up temporary table
      timeOperation("Cleaning up temporary table", function () {
        return executeSql(sucursaleCleanupQuery, false);
      });
    } else {
      // Process for headquarters (1000)
      updateUIMessage("Se proceseaza pentru HQ." + "\n");
      timeOperation("Updating HQ data", function () {
        return executeSql(hqQuery, false);
      });
    }

    if (isVerbose) {
      var processingEndTime = new Date().getTime();
      var totalElapsedSeconds = (
        (processingEndTime - processingStartTime) /
        1000
      ).toFixed(2);

      updateUIMessage("\n=== Performance Summary ===\n");
      updateUIMessage(
        "Total processing time: " + totalElapsedSeconds + " seconds\n"
      );

      // Show timing breakdown
      updateUIMessage("Operation breakdown:\n");
      for (var op in operationTimings) {
        var percentage = (
          (operationTimings[op] / parseFloat(totalElapsedSeconds)) *
          100
        ).toFixed(1);
        updateUIMessage(
          "- " + op + ": " + operationTimings[op] + "s (" + percentage + "%)\n"
        );
      }
      updateUIMessage("========================\n\n");
    }

    updateUIMessage("Valorile min max au fost actualizate." + "\n");

    return messages + "\n";
  }

  return startProcessing();
}

// Call the function
function callInsertCalculatedMinMax() {
  var debugMessages = "";
  const testParams = {
    vSucursale: 2200, // Test with HQ (1000) first, can be changed to test branches
    vFurnizor: 72235, // From default value in SBSL - ALL
    vArticol: 2606178, // From default value in SBSL - ALL
    vItemCode: "IVP500312%",
    vWWSAL: 3, // Default value from SBSL
    vPSAL: 3, // Default value from SBSL
    vSSF: 1, // Default value from SBSL
    vLT: 15, // Default value from SBSL
    vRP: 7, // Default value from SBSL
    vSL: 75, // Default value from SBSL
    vOF: 0, // Default value from SBSL
    vPerioada: 52, // Default value from SBSL
    vData: "2025-02-27", // Current date
    isVerbose: true, // Enable verbose mode for detailed output
    isAPI: false, // Run as UI mode by default for testing
  };

  debugMessages +=
    "Execution started at: " + new Date().toLocaleTimeString() + "\n";
  debugMessages +=
    "Starting test with params:" + JSON.stringify(testParams, null, 2) + "\n";
  debugMessages += insertCalculatedMinMax(testParams);
  debugMessages +=
    "Execution ended at: " + new Date().toLocaleTimeString() + "\n";
  return debugMessages;
}

//code in designer's script

/*
lib.include("CalculMinMax");

var isVisible = 1;

function EXECCOMMAND(cmd) {
  if (cmd == 20250227) {
    const params = {
      vSucursale: CCCCALCULMINMAXVT.SUCURSALE || 2200,
      vFurnizor: CCCCALCULMINMAXVT.FURNIZORI || 72235,
      vArticol: CCCCALCULMINMAXVT.ARTICOL || 2606178,
      vItemCode: CCCCALCULMINMAXVT.CODESW || "",
      vWWSAL: CCCCALCULMINMAXVT.WWSAL || 3,
      vPSAL: CCCCALCULMINMAXVT.PSAL || 3,
      vSSF: CCCCALCULMINMAXVT.SSF || 1,
      vLT: CCCCALCULMINMAXVT.LT || 15,
      vRP: CCCCALCULMINMAXVT.RP || 7,
      vSL: CCCCALCULMINMAXVT.SL || 75,
      vOF: CCCCALCULMINMAXVT.OF || 0,
      vPerioada: CCCCALCULMINMAXVT.PERIOADA || 52,
      vData:
        X.FORMATDATE("yyyymmdd", CCCCALCULMINMAXVT.DATA) ||
        X.FORMATDATE(X.SYS.LOGINDATE),
      isVerbose: CCCCALCULMINMAXVT.VERBOSE || false,
      isAPI: false, // Adding this to indicate it's called from UI
    };

    var ans;
    var code = CCCCALCULMINMAXVT.CODESW || "";
    if (code.length === 0) {
      ans = X.ASK("Sunteti sigur ca vreti sa rulati fara cod?", "Continui ?"); // 6=Yes, 7=No, 2=Cancel
      if (ans == 7 || ans == 2) {
        X.EXCEPTION("Introduceti codul sau parte din codul articolului%.");
      }
    }
    CCCCALCULMINMAXVT.MESSAGES = insertCalculatedMinMax(params);
  }

  if (cmd == 20250228) {
    isVisible = !isVisible;
    X.SETPROPERTY("PANEL", "Panel1", "VISIBLE", isVisible);
  }
}
*/
