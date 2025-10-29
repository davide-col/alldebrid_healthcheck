module.exports = function () {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Configure Debrid Health Check</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    *{box-sizing:border-box}
    body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:980px;margin:24px auto;padding:0 16px;background:#14151a;color:#fff}
    .header{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:24px;border-radius:12px;margin-bottom:24px}
    h1{margin:0}
    .card{background:#1e1f26;padding:16px;border-radius:10px;margin:16px 0;border-left:4px solid #7b5bf5}
    label{display:block;margin:10px 0 6px;font-weight:600}
    input,select{width:100%;padding:10px;background:#14151a;border:1px solid #3a3b45;border-radius:6px;color:#fff}
    input[type="checkbox"]{width:auto;margin-right:8px}
    .row{display:flex;gap:12px;flex-wrap:wrap}
    .row > div{flex:1 1 220px}
    .btn{background:#7b5bf5;color:#fff;border:none;padding:10px 18px;border-radius:8px;cursor:pointer;margin:6px 8px 0 0}
    .btn:hover{background:#6b4be0}
    .btn.add{background:#28a745}
    .btn.add:hover{background:#218838}
    .btn.remove{background:#dc3545;float:right}
    .btn.remove:hover{background:#c82333}
    .muted{opacity:.7;font-size:12px;margin-top:6px}
    .out{background:#0d0f15;border:1px solid #2c2f3a;border-radius:8px;padding:12px;font-family:ui-monospace,Menlo,Consolas,monospace;word-break:break-all}
  </style>
</head>
<body>
  <div class="header"><h1>🔧 Configure Debrid Health Check</h1></div>

  <div class="card">
    <strong>How to use:</strong>
    <ol>
      <li>Add debrid services to monitor</li>
      <li>Configure each service</li>
      <li>Generate install URL</li>
      <li>Use with AIOStreams Groups</li>
    </ol>
  </div>

  <h2>Services</h2>
  <div id="services"></div>
  <button class="btn add" onclick="addService()">➕ Add Service</button>
  <button class="btn" onclick="generateManifest()">📦 Generate Install URL</button>

  <div id="result" style="display:none;margin-top:16px" class="card">
    <h3>Install URL</h3>
    <div class="out" id="manifestUrl"></div>
    <button class="btn" onclick="copyUrl()">📋 Copy</button>
    <button class="btn" onclick="installAddon()">🚀 Install</button>
  </div>

<script>
let serviceCount = 0;

function addService() {
  const id = serviceCount++;
  const div = document.createElement('div');
  div.className = 'card';
  div.id = 'service-'+id;
  div.innerHTML = \`
    <button class="btn remove" onclick="removeService(\${id})">✕</button>
    <h3>Service #\${id+1}</h3>

    <label>Service Type</label>
    <select id="type-\${id}" onchange="updateDefaults(\${id})">
      <option value="alldebrid">AllDebrid</option>
      <option value="realdebrid">Real-Debrid</option>
      <option value="custom">Custom</option>
    </select>

    <label>Ping URL</label>
    <input id="url-\${id}" value="https://api.alldebrid.com/v4/ping" />
    <div class="muted">API endpoint to check</div>

    <div class="row">
      <div>
        <label>Timeout (seconds)</label>
        <input type="number" id="timeout-\${id}" value="5" min="1" max="30" />
        <div class="muted">5 seconds recommended</div>
      </div>
    </div>

    <label><input type="checkbox" id="enabled-\${id}" checked /> Enabled</label>
    <label><input type="checkbox" id="success-\${id}" checked /> Show success message</label>
    <label><input type="checkbox" id="error-\${id}" checked /> Show error message</label>
  \`;
  document.getElementById('services').appendChild(div);
}

function removeService(id){ const el = document.getElementById('service-'+id); if (el) el.remove(); }

function updateDefaults(id) {
  const type = document.getElementById('type-'+id).value;
  const url  = document.getElementById('url-'+id);
  if (type === 'alldebrid') url.value = 'https://api.alldebrid.com/v4/ping';
  else if (type === 'realdebrid') url.value = 'https://api.real-debrid.com/rest/1.0/time';
}

function generateManifest() {
  const services = [];
  for (let i = 0; i < serviceCount; i++) {
    if (!document.getElementById('service-'+i)) continue;
    services.push({
      id: document.getElementById('type-'+i).value,
      enabled: document.getElementById('enabled-'+i).checked,
      pingUrl: document.getElementById('url-'+i).value,
      showSuccess: document.getElementById('success-'+i).checked,
      showError: document.getElementById('error-'+i).checked,
      timeout: parseInt(document.getElementById('timeout-'+i).value) * 1000
    });
  }
  const cfg = { services: JSON.stringify(services) };
  const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(cfg))));
  const url = window.location.origin + '/' + encoded + '/manifest.json';
  document.getElementById('manifestUrl').textContent = url;
  document.getElementById('result').style.display = 'block';
}

function copyUrl(){ navigator.clipboard.writeText(document.getElementById('manifestUrl').textContent); alert('Copied!'); }
function installAddon(){ window.location.href = 'stremio://' + document.getElementById('manifestUrl').textContent; }

// Initial block
addService();
</script>
</body>
</html>`
}
