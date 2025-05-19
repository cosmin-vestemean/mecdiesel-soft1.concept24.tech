const socket = io();
const client = feathers();
const socketClient = feathers.socketio(socket);

// Configure socket.io client services
client.configure(socketClient);

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
    "getAnalyticsForBranchReplenishment",
    "getRegisteredUsers", // Keep registered method
    "validateUserPwd", // Keep registered method
  ],
});

client.use("necesar-achizitii", socketClient.service("necesar-achizitii"), {
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

client.use("top-abc", socketClient.service("top-abc"), {
  methods: [
    "getTopAbcAnalysis",
  ],
});

export { client };