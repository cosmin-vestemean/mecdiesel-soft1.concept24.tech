// AJS script for TOP ABC Analysis
// This file will be deployed to S1 Services and provide the /JS/TopAbcAnalysis/getTopAbcAnalysis endpoint

/**
 * TOP ABC Analysis API function
 * This function calls the sp_TopAbcAnalysis stored procedure and returns the ABC analysis results
 * Endpoint: /JS/TopAbcAnalysis/getTopAbcAnalysis
 *
 * @param {Object} apiObj - Parameters passed from the client
 * @param {string} [apiObj.dataReferinta=null] - Reference date for analysis
 * @param {number} [apiObj.nrSaptamani=0] - Number of weeks to analyze
 * @param {string} [apiObj.seriesL=''] - Comma-separated list of series to exclude
 * @param {string} [apiObj.branch=''] - Comma-separated list of branches to filter
 * @param {number} [apiObj.supplier=null] - Supplier ID to filter (null = all suppliers)
 * @param {number} [apiObj.mtrl=null] - Material ID to filter (null = all materials)
 * @param {string} [apiObj.cod=''] - Product code to filter
 * @param {number} [apiObj.searchType=1] - Type of search for product code (1-starts with, 2-contains, 3-ends with)
 * @param {string} [apiObj.modFiltrareBranch='AGENT'] - Branch filter mode ('AGENT' or 'DOCUMENT')
 * @param {number} [apiObj.thresholdA=80.00] - Threshold percentage for 'A' class items
 * @param {number} [apiObj.thresholdB=15.00] - Threshold percentage for 'B' class items
 * @returns {Object} Analysis results with timing information
 */
function getTopAbcAnalysis(apiObj) {
    // Extract parameters with defaults
    // Default to current day in yyyy-MM-dd if not provided
    var dataReferinta = apiObj.hasOwnProperty('dataReferinta') && apiObj.dataReferinta
        ? apiObj.dataReferinta
        : "'" + (new Date()).toISOString().slice(0, 10) + "'";
    var nrSaptamani = apiObj.hasOwnProperty('nrSaptamani') ? apiObj.nrSaptamani : 52;
    var seriesL = apiObj.hasOwnProperty('seriesL') ? apiObj.seriesL : '';
    var branch = apiObj.hasOwnProperty('branch') ? apiObj.branch : '';
    var supplier = apiObj.hasOwnProperty('supplier') ? apiObj.supplier && apiObj.supplier : 72235
    var mtrl = apiObj.hasOwnProperty('mtrl') ? apiObj.mtrl && apiObj.mtrl : 2606178;
    var cod = apiObj.hasOwnProperty('cod') ? apiObj.cod : '';
    var searchType = apiObj.hasOwnProperty('searchType') ? apiObj.searchType : 1;
    var modFiltrareBranch = apiObj.hasOwnProperty('modFiltrareBranch') ? apiObj.modFiltrareBranch : 'AGENT';
    var thresholdA = apiObj.hasOwnProperty('thresholdA') ? apiObj.thresholdA : 80.00;
    var thresholdB = apiObj.hasOwnProperty('thresholdB') ? apiObj.thresholdB : 15.00;

    // Record start time for performance measurement
    var startT = new Date().getTime();

    // Construct the SQL query to execute the stored procedure
    var qry =
        "EXEC sp_TopAbcAnalysis " +
        "@dataReferinta = " + dataReferinta + ", " +
        "@nrSaptamani = " + nrSaptamani + ", " +
        "@seriesL = '" + seriesL + "', " +
        "@branch = '" + branch + "', " +
        "@supplier = " + supplier + ", " +
        "@mtrl = " + mtrl + ", " +
        "@cod = '" + cod + "', " +
        "@searchType = " + searchType + ", " +
        "@modFiltrareBranch = '" + modFiltrareBranch + "', " +
        "@thresholdA = " + thresholdA + ", " +
        "@thresholdB = " + thresholdB;

    // Execute the query and get results
    try {
        var ds = X.GETSQLDATASET(qry, null);

        // Calculate execution time
        var endT = new Date().getTime();
        var duration = (endT - startT) / 1000;

        // Process the JSON result
        var jsonResult = ds.JSON;

        // Replace null values with empty strings for better client handling
        jsonResult = jsonResult.replace(/"null"/g, '""');

        // Parse the JSON and add performance metrics
        var result = {};
        
        result.rows = JSON.parse(jsonResult); // This can also throw an error

        // Add execution duration to the result
        result.duration = duration;

        //add query to the result
        result.query = qry;

        //add params to the result
        result.params = {
            dataReferinta: dataReferinta,
            nrSaptamani: nrSaptamani,
            seriesL: seriesL,
            branch: branch,
            supplier: supplier,
            mtrl: mtrl,
            cod: cod,
            searchType: searchType,
            modFiltrareBranch: modFiltrareBranch,
            thresholdA: thresholdA,
            thresholdB: thresholdB
        };
        // Add the number of records to the result
        result.total = ds.RECORDCOUNT || 0;

        result.success = true; // Indicate success
        result.message = "Query executed successfully";

        // Return the final result object
        return result;
    } catch (e) {
        var errorTime = new Date().getTime();
        var errorDuration = (errorTime - startT) / 1000;

        // Consider logging the error server-side if a mechanism exists
        // e.g., X.LogWarning("Error in getTopAbcAnalysis: " + e.message + " Query: " + qry);

        return {
            success: false,
            message: "Error executing query: " + e.message,
            // stack: e.stack, // Optional: include stack trace if useful for client debugging
            query: qry,
            params: { // Parameters that were used or would have been used for the query
                dataReferinta: dataReferinta,
                nrSaptamani: nrSaptamani,
                seriesL: seriesL,
                branch: branch,
                supplier: supplier,
                mtrl: mtrl,
                cod: cod,
                searchType: searchType,
                modFiltrareBranch: modFiltrareBranch,
                thresholdA: thresholdA,
                thresholdB: thresholdB
            },
            duration: errorDuration
        };
    }
}

/**
 * TOP ABC Analysis API function - Combined JSON Output
 * This function calls the sp_TopAbcAnalysis_CombinedJson stored procedure and returns the ABC analysis results
 * in a single JSON object.
 * Endpoint: /JS/TopAbcAnalysis/getTopAbcAnalysis_combined
 *
 * @param {Object} apiObj - Parameters passed from the client
 * @param {string} [apiObj.dataReferinta=null] - Reference date for analysis
 * @param {number} [apiObj.nrSaptamani=0] - Number of weeks to analyze
 * @param {string} [apiObj.seriesL=''] - Comma-separated list of series to exclude
 * @param {string} [apiObj.branch=''] - Comma-separated list of branches to filter
 * @param {number} [apiObj.supplier=null] - Supplier ID to filter (null = all suppliers)
 * @param {number} [apiObj.mtrl=null] - Material ID to filter (null = all materials)
 * @param {string} [apiObj.cod=''] - Product code to filter
 * @param {number} [apiObj.searchType=1] - Type of search for product code (1-starts with, 2-contains, 3-ends with)
 * @param {string} [apiObj.modFiltrareBranch='AGENT'] - Branch filter mode ('AGENT' or 'DOCUMENT')
 * @param {number} [apiObj.thresholdA=80.00] - Threshold percentage for 'A' class items
 * @param {number} [apiObj.thresholdB=15.00] - Threshold percentage for 'B' class items
 * @returns {Object} Analysis results with timing information and combined JSON structure
 */
function getTopAbcAnalysis_combined(apiObj) {
    // Extract parameters with defaults
    var dataReferinta = apiObj.hasOwnProperty('dataReferinta') && apiObj.dataReferinta
        ? apiObj.dataReferinta
        : "'" + (new Date()).toISOString().slice(0, 10) + "'";
    var nrSaptamani = apiObj.hasOwnProperty('nrSaptamani') ? apiObj.nrSaptamani : 52;
    var seriesL = apiObj.hasOwnProperty('seriesL') ? apiObj.seriesL : '';
    var branch = apiObj.hasOwnProperty('branch') ? apiObj.branch : '';
    var supplier = apiObj.hasOwnProperty('supplier') && apiObj.supplier ? apiObj.supplier : 72235;
    var mtrl = apiObj.hasOwnProperty('mtrl') && apiObj.mtrl ? apiObj.mtrl : 2606178;
    var cod = apiObj.hasOwnProperty('cod') ? apiObj.cod : '';
    var searchType = apiObj.hasOwnProperty('searchType') ? apiObj.searchType : 1;
    var modFiltrareBranch = apiObj.hasOwnProperty('modFiltrareBranch') ? apiObj.modFiltrareBranch : 'AGENT';
    var thresholdA = apiObj.hasOwnProperty('thresholdA') ? apiObj.thresholdA : 80.00;
    var thresholdB = apiObj.hasOwnProperty('thresholdB') ? apiObj.thresholdB : 15.00;

    // Record start time for performance measurement
    var startT = new Date().getTime();

    // Construct the SQL query to execute the stored procedure
    var qry =
        "EXEC sp_TopAbcAnalysis_CombinedJson " + // Changed stored procedure name
        "@dataReferinta = " + dataReferinta + ", " +
        "@nrSaptamani = " + nrSaptamani + ", " +
        "@seriesL = '" + seriesL + "', " +
        "@branch = '" + branch + "', " +
        "@supplier = " + supplier + ", " +
        "@mtrl = " + mtrl + ", " +
        "@cod = '" + cod + "', " +
        "@searchType = " + searchType + ", " +
        "@modFiltrareBranch = '" + modFiltrareBranch + "', " +
        "@thresholdA = " + thresholdA + ", " +
        "@thresholdB = " + thresholdB;

    // Execute the query and get results
    try {
        var ds = X.GETSQLDATASET(qry, null);

        // Calculate execution time
        var endT = new Date().getTime();
        var duration = (endT - startT) / 1000;

        // Process the JSON result
        // ds.JSON will contain a string like: '[{"CombinedJsonOutput": "{...json...}"}]'
        // We need to parse it twice: once for the array, once for the inner JSON string.
        var rawResultArray = JSON.parse(ds.JSON);
        if (!rawResultArray || rawResultArray.length === 0 || !rawResultArray[0].CombinedJsonOutput) {
            throw new Error("Unexpected JSON structure from sp_TopAbcAnalysis_CombinedJson");
        }
        
        var combinedJsonString = rawResultArray[0].CombinedJsonOutput;
        
        // Replace null values with empty strings for better client handling within the combined JSON
        combinedJsonString = combinedJsonString.replace(/"null"/g, '""');
        
        var parsedCombinedJson = JSON.parse(combinedJsonString);

        var result = {};
        result.data = parsedCombinedJson; // Contains DetailedRows, SummaryRows, TotalPositiveSales
        
        // Add execution duration to the result
        result.duration = duration;

        //add query to the result
        result.query = qry;

        //add params to the result
        result.params = {
            dataReferinta: dataReferinta,
            nrSaptamani: nrSaptamani,
            seriesL: seriesL,
            branch: branch,
            supplier: supplier,
            mtrl: mtrl,
            cod: cod,
            searchType: searchType,
            modFiltrareBranch: modFiltrareBranch,
            thresholdA: thresholdA,
            thresholdB: thresholdB
        };
        
        // total can be derived from DetailedRows.length if needed, or taken from TotalPositiveSales
        // For consistency, let's assume the client might expect a 'total' for detailed rows.
        result.total = parsedCombinedJson.DetailedRows ? parsedCombinedJson.DetailedRows.length : 0;

        result.success = true; // Indicate success
        result.message = "Query executed successfully (Combined JSON)";

        // Return the final result object
        return result;
    } catch (e) {
        var errorTime = new Date().getTime();
        var errorDuration = (errorTime - startT) / 1000;

        return {
            success: false,
            message: "Error executing combined query: " + e.message,
            query: qry,
            params: {
                dataReferinta: dataReferinta,
                nrSaptamani: nrSaptamani,
                seriesL: seriesL,
                branch: branch,
                supplier: supplier,
                mtrl: mtrl,
                cod: cod,
                searchType: searchType,
                modFiltrareBranch: modFiltrareBranch,
                thresholdA: thresholdA,
                thresholdB: thresholdB
            },
            duration: errorDuration
        };
    }
}

/**
 * Save TOP ABC Analysis Results API function
 * This function saves ABC analysis results to CCCTOPABC and CCCTOPABCSUMMARY tables
 * with proper transaction handling and audit trail
 * Endpoint: /JS/TopAbcAnalysis/saveTopAbcAnalysis
 *
 * @param {Object} apiObj - Parameters passed from the client
 * @param {string} apiObj.dataReferinta - Reference date for analysis
 * @param {number} apiObj.nrSaptamani - Number of weeks to analyze
 * @param {string} [apiObj.seriesL=''] - Comma-separated list of series to exclude
 * @param {string} apiObj.branch - Comma-separated list of branches to filter (required)
 * @param {number} [apiObj.supplier=null] - Supplier ID to filter
 * @param {number} [apiObj.mtrl=null] - Material ID to filter
 * @param {string} [apiObj.cod=''] - Product code to filter
 * @param {number} [apiObj.searchType=1] - Type of search for product code
 * @param {string} [apiObj.modFiltrareBranch='AGENT'] - Branch filter mode
 * @param {number} [apiObj.thresholdA=80.00] - Threshold percentage for 'A' class items
 * @param {number} [apiObj.thresholdB=15.00] - Threshold percentage for 'B' class items
 * @param {Array} apiObj.data - Array of ABC analysis result items to save
 * @param {Array} apiObj.summary - Array of summary data to save
 * @returns {Object} Save operation results with timing information
 */
function saveTopAbcAnalysis(apiObj) {
    var startT = new Date().getTime();
    
    // Validate required parameters
    if (!apiObj.branch || apiObj.branch.trim() === '') {
        return {
            success: false,
            message: "Branch selection is required for saving",
            duration: 0
        };
    }
    
    if (!apiObj.data || !Array.isArray(apiObj.data) || apiObj.data.length === 0) {
        return {
            success: false,
            message: "No data provided to save",
            duration: 0
        };
    }
    
    // Extract parameters with defaults
    var dataReferinta = apiObj.dataReferinta || "'" + (new Date()).toISOString().slice(0, 10) + "'";
    var nrSaptamani = apiObj.nrSaptamani || 52;
    var seriesL = apiObj.seriesL || '';
    var branch = apiObj.branch;
    var supplier = apiObj.supplier || null;
    var mtrl = apiObj.mtrl || null;
    var cod = apiObj.cod || '';
    var searchType = apiObj.searchType || 1;
    var modFiltrareBranch = apiObj.modFiltrareBranch || 'AGENT';
    var thresholdA = apiObj.thresholdA || 80.00;
    var thresholdB = apiObj.thresholdB || 15.00;
    
    // Parse branch list for iteration
    var branchSplit = branch.split(',');
    var branchList = [];
    for (var i = 0; i < branchSplit.length; i++) {
        var trimmed = branchSplit[i].trim();
        if (trimmed !== '') {
            branchList.push(trimmed);
        }
    }
    
    if (branchList.length === 0) {
        return {
            success: false,
            message: "No valid branches found in branch parameter",
            duration: 0
        };
    }
    
    // Build transaction queries
    var queryList = [];
    var totalInserts = 0;
    var summaryInserts = 0;
    var executedQuery = ""; // Variable to store the executed query
    
    try {
        // Start transaction
        queryList.push("BEGIN TRAN");
        
        // For each branch, reset existing data and insert new data
        for (var j = 0; j < branchList.length; j++) {
            var branchCode = branchList[j];
            var branchNum = parseInt(branchCode);
            
            // Calculate summary counts for this branch
            var branchData = [];
            var aCount = 0;
            var bCount = 0;
            var cCount = 0;
            
            // Filter branch data and count ABC classifications
            for (var k = 0; k < apiObj.data.length; k++) {
                var item = apiObj.data[k];
                if (item.BRANCH == branchNum) {
                    // Keep essential fields including VALUE and CUMULATIVEPERC for proper save/load
                    branchData.push({
                        MTRL: item.MTRL,
                        BRANCH: item.BRANCH,
                        SALESPERC: item.SALESPERC || item.SALESPRCNT || 0,
                        CUMULATIVEPERC: item.CUMULATIVEPERC || 0,
                        VALUE: item.VALUE || 0,
                        ABC: item.ABC
                    });
                    
                    // Count ABC classifications
                    if (item.ABC === 'A') {
                        aCount++;
                    } else if (item.ABC === 'B') {
                        bCount++;
                    } else if (item.ABC === 'C') {
                        cCount++;
                    }
                }
            }
            
            // Step 1: Reset existing data for this branch and date (audit trail)
            queryList.push(
                "UPDATE CCCTOPABC " +
                "SET ABC = '0' " +
                "WHERE CCCTOPABCSUMMARYID IN (" +
                    "SELECT CCCTOPABCSUMMARYID " +
                    "FROM CCCTOPABCSUMMARY " +
                    "WHERE DATACALCUL = " + dataReferinta + " AND BRANCH = " + branchNum +
                ")"
            );
            
            // Step 2: Delete existing summary for this branch and date
            queryList.push(
                "DELETE FROM CCCTOPABCSUMMARY " +
                "WHERE DATACALCUL = " + dataReferinta + " AND BRANCH = " + branchNum
            );
            
            // Step 3: Insert new summary record
            queryList.push(
                "INSERT INTO CCCTOPABCSUMMARY (" +
                    "DATACALCUL, BRANCH, NRSAPT, MODSUC, SERIIEXCL, A, B, C" +
                ") VALUES (" +
                    dataReferinta + ", " + 
                    branchNum + ", " + 
                    nrSaptamani + ", " + 
                    "'" + modFiltrareBranch + "', " + 
                    "'" + seriesL + "', " + 
                    aCount + ", " + 
                    bCount + ", " + 
                    cCount +
                ")"
            );
            summaryInserts++;
            
            // Step 4: Get the newly inserted summary ID and insert detail records
            // First, we need to get the summary ID
            queryList.push(
                "DECLARE @SummaryID_" + branchNum + " INT;" +
                "SELECT @SummaryID_" + branchNum + " = CCCTOPABCSUMMARYID " +
                "FROM CCCTOPABCSUMMARY " +
                "WHERE DATACALCUL = " + dataReferinta + " AND BRANCH = " + branchNum + ";"
            );
            
            // Step 5: Insert detail records for this branch
            for (var l = 0; l < branchData.length; l++) {
                var item = branchData[l];
                // Use the sales percentage from UI data
                var mtrlValue = item.MTRL || 0;
                var salesPrcnt = item.SALESPERC || item.SALESPRCNT || 0;
                var cumulativePerc = item.CUMULATIVEPERC || 0;
                var value = item.VALUE || 0;
                var abc = item.ABC || 'C';
                
                queryList.push(
                    "INSERT INTO CCCTOPABC (" +
                        "CCCTOPABCSUMMARYID, MTRL, BRANCH, SALESPERC, CUMULATIVEPERC, VALUE, ABC" +
                    ") VALUES (" +
                        "@SummaryID_" + branchNum + ", " + 
                        mtrlValue + ", " + 
                        branchNum + ", " + 
                        salesPrcnt + ", " + 
                        cumulativePerc + ", " + 
                        value + ", " + 
                        "'" + abc + "'" +
                    ")"
                );
                totalInserts++;
            }
        }
        
        // Commit transaction
        queryList.push("COMMIT TRAN");
        
        executedQuery = queryList.join(';'); // Store the query
        // Execute all queries as a single transaction
        var result = X.RUNSQL(executedQuery, null);
        
        var endT = new Date().getTime();
        var duration = (endT - startT) / 1000;
        
        if (result && result.success !== false) {
            return {
                success: true,
                message: "Successfully saved ABC analysis results. Processed " + branchList.length + " branch(es), " + totalInserts + " detail records, " + summaryInserts + " summary records.",
                duration: duration,
                branches: branchList,
                totalInserts: totalInserts,
                summaryInserts: summaryInserts,
                query: executedQuery, // Add executed query to success response
                params: {
                    dataReferinta: dataReferinta,
                    nrSaptamani: nrSaptamani,
                    seriesL: seriesL,
                    branch: branch,
                    supplier: supplier,
                    mtrl: mtrl,
                    cod: cod,
                    searchType: searchType,
                    modFiltrareBranch: modFiltrareBranch,
                    thresholdA: thresholdA,
                    thresholdB: thresholdB
                }
            };
        } else {
            // If there was an error, the transaction should have been rolled back
            // No explicit rollback here, assuming X.RUNSQL handles transaction failure or it's in the catch.
            var errorMessage = "Unknown error";
            if (result && result.message) {
                errorMessage = result.message;
            }
            return {
                success: false,
                message: "Error during save operation: " + errorMessage,
                duration: duration,
                query: executedQuery, // Add executed query to error response
                queryCount: queryList.length
            };
        }
        
    } catch (e) {
        // Add rollback in case of exception
        try {
            X.RUNSQL("ROLLBACK TRAN", null); // Corrected rollback call
        } catch (rollbackError) {
            // Log rollback error but don't override main error
            // console.error("Rollback error: ", rollbackError);
        }
        
        var errorTime = new Date().getTime();
        var errorDuration = (errorTime - startT) / 1000;
        
        // Ensure executedQuery is populated even if the main transaction wasn't formed/run
        if (queryList.length > 0 && executedQuery === "") {
            executedQuery = queryList.join(';');
        }

        return {
            success: false,
            message: "Exception during save operation: " + e.message,
            duration: errorDuration,
            query: executedQuery, // Add executed query to exception response
            queryCount: queryList.length,
            error: e.toString()
        };
    }
}

/**
 * Save TOP ABC Analysis Results in Chunks API function
 * This function saves ABC analysis results in chunks to handle large datasets
 * without hitting request size limits. Uses append-only strategy for chunks.
 * Endpoint: /JS/TopAbcAnalysis/saveTopAbcAnalysisChunk
 *
 * @param {Object} apiObj - Parameters passed from the client
 * @param {string} apiObj.dataReferinta - Reference date for analysis
 * @param {number} apiObj.nrSaptamani - Number of weeks to analyze
 * @param {string} apiObj.branch - Comma-separated list of branches to filter (required)
 * @param {Array} apiObj.data - Array of ABC analysis result items to save (chunk)
 * @param {Array} [apiObj.summary] - Array of summary data (only for first chunk)
 * @param {boolean} apiObj.isChunk - Flag indicating this is a chunk operation
 * @param {number} apiObj.chunkNumber - Current chunk number (1-based)
 * @param {number} apiObj.totalChunks - Total number of chunks
 * @returns {Object} Save operation results with timing information
 */
function saveTopAbcAnalysisChunk(apiObj) {
    var startT = new Date().getTime();
    
    // Validate required parameters
    if (!apiObj.branch || apiObj.branch.trim() === '') {
        return {
            success: false,
            message: "Branch selection is required for saving",
            duration: 0
        };
    }
    
    if (!apiObj.data || !Array.isArray(apiObj.data) || apiObj.data.length === 0) {
        return {
            success: false,
            message: "No data provided to save",
            duration: 0
        };
    }
    
    if (!apiObj.isChunk || !apiObj.chunkNumber || !apiObj.totalChunks) {
        return {
            success: false,
            message: "Invalid chunk parameters. Use saveTopAbcAnalysis for non-chunked operations.",
            duration: 0
        };
    }
    
    // Extract parameters with defaults
    var dataReferinta = apiObj.dataReferinta || "'" + (new Date()).toISOString().slice(0, 10) + "'";
    var nrSaptamani = apiObj.nrSaptamani || 52;
    var seriesL = apiObj.seriesL || '';
    var branch = apiObj.branch;
    var supplier = apiObj.supplier || null;
    var mtrl = apiObj.mtrl || null;
    var cod = apiObj.cod || '';
    var searchType = apiObj.searchType || 1;
    var modFiltrareBranch = apiObj.modFiltrareBranch || 'AGENT';
    var thresholdA = apiObj.thresholdA || 80.00;
    var thresholdB = apiObj.thresholdB || 15.00;
    var chunkNumber = apiObj.chunkNumber;
    var totalChunks = apiObj.totalChunks;
    
    // Parse branch list for iteration
    var branchSplit = branch.split(',');
    var branchList = [];
    for (var i = 0; i < branchSplit.length; i++) {
        var trimmed = branchSplit[i].trim();
        if (trimmed !== '') {
            branchList.push(trimmed);
        }
    }
    
    if (branchList.length === 0) {
        return {
            success: false,
            message: "No valid branches found in branch parameter",
            duration: 0
        };
    }
    
    // Build transaction queries
    var queryList = [];
    var totalInserts = 0;
    var summaryInserts = 0;
    var executedQuery = ""; // Variable to store the executed query
    
    try {
        // Start transaction
        queryList.push("BEGIN TRAN");
        
        // For first chunk only: handle summary data
        if (chunkNumber === 1 && apiObj.summary && Array.isArray(apiObj.summary)) {
            // Process summary insertion for each branch
            for (var j = 0; j < branchList.length; j++) {
                var branchCode = branchList[j];
                var branchNum = parseInt(branchCode);
                
                // Calculate summary counts for this branch from ALL data (estimate from chunk 1)
                var aCount = 0;
                var bCount = 0;
                var cCount = 0;
                
                // Count ABC classifications in this chunk
                for (var k = 0; k < apiObj.data.length; k++) {
                    var item = apiObj.data[k];
                    if (item.BRANCH == branchNum) {
                        if (item.ABC === 'A') {
                            aCount++;
                        } else if (item.ABC === 'B') {
                            bCount++;
                        } else if (item.ABC === 'C') {
                            cCount++;
                        }
                    }
                }
                
                // Scale counts based on total chunks (rough estimate)
                aCount = Math.round(aCount * totalChunks);
                bCount = Math.round(bCount * totalChunks);
                cCount = Math.round(cCount * totalChunks);
                
                // Insert summary record
                queryList.push(
                    "INSERT INTO CCCTOPABCSUMMARY (" +
                        "DATACALCUL, BRANCH, NRSAPT, MODSUC, SERIIEXCL, A, B, C" +
                    ") VALUES (" +
                        dataReferinta + ", " + 
                        branchNum + ", " + 
                        nrSaptamani + ", " + 
                        "'" + modFiltrareBranch + "', " + 
                        "'" + seriesL + "', " + 
                        aCount + ", " + 
                        bCount + ", " + 
                        cCount +
                    ")"
                );
                summaryInserts++;
            }
        }
        
        // For each branch, insert detail records from this chunk
        for (var j = 0; j < branchList.length; j++) {
            var branchCode = branchList[j];
            var branchNum = parseInt(branchCode);
            
            // Get the summary ID for this branch (should exist from chunk 1 or reset operation)
            queryList.push(
                "DECLARE @SummaryID_" + branchNum + "_" + chunkNumber + " INT;" +
                "SELECT @SummaryID_" + branchNum + "_" + chunkNumber + " = CCCTOPABCSUMMARYID " +
                "FROM CCCTOPABCSUMMARY " +
                "WHERE DATACALCUL = " + dataReferinta + " AND BRANCH = " + branchNum + ";"
            );
            
            // Insert detail records for this branch from the current chunk
            for (var l = 0; l < apiObj.data.length; l++) {
                var item = apiObj.data[l];
                // Filter data for the current branch
                if (item.BRANCH == branchNum) {
                    var mtrlValue = item.MTRL || 0;
                    var salesPrcnt = item.SALESPERC || item.SALESPRCNT || 0; // Use correct field name
                    var cumulativePerc = item.CUMULATIVEPERC || 0;
                    var value = item.VALUE || 0;
                    var abc = item.ABC || 'C';
                    
                    queryList.push(
                        "INSERT INTO CCCTOPABC (" +
                            "CCCTOPABCSUMMARYID, MTRL, BRANCH, SALESPERC, CUMULATIVEPERC, VALUE, ABC" +
                        ") VALUES (" +
                            "@SummaryID_" + branchNum + "_" + chunkNumber + ", " + 
                            mtrlValue + ", " + 
                            branchNum + ", " + 
                            salesPrcnt + ", " + 
                            cumulativePerc + ", " + 
                            value + ", " + 
                            "'" + abc + "'" +
                        ")"
                    );
                    totalInserts++;
                }
            }
        }
        
        // Commit transaction
        queryList.push("COMMIT TRAN");
        
        executedQuery = queryList.join(';'); // Store the query
        // Execute all queries as a single transaction
        var result = X.RUNSQL(executedQuery, null);
        
        var endT = new Date().getTime();
        var duration = (endT - startT) / 1000;
        
        if (result && result.success !== false) {
            return {
                success: true,
                message: "Successfully saved chunk " + chunkNumber + "/" + totalChunks + ". Processed " + totalInserts + " detail records.",
                duration: duration,
                chunkNumber: chunkNumber,
                totalChunks: totalChunks,
                totalInsertsInChunk: totalInserts,
                query: executedQuery, // Add executed query to success response
                params: { // Include relevant params for chunk context
                    dataReferinta: dataReferinta,
                    branch: branch,
                    chunkNumber: chunkNumber,
                    totalChunks: totalChunks
                }
            };
        } else {
            var errorMessage = "Unknown error";
            if (result && result.message) {
                errorMessage = result.message;
            }
            return {
                success: false,
                message: "Error saving chunk " + chunkNumber + ": " + errorMessage,
                duration: duration,
                query: executedQuery, // Add executed query to error response
                queryCount: queryList.length
            };
        }
        
    } catch (e) {
        // Add rollback in case of exception
        try {
            X.RUNSQL("ROLLBACK TRAN", null); // Corrected rollback call
        } catch (rollbackError) {
            // Log rollback error but don't override main error
            // console.error("Rollback error: ", rollbackError);
        }
        
        var errorTime = new Date().getTime();
        var errorDuration = (errorTime - startT) / 1000;

        // Ensure executedQuery is populated even if the main transaction wasn't formed/run
        if (queryList.length > 0 && executedQuery === "") {
            executedQuery = queryList.join(';');
        }
        
        return {
            success: false,
            message: "Exception during chunk save operation (chunk " + chunkNumber + "): " + e.message,
            duration: errorDuration,
            query: executedQuery, // Add executed query to exception response
            queryCount: queryList.length,
            error: e.toString()
        };
    }
}

/**
 * Reset TOP ABC Analysis Data API function
 * This function clears existing ABC analysis data for a specific branch
 * from CCCTOPABC and CCCTOPABCSUMMARY tables.
 * Endpoint: /JS/TopAbcAnalysis/resetTopAbcAnalysis
 *
 * @param {Object} apiObj - Parameters passed from the client
 * @param {string} apiObj.branch - Comma-separated list of branches to reset (required)
 * @returns {Object} Reset operation results with timing information
 */
function resetTopAbcAnalysis(apiObj) {
    var startT = new Date().getTime();

    // Validate required parameters
    if (!apiObj.branch || apiObj.branch.trim() === '') {
        return {
            success: false,
            message: "Branch selection is required for resetting data",
            duration: 0,
            query: ""
        };
    }

    var branchList = apiObj.branch.split(',').map(function(b) { return b.trim(); });
    var branchInClause = branchList.map(function(b) { return "'" + b.replace(/'/g, "''") + "'"; }).join(',');

    var queryList = [];
    var executedQuery = ""; // To store the final query string

    try {
        X.RUNSQL("BEGIN TRAN", null);

        // Update CCCTOPABC: Set ABC = '0' for audit trail
        var updateTopAbcSql = "UPDATE CCCTOPABC SET ABC = '0' WHERE BRANCH IN (" + branchInClause + ")";
        queryList.push(updateTopAbcSql);
        
        // Conditionally delete from CCCTOPABCSUMMARY:
        // Delete summary records for the specified branch(es) only if they are not referenced by any CCCTOPABC record.
        var deleteOrphanSummarySql = "DELETE CS FROM CCCTOPABCSUMMARY CS WHERE CS.BRANCH IN (" + branchInClause + ") " +
                                     "AND NOT EXISTS (SELECT 1 FROM CCCTOPABC CD WHERE CD.CCCTOPABCSUMMARYID = CS.CCCTOPABCSUMMARYID)";
        queryList.push(deleteOrphanSummarySql);

        executedQuery = queryList.join(';');

        if (queryList.length > 0) {
            var resultDS = X.RUNSQL(executedQuery, null); // Execute the combined SQL
            // Future enhancement: Check resultDS for errors if X.RUNSQL provides detailed status.
        }

        X.RUNSQL("COMMIT TRAN", null);

        var endT = new Date().getTime();
        var duration = (endT - startT) / 1000;

        return {
            success: true,
            message: "Reset complete for branch(es) " + apiObj.branch + ": CCCTOPABC items marked for audit (ABC='0'). CCCTOPABCSUMMARY entries without corresponding CCCTOPABC items have been removed.",
            duration: duration,
            query: executedQuery // Return the executed query
        };
    } catch (e) {
        try {
            X.RUNSQL("ROLLBACK TRAN", null);
        } catch (rollEx) {
            // Log rollback error if possible, e.g., X.LogWarning("Rollback failed during reset: " + rollEx.message);
        }
        var errorTime = new Date().getTime();
        var errorDuration = (errorTime - startT) / 1000;
        return {
            success: false,
            message: "Error resetting data: " + e.message,
            duration: errorDuration,
            query: executedQuery // Return the query attempted, if any
        };
    }
}

/**
 * Load Saved TOP ABC Analysis Data API function
 * This function loads the most recent saved ABC analysis data for a specific branch
 * from CCCTOPABC and CCCTOPABCSUMMARY tables.
 * Endpoint: /JS/TopAbcAnalysis/loadSavedAnalysis
 *
 * @param {Object} apiObj - Parameters passed from the client
 * @param {string} apiObj.branch - Branch ID to load saved analysis for (required)
 * @returns {Object} Loaded analysis results with timing information
 */
function loadSavedAnalysis(apiObj) {
    var startT = new Date().getTime();
    
    // Validate required parameters
    if (!apiObj.branch || apiObj.branch.trim() === '') {
        return {
            success: false,
            message: "Branch selection is required for loading saved analysis",
            duration: 0
        };
    }
    
    // For simplified single-branch load, take the first branch if multiple provided
    var branchCode = apiObj.branch.split(',')[0].trim();
    
    // Record start time for performance measurement
    var qry = "EXEC sp_LoadSavedAbcAnalysis_CombinedJson @branch = '" + branchCode + "'";
    
    // Execute the query and get results
    try {
        var ds = X.GETSQLDATASET(qry, null);
        
        // Calculate execution time
        var endT = new Date().getTime();
        var duration = (endT - startT) / 1000;
        
        // Process the JSON result
        var rawResultArray = JSON.parse(ds.JSON);
        
        if (!rawResultArray || rawResultArray.length === 0 || !rawResultArray[0].CombinedJsonOutput) {
            return {
                success: false,
                message: "No saved analysis data found for branch " + branchCode,
                duration: duration,
                query: qry
            };
        }
        
        var combinedJsonString = rawResultArray[0].CombinedJsonOutput;
        
        // Check if it's an error response
        if (combinedJsonString.indexOf('"error"') > -1) {
            var errorObj = JSON.parse(combinedJsonString);
            return {
                success: false,
                message: errorObj.error,
                duration: duration,
                query: qry
            };
        }
        
        // Replace null values with empty strings for better client handling
        combinedJsonString = combinedJsonString.replace(/"null"/g, '""');
        
        var parsedCombinedJson = JSON.parse(combinedJsonString);
        
        var result = {};
        result.data = parsedCombinedJson; // Contains DetailedRows, SummaryRows, LoadedAnalysis
        
        // Add execution duration to the result
        result.duration = duration;
        
        // Add query to the result
        result.query = qry;
        
        // Add params to the result
        result.params = {
            branch: branchCode,
            loadedFromSaved: true
        };
        
        // Extract and add period parameters if available from the loaded data
        if (parsedCombinedJson.PeriodParameters) {
            // Handle case where PeriodParameters might be a JSON string
            var periodParams = parsedCombinedJson.PeriodParameters;
            if (typeof periodParams === 'string') {
                try {
                    periodParams = JSON.parse(periodParams);
                } catch (parseError) {
                    // If parsing fails, log and skip period parameters
                    console.error('Failed to parse PeriodParameters:', parseError);
                    periodParams = null;
                }
            }
            
            if (periodParams) {
                result.params.dataReferinta = periodParams.dataReferinta;
                result.params.nrSaptamani = periodParams.nrSaptamani;
                result.params.modFiltrareBranch = periodParams.modFiltrareBranch;
                result.params.seriesL = periodParams.seriesL;
            }
        }
        
        // Total can be derived from DetailedRows.length
        result.total = parsedCombinedJson.DetailedRows ? parsedCombinedJson.DetailedRows.length : 0;
        
        result.success = true;
        result.message = "Successfully loaded saved ABC analysis for branch " + branchCode;
        
        // Return the final result object
        return result;
    } catch (e) {
        var errorTime = new Date().getTime();
        var errorDuration = (errorTime - startT) / 1000;
        
        return {
            success: false,
            message: "Error loading saved analysis: " + e.message,
            query: qry,
            params: {
                branch: branchCode
            },
            duration: errorDuration
        };
    }
}




