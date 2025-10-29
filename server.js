// server.js
const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');

// Helper: timeout-capable fetch
async function fetchWithTimeout(url, timeoutSec) {
  const ac = new AbortController();
  const id = setTimeout(() => ac.abort(), Math.max(1, timeoutSec) * 1000);
  try {
    const res = await fetch(url, { signal: ac.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
}

const manifest = {
  id: 'com.example.debrid-health',
  version: '1.0.0',
  name: 'Debrid Health Check',
  description: 'Returns dummy streams indicating debrid API health.',
  resources: ['stream'],
  types: ['movie', 'series'],
  catalogs: [],
  idPrefixes: ['tt'],
  behaviorHints: { configurable: true, configurationRequired: false },
  // Built-in config holds JSON so users can add/remove multiple checks
  config: [
    {
      key: 'services',
      title: 'Services JSON',
      type: 'text',
      required: false,
      // Default: one AllDebrid check, 5s timeout, show success only
      default: JSON.stringify(
        [
          {
            type: 'alldebrid',
            pingUrl: 'https://api.alldebrid.com/v4/ping',
            timeout: 5,
            enabled: true,
            showSuccess: true,
            showError: false
          }
        ],
        null,
        2
      )
    }
  ]
};

const builder = new addonBuilder(manifest);

builder.defineStreamHandler(async (args) => {
  // Parse user config
  let services = [];
  try {
    const raw = (args.config && args.config.services) || '';
    services = Array.isArray(raw) ? raw : JSON.parse(raw || '[]');
  } catch (_) {
    services = [];
  }

  // If no config provided, use the manifest default
  if (!services.length) {
    services = [
      {
        type: 'alldebrid',
        pingUrl: 'https://api.alldebrid.com/v4/ping',
        timeout: 5,
        enabled: true,
        showSuccess: true,
        showError: false
      }
    ];
  }

  const streams = [];
  for (const svc of services) {
    const {
      type = 'alldebrid',
      pingUrl = type === 'alldebrid'
        ? 'https://api.alldebrid.com/v4/ping'
        : '',
      timeout = 5,
      enabled = true,
      showSuccess = true,
      showError = false
    } = svc || {};

    if (!enabled || !pingUrl) continue;

    let ok = false;
    let statusText = '';
    let ms = 0;
    const t0 = Date.now();
    try {
      const res = await fetchWithTimeout(pingUrl, timeout);
      ms = Date.now() - t0;
      // Consider 2xx as up; for AllDebrid, also accept { status: "success" }
      ok = res.ok;
      try {
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
          const j = await res.clone().json();
          if (j && (j.status === 'success' || j.data?.ping === 'pong')) ok = true;
        }
      } catch (_) {}
      statusText = `${res.status} ${res.statusText || ''}`.trim();
    } catch (e) {
      statusText = e && e.name === 'AbortError' ? 'timeout' : 'network error';
      ok = false;
      ms = Date.now() - t0;
    }

    if (ok && showSuccess) {
      streams.push({
        title: `OK • ${type} • ${ms}ms`,
        description: `Healthy (${statusText})`,
        url: `https://example.invalid/health/${encodeURIComponent(type)}/ok`
      });
    } else if (!ok && showError) {
      streams.push({
        title: `DOWN • ${type} • ${ms}ms`,
        description: `Unreachable (${statusText})`,
        url: `https://example.invalid/health/${encodeURIComponent(type)}/down`
      });
    }
  }

  return { streams };
});

serveHTTP(builder.getInterface(), { port: process.env.PORT || 7000 });
