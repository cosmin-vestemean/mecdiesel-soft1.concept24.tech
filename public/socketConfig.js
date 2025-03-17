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
    ],
  });

export { client };