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
    var nrSaptamani = apiObj.hasOwnProperty('nrSaptamani') ? apiObj.nrSaptamani : 24;
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
    const startT = new Date().getTime();

    // Construct the SQL query to execute the stored procedure
    const qry =
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
        const endT = new Date().getTime();
        const duration = (endT - startT) / 1000;

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
        const errorTime = new Date().getTime();
        const errorDuration = (errorTime - startT) / 1000;

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
    var nrSaptamani = apiObj.hasOwnProperty('nrSaptamani') ? apiObj.nrSaptamani : 24;
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
    const startT = new Date().getTime();

    // Construct the SQL query to execute the stored procedure
    const qry =
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
        const endT = new Date().getTime();
        const duration = (endT - startT) / 1000;

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
        const errorTime = new Date().getTime();
        const errorDuration = (errorTime - startT) / 1000;

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




