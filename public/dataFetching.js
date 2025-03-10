import { client } from './socketConfig.js';
import { renderData } from './renderTable.js';
import { shared } from './shared.js';

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
  
  function getMappings(token, next) {
    client
      .service("s1")
      .getMappings({
        token: token,
        skip_rows: shared.skipMappings,
        fetch_next_rows: shared.htmlLimit,
      })
      .then((res) => {
        next(res.rows);
      });
  }
  
  function getErrors(token, next) {
    client
      .service("s1")
      .getErrors({
        token: token,
        skip_rows: shared.skipErr,
        fetch_next_rows: shared.htmlLimit,
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
        skip_rows: shared.skipConvAuto,
        fetch_next_rows: shared.htmlLimit,
      })
      .then((res) => {
        //console.log(res);
        next(res.rows);
      });
  }
  
  function getSchimbareStoc(token, next, mec_code = null) {
    const options = {
      token: token,
      skip_rows: shared.skipStock,
      fetch_next_rows: shared.htmlLimit,
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
  
  function getSqlDataset(token, SQL, next) {
    client
      .service("s1")
      .getSqlDataset({
        token: token,
        SQL: SQL,
      })
      .then((res) => {
        next(res.rows);
      });
  }

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
  
  export {
    getItemsFromService,
    connectToS1,
    getMappings,
    getErrors,
    getMesagerieConvAuto,
    getSchimbareStoc,
    getAllSoSourceObjectsRo,
    getAllFprmsForSoSource,
    getAllSeriesForFprms,
    getPrintTemplates,
    getAllPrintTemplatesForSoSource,
    getSqlDataset,
    getS1Data // Add this export
  };