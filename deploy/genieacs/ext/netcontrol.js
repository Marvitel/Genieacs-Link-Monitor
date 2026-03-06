const http = require("http");

const NETCONTROL_URL = process.env.NETCONTROL_URL || "http://flashman.marvitel.com.br:3000";
const NETCONTROL_TOKEN = process.env.NETCONTROL_TOKEN || process.env.SESSION_SECRET || "netcontrol-ext-token";

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(null);
        }
      });
    });
    req.on("error", reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error("timeout")); });
  });
}

exports.getConfig = function(args, callback) {
  const serialNumber = args[0];
  if (!serialNumber) return callback(null, null);

  const url = `${NETCONTROL_URL}/api/genieacs/device-config/${encodeURIComponent(serialNumber)}?token=${encodeURIComponent(NETCONTROL_TOKEN)}`;

  httpGet(url)
    .then((data) => {
      if (!data || !data.config) return callback(null, null);
      callback(null, JSON.stringify(data.config));
    })
    .catch(() => {
      callback(null, null);
    });
};
