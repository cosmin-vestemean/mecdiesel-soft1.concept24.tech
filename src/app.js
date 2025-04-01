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
        setConditionForNecesar: data.setConditionForNecesar || true,
        setConditionForLimits: data.setConditionForLimits || true, // Forward setConditionForLimits
        fiscalYear: data.fiscalYear || new Date().getFullYear(),
        company: data.company
      },
      json: true,
      gzip: true,
    });
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
