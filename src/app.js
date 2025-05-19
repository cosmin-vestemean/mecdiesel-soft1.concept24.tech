// For more information about this file see https://dove.feathersjs.com/guides/cli/application.html
/*
site_product_changes_history (CRUD); is_processed -> 0 exista CRUD
site_product_frequent_changes (stoc) -> is_processed -> 0 <=> modificare available total stock (nu mai este pe stoc sau a intrat iarasi pe stoc)

is_processed -> 0 always 0, 1, 2 este intern
*/
import { feathers } from "@feathersjs/feathers";
import configuration from "@feathersjs/configuration";
import {
  koa,
  rest,
  bodyParser,
  errorHandler,
  parseAuthentication,
  cors,
  serveStatic,
} from "@feathersjs/koa";
import socketio from "@feathersjs/socketio";

import { configurationValidator } from "./configuration.js";
import { logError } from "./hooks/log-error.js";
import { mssql } from "./mssql.js";

import { services } from "./services/index.js";
import { channels } from "./channels.js";

//request-promise
import rp from "request-promise";

//create request-promise service
const request = rp.defaults({
  baseUrl: "https://mecdiesel.oncloud.gr/s1services",
  json: true,
});

//create a new custom service to connect to the external API through request-promise
class s1Service {
  constructor(options) {
    // options must contain the knexClient
    // (simply pass it when initializing the service)
    this.options = options || {};
  }

  async ping(data, params) {
    return request("?ping");
  }

  async login(data, params) {
    return request({
      method: "POST",
      uri: "/",
      body: {
        service: "login",
        username: "mecws",
        password: "@28t$F",
        appId: "2002",
      },
      json: true,
      gzip: true,
    });
  }

  async authenticate(data, params) {
    return request({
      method: "POST",
      uri: "/",
      body: data,
      json: true,
      gzip: true,
    });
  }

  async getMappings(data, params) {
    return request({
      method: "POST",
      uri: "/",
      body: {
        service: "sqlData",
        clientID: data.token,
        skip_rows: data.skip_rows,
        fetch_next_rows: data.fetch_next_rows,
        appId: "2002",
        SqlName: "CDB_getMappings",
      },
      json: true,
      gzip: true,
    });
  }

  async getErrors(data, params) {
    return request({
      method: "POST",
      uri: "/",
      body: {
        service: "sqlData",
        clientID: data.token,
        skip_rows: data.skip_rows,
        fetch_next_rows: data.fetch_next_rows,
        appId: "2002",
        SqlName: "CDB_getErrors",
      },
      json: true,
      gzip: true,
    });
  }

  async getMesagerieConvAuto(data, params) {
    return request({
      method: "POST",
      uri: "/",
      body: {
        service: "sqlData",
        clientID: data.token,
        skip_rows: data.skip_rows,
        fetch_next_rows: data.fetch_next_rows,
        appId: "2002",
        SqlName: "CDB_mesagerieConvAuto",
      },
      json: true,
      gzip: true,
    });
  }

  async getSchimbareStoc(data, params) {
    return request({
      method: "POST",
      uri: "/",
      body: {
        service: "sqlData",
        clientID: data.token,
        skip_rows: data.skip_rows,
        fetch_next_rows: data.fetch_next_rows,
        appId: "2002",
        SqlName: "CDB_SchimbareStoc",
        stoc: data.stoc,
        mec_code: data.mec_code,
      },
      json: true,
      gzip: true,
    }).then((res) => {
      console.log(data, res);
      return res;
    }).catch((err) => {
      console.error("Error in getSchimbareStoc:", err);
      throw err;
    });
  }

  async makeBatchRequest(data, params) {
    return request({
      method: "POST",
      uri: "/JS/SyncItaly/processListOfCodes",
      body: {
        clientID: data.token,
        appId: "2002",
        codes: data.codes,
      },
      json: true,
      gzip: true,
    });
  }

  //processListOfStocks
  async processListOfStocks(data, params) {
    return request({
      method: "POST",
      uri: "/JS/StockAvailChange/processListOfStocks",
      body: {
        clientID: data.token,
        appId: "2002",
        codes: data.codes,
      },
      json: true,
      gzip: true,
    });
  }

  async getAllSoSourceObjectsRo(data, params) {
    return request({
      method: "POST",
      uri: "/JS/sosource/getAllSoSourceObjectsRo",
      body: {
        clientID: data.token,
        appId: "2002",
      },
      json: true,
      gzip: true,
    });
  }

  async getAllFprmsForSoSource(data, params) {
    return request({
      method: "POST",
      uri: "/JS/sosource/getAllFprmsForSoSource",
      body: {
        clientID: data.token,
        appId: "2002",
        sosource: data.sosource,
      },
      json: true,
      gzip: true,
    });
  }

  async getAllSeriesForFprms(data, params) {
    return request({
      method: "POST",
      uri: "/JS/sosource/getAllSeriesForFprms",
      body: {
        clientID: data.token,
        appId: "2002",
        sosource: data.sosource,
        fprms: data.fprms,
      },
      json: true,
      gzip: true,
    });
  }

  async getPrintTemplates(data, params) {
    return request({
      method: "POST",
      uri: "/JS/sosource/getPrintTemplates",
      body: {
        clientID: data.token,
        appId: "2002",
        sosource: data.sosource,
        fprms: data.fprms,
        series: data.series,
      },
      json: true,
      gzip: true,
    });
  }

  async getAllPrintTemplatesForSoSource(data, params) {
    return request({
      method: "POST",
      uri: "/JS/sosource/getAllPrintTemplatesForSoSource",
      body: {
        clientID: data.token,
        appId: "2002",
        sosource: data.sosource,
      },
      json: true,
      gzip: true,
    });
  }

  async getSqlDataset(data, params) {
    return request({
      method: "POST",
      uri: "/JS/Utile/getSqlDataset",
      body: {
        clientID: data.token,
        appId: "2002",
        SQL: data.SQL,
      },
      json: true,
      gzip: true,
    });
  }

  async getAnalyticsForBranchReplenishment(data, params) {
    return request({
      method: "POST",
      uri: "/JS/ReumplereSucursale/getAnalytics",
      body: {
        clientID: data.token,
        appId: "2002",
        branchesEmit: data.branchesEmit,
        branchesDest: data.branchesDest,
        setConditionForNecesar: data.setConditionForNecesar !== undefined ? data.setConditionForNecesar : true,
        setConditionForLimits: data.setConditionForLimits !== undefined ? data.setConditionForLimits : true,
        fiscalYear: data.fiscalYear || new Date().getFullYear(),
        company: data.company
      },
      json: true,
      gzip: true,
    });
  }

  async getRegisteredUsers(data, params) {
    let loginResponse;
    try {
      loginResponse = await request({
        method: "POST",
        uri: "/",
        body: {
          service: "login",
          username: "mecws",
          password: "@28t$F",
          appId: "2002",
        },
        json: true,
        gzip: true,
      });
    } catch (loginError) {
      console.error("Internal login failed within getRegisteredUsers:", loginError);
      return { success: false, error: "Internal server error: Could not authenticate to fetch users." };
    }

    if (loginResponse.success) {
      const users = loginResponse.objs;
      console.log("Registered users fetched successfully.");
      return {
        success: true,
        users: users,
        appId: loginResponse.appId,
        clientID: loginResponse.clientID,
        version: loginResponse.ver,
        sn: loginResponse.sn
      };
    } else {
      console.error("Internal login failed within getRegisteredUsers, API response:", loginResponse.error);
      return { success: false, error: `Failed to fetch users: ${loginResponse.error || 'Authentication failed'}` };
    }
  }

  async validateUserPwd(data, params) {
    console.log('validateUserPwd received data:', data);
    const { sessionToken, clientID, password } = data; // clientID is the selected REFID

    if (!sessionToken || !clientID || password === undefined) {
      return { success: false, error: "Missing session token, clientID, or password for validation." };
    }

    let authResult;
    try {
      // Step 1: Authenticate the session using the sessionToken and the selected REFID, company, branch
      const authPayload = {
        service: 'authenticate',
        clientID: sessionToken,  // The token establishing the session
        appID: "2002",           // App ID
        COMPANY: "1000",         // Explicitly set Company
        BRANCH: "2200",          // Explicitly set Branch (Bucuresti)
        MODULE: 0,               // Default module
        REFID: clientID          // The user ID (REFID) being logged into
      };
      console.log(`Attempting authentication with explicit Company/Branch payload:`, authPayload);
      authResult = await this.authenticate(authPayload);
      console.log("Authentication result:", authResult);

      if (!authResult || !authResult.success) {
        // Use the specific error from the auth result if available
        return { success: false, error: `Authentication failed: ${authResult.error || 'Unknown reason'}` };
      }

    } catch (authError) {
      console.error("Error during authentication step:", authError);
      return { success: false, error: "Server error during authentication step." };
    }

    // Step 2: Proceed with password validation using the (potentially refreshed) clientID from authResult
    try {
      console.log(`Proceeding to password validation for refid: ${clientID} using authenticated clientID: ${authResult.clientID}`);
      const validationResponse = await request({ // Use the base 'request' object
        method: "POST",
        uri: "/JS/login/usrPwdValidate", // The specific validation endpoint
        body: {
          clientID: authResult.clientID, // Use the clientID from the successful auth step
          module: 0,                 // Default module
          refid: clientID,           // The user ID (REFID) being validated
          password: password         // The password to validate
        },
        json: true,
        gzip: true,
      });

      console.log("Password validation response:", validationResponse);

      // IMPORTANT: Return the potentially refreshed clientID from the auth step
      // along with the validation result.
      // Assuming validationResponse contains its own 'success' and 'error' fields.
      return {
        ...validationResponse, // Spread the original validation response
        success: validationResponse.success, // Explicitly ensure success field is from validationResponse
        clientID: authResult.clientID // Override clientID with the one from the auth step
      };

    } catch (validationError) {
      console.error("Error during password validation step:", validationError);
      // Attempt to return a meaningful error if possible from the validation step's error
      const errorMsg = validationError.error?.message || validationError.message || "Server error during password validation.";
      // Return failure, but DO NOT return the clientID from the auth step if validation failed.
      return { success: false, error: errorMsg };
    }
  }
}

//create a new custom service to connect to the external API

const app = koa(feathers());

// Load our app configuration (see config/ folder)
app.configure(configuration(configurationValidator));

// Set up Koa middleware
app.use(cors());
app.use(serveStatic(app.get("public")));
app.use(errorHandler());
app.use(parseAuthentication());
app.use(bodyParser());

// Set up newly created custom service
app.use("/s1", new s1Service(), {
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
    "getAnalyticsForBranchReplenishment",
    "getRegisteredUsers",
    "validateUserPwd",
  ],
});

// TopABC service for ABC Analysis and Branch Replenishment
class NecesarAchizitii {
  constructor(options) {
    this.options = options || {};
  }

  async getArticoleCfFiltre(data, params) {
    try {
      return await request({
        method: "POST",
        uri: "/JS/NecesarAchizitie/adaugaArticoleCfFiltre",
        body: {
          clientID: data.token,
          filterColumnName: data.filterColumnName || "CODE",
          doarStocZero: typeof data.doarStocZero === "boolean" ? data.doarStocZero : false,
          doarDeblocate: typeof data.doarDeblocate === "boolean" ? data.doarDeblocate : false,
          valTxt: data.valTxt || "",
          signTxt: data.signTxt || 1,
          sucursalaSqlInCondition: data.sucursalaSqlInCondition || "",
          selectedSuppliersSqlClause: data.selectedSuppliersSqlClause || "",
        },
        json: true,
        gzip: true
      });
    } catch (error) {
      console.error('Error in getArticoleCfFiltre:', error);
      throw new Error(`Failed to get articles: ${error.message}`);
    }
  }

  async getCalculatedNeeds(data, params) {
    try {

      return await request({
        method: "POST",
        uri: "/JS/NecesarAchizitie/adaugaArticole",
        body: data,
        json: true,
        gzip: true
      });
    } catch (error) {
      console.error('Error in getCalculatedNeeds:', error);
      throw new Error(`Failed to get calculated needs: ${error.message}`);
    }
  }

  async getSingleItemNeeds(data, params) {
    try {
      return await request({
        method: "POST",
        uri: "/JS/NecesarAchizitie/getSingleItemNeeds",
        body: {
          clientID: data.token,
          mtrlId: data.mtrlId
        },
        json: true,
        gzip: true
      });
    } catch (error) {
      console.error('Error in getSingleItemNeeds:', error);
      throw new Error(`Failed to get single item needs: ${error.message}`);
    }
  }

  async test_getArticoleCfFiltre(data, params) {
    try {
      let r = await request({
        method: "POST",
        uri: "/JS/NecesarAchizitie/test_getArticoleCfFiltre",
        json: true,
        gzip: true
      });
      console.log("test_getArticoleCfFiltre response:", r);
    } catch (error) {
      console.error('Error in test_getArticoleCfFiltre:', error);
      throw new Error(`Failed to get articles for test: ${error.message}`);
    }
  }

  async test_getCalculatedNeeds(data, params) {
    try {
      let r = await request({
        method: "POST",
        uri: "/JS/NecesarAchizitie/test_getCalculatedNeeds",
        json: true,
        gzip: true
      });
      console.log("test_getCalculatedNeeds response:", r);
    } catch (error) {
      console.error('Error in test_getCalculatedNeeds:', error);
      throw new Error(`Failed to get calculated needs for test: ${error.message}`);
    }
  }

  async getSuppliers(data, params) {
    try {
      return await request({
        method: "POST",
        uri: "/JS/NecesarAchizitie/getSuppliers",
        body: {
          clientID: data.token
        },
        json: true,
        gzip: true
      });
    } catch (error) {
      console.error('Error in getSuppliers:', error);
      throw new Error(`Failed to get suppliers: ${error.message}`);
    }
  }

  async getSalesHistory(data, params) {
    try {
      return await request({
        method: "POST",
        uri: "/JS/NecesarAchizitie/getSalesHistory",
        body: {
          clientID: data.token,
          mtrl: data.mtrl,
          lastNMonths: data.lastNMonths || 12,
          sucursalaSqlInCondition: data.sucursalaSqlInCondition || ""
        },
        json: true,
        gzip: true
      });
    } catch (error) {
      console.error('Error in getSalesHistory:', error);
      throw new Error(`Failed to get sales history: ${error.message}`);
    }
  }
}

// Register the NecesarAchizitii service
app.use("/necesar-achizitii", new NecesarAchizitii(), {
  methods: [
    "getArticoleCfFiltre",
    "getCalculatedNeeds",
    "getSingleItemNeeds",
    "test_getArticoleCfFiltre",
    "test_getCalculatedNeeds",
    "getSuppliers",
    "getSalesHistory"
  ],
});

// TOP ABC Analysis service for sales analysis and ABC classification
class TopAbcAnalysis {
  constructor(options) {
    this.options = options || {};
  }

  async getTopAbcAnalysis(data, params) {
    try {
      let messages = [];
      //validate data
      if (!data.token || !data.dataReferinta) {
        messages.push("Missing required parameters: token and dataReferinta");
      }

      if (messages.length > 0) {
        return {
          success: false,
          messages: messages,
        };
      }
      // Call the external API to get the top ABC analysis
      return await request({
        method: "POST",
        uri: "/JS/TopAbcAnalysis/getTopAbcAnalysis",
        body: {
          clientID: data.token,
          dataReferinta: data.dataReferinta,
          nrSaptamani: data.nrSaptamani || 52,
          seriesL: data.seriesL,
          branch: data.branch,
          agent: data.agent,
          supplier: data.supplier,
          mtrl: data.mtrl,
          cod: data.cod || "",
          searchType: data.searchType || 1, // 1-starts with, 2-contains, 3-ends with
          modFiltrareBranch: data.modFiltrareBranch || "AGENT",
          thresholdA: data.thresholdA || 80, // Default ABC threshold A (80%)
          thresholdB: data.thresholdB || 15, // Default ABC threshold B (15%)
        },
        json: true,
        gzip: true
      });
    } catch (error) {
      messages.push("Error in getTopAbcAnalysis: " + error.message);
    }
  }
}

// Register the TopAbcAnalysis service
app.use("/top-abc", new TopAbcAnalysis(), {
  methods: [
    "getTopAbcAnalysis"
  ],
});

// Configure services and transports
app.configure(
  rest(
    cors({
      origin: app.get("origins"),
    })
  )
);
app.configure(
  socketio({
    cors: {
      origin: app.get("origins"),
    },
  })
);
app.configure(channels);
app.configure(mssql);

app.configure(services);

// Register hooks that run on all service methods
app.hooks({
  around: {
    all: [logError],
  },
  before: {},
  after: {},
  error: {},
});
// Register application setup and teardown hooks here
app.hooks({
  setup: [],
  teardown: [],
});

export { app };
