//This file is executed by ERP (Softone) and it is used to get the data for the analytics dashboard
//The data is retrieved from a stored procedure that is executed in the database by internal mechanisms of the ERP
//It returns data at API's url https://mecdiesel.oncloud.gr/s1services/JS/ReumplereSucursale/getAnalytics with properly formatted JSON
function getAnalytics(apiObj) {
  var branchesEmit = apiObj.branchesEmit;
  var branchesDest = apiObj.branchesDest;
  // Use hasOwnProperty to check if the UI explicitly passed a value; else default to true
  var setConditionForNecesar = apiObj.hasOwnProperty('setConditionForNecesar') ? apiObj.setConditionForNecesar : true;
  var setConditionForLimits = apiObj.hasOwnProperty('setConditionForLimits') ? apiObj.setConditionForLimits : true;
  var fiscalYear = apiObj.fiscalYear || new Date().getFullYear();
  var company = apiObj.company || X.SYS.COMPANY;

  const startT = new Date().getTime();

  // Call the stored procedure instead of constructing a massive query
  const qry =
    "EXEC sp_GetMtrlsData " +
    "@branchesEmit = '" +
    branchesEmit +
    "', " +
    "@branchesDest = '" +
    branchesDest +
    "', " +
    "@company = " +
    company +
    ", " +
    "@setConditionForNecesar = " +
    (setConditionForNecesar ? "1" : "0") +
    ", " +
    "@setConditionForLimits = " +
    (setConditionForLimits ? "1" : "0") +
    ", " +
    "@fiscalYear = " +
    fiscalYear;

  var ds = X.GETSQLDATASET(qry, null);

  const endT = new Date().getTime();
  const d = (endT - startT) / 1000;

  var j = ds.JSON;
  var obj = JSON.parse(j);
  // Add duration to the response object, not as a separate property if obj is an array
  if (Array.isArray(obj)) {
    // If the result is an array, we might want to wrap it or add duration differently
    // Option 1: Wrap in an object
    // return { data: obj, duration: d }; 
    // Option 2: Add duration to each item (less ideal)
    // obj.forEach(item => item.duration = d);
    // Option 3: Return as is, duration might be logged or handled elsewhere
     return obj; // Returning array directly, assuming duration might be logged or handled elsewhere
  } else {
     // If obj is already an object (e.g., error or single result), add duration
     obj.duration = d;
     return obj;
  }
}
