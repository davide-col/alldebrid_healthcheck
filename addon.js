// addon.js
// Debrid Health Check — Stremio add-on with sleek /configure UI

const http = require('http');
const { addonBuilder, getRouter } = require('stremio-addon-sdk');

// ---- helpers ----
async function fetchWithTimeout(url, timeoutSec) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), Math.max(1, timeoutSec) * 1000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
}

// ---- manifest ----
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
  config: [
    {
      key: 'services',
      title: 'Services JSON',
      type: 'text',
      required: false,
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

// ---- stream handler ----
builder.defineStreamHandler(async (args) => {
  let services = [];
  try {
    const raw = (args.config && args.config.services) || '';
    services = Array.isArray(raw) ? raw : JSON.parse(raw || '[]');
  } catch {
    services = [];
  }
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
      ok = res.ok;
      try {
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
          const j = await res.clone().json();
          if (j && (j.status === 'success' || j.data?.ping === 'pong')) ok = true;
        }
      } catch {}
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

// ---- pretty /configure UI ----
const CONFIG_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Configure Debrid Health Check</title>
<style>
  :root{ color-scheme:dark; --bg:#0e1117; --panel:#151a28; --muted:#9aa4af; --accent:#8b5cf6; --line:#24304a; }
  body{margin:0;font-family:Inter,ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto;background:
    radial-gradient(1000px 600px at 80% -10%, #2a2350 0%, transparent 60%), var(--bg); color:#e7ebf0}
  .wrap{max-width:980px;margin:40px auto;padding:0 16px}
  .hero{background:linear-gradient(135deg,#22273a,#171c2b);border:1px solid var(--line);border-radius:16px;padding:28px 24px;box-shadow:0 14px 40px rgba(0,0,0,.35)}
  .hero h1{margin:0 0 8px;font-size:28px}
  .hero p{margin:0;color:var(--muted)}
  .grid{display:grid;gap:18px;margin-top:22px}
  .card{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:18px}
  .svc{position:relative}
  .svc h3{margin:0 0 8px;font-size:16px}
  .row{display:grid;grid-template-columns:170px 1fr;gap:12px;align-items:center;margin:10px 0}
  label{color:#d7dde4;font-size:14px}
  input[type="text"],input[type="number"],select,textarea{
    width:100%;background:#0e1424;color:#e7ebf0;border:1px solid var(--line);border-radius:10px;padding:10px 12px;outline:none
  }
  input[type="checkbox"]{transform:scale(1.1)}
  .del{position:absolute;top:10px;right:10px;background:#10182a;border:1px solid var(--line);color:#d1d5db;padding:6px 9px;border-radius:8px;cursor:pointer}
  .del:hover{background:#1b2440}
  .btns{display:flex;gap:12px;flex-wrap:wrap;margin-top:10px}
  .btn{background:var(--accent);color:#fff;border:none;padding:11px 16px;border-radius:10px;cursor:pointer}
  .btn.alt{background:#25324a}
  .hint{color:var(--muted);font-size:13px}
  .footer{margin-top:18px;display:grid;gap:10px}
  .mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
</style>
</head>
<body>
  <div class="wrap">
    <div class="hero">
      <h1>Configure Debrid Health Check</h1>
      <p>Add debrid services, tweak timeouts, and generate JSON for Stremio settings.</p>
    </div>

    <div id="services" class="grid"></div>

    <div class="btns">
      <button id="add" class="btn">+ Add Service</button>
      <button id="gen" class="btn alt">Generate JSON</button>
    </div>

    <div class="card footer">
      <div class="hint">Paste this JSON into the add-on’s “Services JSON” field in Stremio.</div>
      <textarea id="jsonOut" class="mono" rows="7" placeholder="[]"></textarea>
    </div>
  </div>

<script>
const servicesEl = document.getElementById('services');
const addBtn = document.getElementById('add');
const genBtn = document.getElementById('gen');
const jsonOut = document.getElementById('jsonOut');

const defaults = () => ({
  type: 'alldebrid',
  pingUrl: 'https://api.alldebrid.com/v4/ping',
  timeout: 5,
  enabled: true,
  showSuccess: true,
  showError: false
});
const state = [];

function render() {
  servicesEl.innerHTML = '';
  state.forEach((svc, i) => {
    const el = document.createElement('div');
    el.className = 'card svc';
    el.innerHTML = \`
      <h3>Service #\${i+1}</h3>
      <button class="del">✕</button>
      <div class="row"><label>Service Type</label>
        <select data-k="type">
          <option value="alldebrid"\${svc.type==='alldebrid'?' selected':''}>AllDebrid</option>
          <option value="real-debrid"\${svc.type==='real-debrid'?' selected':''}>Real‑Debrid</option>
        </select>
      </div>
      <div class="row"><label>Ping URL</label>
        <input data-k="pingUrl" type="text" value="\${svc.pingUrl}">
      </div>
      <div class="row"><label>Timeout (s)</label>
        <input data-k="timeout" type="number" min="1" value="\${svc.timeout}">
      </div>
      <div class="row"><label>Enabled</label>
        <input data-k="enabled" type="checkbox"\${svc.enabled?' checked':''}>
      </div>
      <div class="row"><label>Show success</label>
        <input data-k="showSuccess" type="checkbox"\${svc.showSuccess?' checked':''}>
      </div>
      <div class="row"><label>Show error</label>
        <input data-k="showError" type="checkbox"\${svc.showError?' checked':''}>
      </div>
    \`;
    el.querySelector('.del').onclick = () => { state.splice(i,1); render(); };
    el.querySelectorAll('[data-k]').forEach(ctrl => {
      ctrl.oninput = ctrl.onchange = () => {
        const k = ctrl.getAttribute('data-k');
        let v = ctrl.type === 'checkbox' ? ctrl.checked : ctrl.value;
        if (k === 'timeout') v = Math.max(1, parseInt(v || '5', 10));
        state[i][k] = v;
      };
    });
    servicesEl.appendChild(el);
  });
  if (!state.length) { state.push(defaults()); render(); }
}

addBtn.onclick = () => { state.push(defaults()); render(); };
genBtn.onclick = () => { jsonOut.value = JSON.stringify(state, null, 2); };
render();
</script>
</body></html>`;

// ---- HTTP server combining /configure with SDK router ----
const addonInterface = builder.getInterface();
const router = getRouter(addonInterface);

const server = http.createServer((req, res) => {
  if (req.url === '/configure') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(CONFIG_HTML);
    return;
  }
  router(req, res, () => {
    res.statusCode = 404;
    res.end();
  });
});

const PORT = process.env.PORT || 7000;
server.listen(PORT, () => {
  console.log('Debrid Health Check addon listening on :' + PORT);
});
