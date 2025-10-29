const { addonBuilder, serveHTTP, getRouter } = require('stremio-addon-sdk');
const https = require('https');
const http = require('http');
const express = require('express');

const DEFAULT_SERVICES = {
  alldebrid: {
    name: 'AllDebrid',
    pingUrl: 'https://api.alldebrid.com/v4/ping'
  },
  realdebrid: {
    name: 'Real-Debrid',
    pingUrl: 'https://api.real-debrid.com/rest/1.0/time'
  }
};

const manifest = {
  id: 'com.debrid.healthcheck',
  version: '2.0.1',
  name: 'Debrid Health Check',
  description: 'Check AllDebrid and RealDebrid availability',
  resources: ['stream'],
  types: ['movie', 'series'],
  idPrefixes: ['tt'],
  catalogs: []
};

const builder = new addonBuilder(manifest);

async function checkServiceHealth(service) {
  return new Promise((resolve) => {
    const url = new URL(service.pingUrl);
    const client = url.protocol === 'https:' ? https : http;

    const req = client.get(service.pingUrl, (res) => {
      resolve({ healthy: res.statusCode === 200 });
    });

    req.on('error', () => resolve({ healthy: false }));
    req.setTimeout(service.timeout || 5000, () => {
      req.destroy();
      resolve({ healthy: false });
    });
  });
}

builder.defineStreamHandler(async (args) => {
  const query = args.config || {};
  let services = [];

  try {
    services = query.services ? JSON.parse(query.services) : Object.keys(DEFAULT_SERVICES).map(id => ({
      id,
      enabled: true,
      pingUrl: DEFAULT_SERVICES[id].pingUrl,
      showSuccess: true,
      showError: true,
      timeout: 5000
    }));
  } catch (e) {
    services = [];
  }

  const streams = [];

  for (const service of services) {
    if (!service.enabled) continue;
    const result = await checkServiceHealth(service);

    const svcName = DEFAULT_SERVICES[service.id]?.name || service.id;
    if (result.healthy && service.showSuccess) {
      streams.push({
        name: `✅ ${svcName}`,
        title: `${svcName} is UP`,
        url: service.pingUrl
      });
    } else if (!result.healthy && service.showError) {
      streams.push({
        name: `❌ ${svcName}`,
        title: `${svcName} is DOWN`,
        url: service.pingUrl
      });
    }
  }

  return Promise.resolve({ streams });
});

// Express to mix routes safely
const app = express();

// Serve configuration page (HTML)
app.get('/configure', (req, res) => {
  res.sendFile(__dirname + '/landing.html');
});

// Serve addon interface (JSON routes)
const addonInterface = builder.getInterface();
app.use('/', getRouter(addonInterface));

const port = process.env.PORT || 7000;
app.listen(port, () => {
  console.log(`✅ Debrid Health Check Addon running on port ${port}`);
});
