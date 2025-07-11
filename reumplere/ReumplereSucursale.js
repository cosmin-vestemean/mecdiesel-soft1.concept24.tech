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
  var materialCodeFilter = apiObj.materialCodeFilter || null;  // Add material code filter parameter
  var materialCodeFilterExclude = apiObj.hasOwnProperty('materialCodeFilterExclude') ? apiObj.materialCodeFilterExclude : false;  // Add material code filter exclude parameter

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
    fiscalYear +
    (materialCodeFilter ? ", @materialCodeFilter = '" + materialCodeFilter + "'" : "") +
    ", @materialCodeFilterExclude = " +
    (materialCodeFilterExclude ? "1" : "0");

  var ds = X.GETSQLDATASET(qry, null);

  const endT = new Date().getTime();
  const d = (endT - startT) / 1000;

  var j = ds.JSON;
  //replace null with empty string
  j = j.replace(/"null"/g, '""');
  var obj = JSON.parse(j);
  obj.duration = d;
  return obj;
}
