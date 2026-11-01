export const DITTO_CONFIG = {
  databaseId: "965957f9-6fd7-4d2f-8794-d8f1544c5724",
  serverUrl: "https://i83inp.cloud.dittolive.app",
  cloudEndpoint: "i83inp.cloud.dittolive.app/965957f9-6fd7-4d2f-8794-d8f1544c5724",
  dqlExecuteUrl: "https://i83inp.cloud.dittolive.app/api/v4/store/execute",
  sqlBridgeUrl: "http://localhost:3001",
};

export const isDittoConfigured = Boolean(DITTO_CONFIG.databaseId && DITTO_CONFIG.serverUrl);
