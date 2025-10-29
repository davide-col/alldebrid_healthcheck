// server.js
const http = require('http');
const { addonBuilder } = require('stremio-addon-sdk');
const manifest = {
  id: 'com.example.debrid-health',
  version: '1.0.0',
  name: 'Debrid Health Check',
  description: 'Returns dummy streams indicating debrid API health.',
  resources: ['stream'],
  types: ['movie','series'],
  catalogs: [],
  idPrefixes: ['tt'],
  behaviorHints: { configurable: true, configurationRequired: false },
  config: [
    { key: 'services', title: 'Services JSON', type: 'text', required: false,
      default: '[]' }
  ]
}
const builder = new addonBuilder(manifest);

// Your existing stream handler here…

const addonInterface = builder.getInterface();

const CONFIG_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Configure Debrid Health Check</title>
<style>
  :root { color-scheme: dark; --bg:#0f1117; --panel:#1a1f2e; --muted:#a2a9b0; --accent:#8b5cf6; --ok:#22c55e; --err:#ef4444; }
  body { margin:0; font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto; background:radial-gradient(1200px 600px at 80% -10%, #2a2245 0%, transparent 55%), var(--bg); color:#e6e9ed;}
  .wrap { max-width:980px; margin:40px auto; padding:0 16px;}
  .hero { padding:28px 24px; background:linear-gradient(135deg,#2b2f44, #1a1f2e); border:1px solid #2b3553; border-radius:14px; box-shadow:0 12px 32px rgba(0,0,0,.35);}
  .hero h1{ margin:0 0 10px; font-size:28px;}
  .hero p{ margin:0; color:var(--muted);}
  .grid{ display:grid; gap:18px; margin-top:22px;}
  .card{ background:var(--panel); border:1px solid #2b3553; border-radius:14px; padding:18px;}
  .row{ display:grid; grid-template-columns: 160px 1fr; gap:12px; align-items:center; margin:10px 0;}
  label{ color:#cfd6dd; font-size:14px;}
  input[type="text"], input[type="number"], select {
    width:100%; background:#0f1320; color:#e6e9ed; border:1px solid #2b3553; border-radius:10px; padding:10px 12px; outline:none;
  }
  input[type="checkbox"] { transform:scale(1.1); }
  .svc{ position:relative; }
  .svc h3{ margin:0 0 8px; font-size:16px; }
  .del{ position:absolute; top:10px; right:10px; background:#191f2e; border:1px solid #333d63; color:#d1d5db; padding:6px 9px; border-radius:8px; cursor:pointer;}
  .del:hover{ background:#2a3358;}
  .btns{ display:flex; gap:12px; flex-wrap:wrap; margin-top:8px;}
  .btn{ background:var(--accent); color:#fff; border:none; padding:11px 16px; border-radius:10px; cursor:pointer; }
  .btn.alt{ background:#243049; }
  .hint{ color:var(--muted); font-size:13px; }
  .ok{ color:var(--ok); } .err{ color:var(--err); }
  .footer{ margin-top:18px; display:grid; gap:10px;}
  .mono{ font-family:ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
</style>
</head>
<body>
  <div class="wrap">
    <div class="hero">
      <h1>Configure Debrid Health Check</h1>
      <p>Add debrid services, tune timeouts, and generate the install URL.</p>
    </div>

    <div class="grid" id="services"></div>

    <div class="btns">
      <button class="btn" id="add">+ Add Service</button>
      <button class="btn alt" id="gen">Generate Install URL</button>
    </div>

    <div class="card footer">
      <div class="hint">Copy this URL into Stremio Add‑ons → “Add via URL”.</div>
      <input id="installUrl" class="mono" type="text" placeholder="Install URL will appear here" />
      <div class="hint">Or paste the JSON below into the built‑in “Services JSON” field.</div>
      <textarea id="jsonOut" class="mono" rows="6" style="width:100%; background:#0f1320; color:#e6e9ed; border:1px solid #2b3553; border-radius:10px; padding:12px;"></textarea>
    </div>
  </div>

<script>
const servicesEl = document.getElementById('services');
const addBtn = document.getElementById('add');
const genBtn = document.getElementById('gen');
const jsonOut = document.getElementById('jsonOut');
const installUrl = document.getElementById('installUrl');

const defaults = () => ({
  type: 'alldebrid',
  pingUrl: 'https://api.alldebrid.com/v4/ping',
  timeout: 5,
  enabled: true,
  showSuccess: true,
  showError: false
});

const state = [];
function render(){
  servicesEl.innerHTML='';
  state.forEach((svc, idx)=>{
    const div = document.createElement('div');
    div.className='card svc';
    div.innerHTML = \`
      <h3>Service #\${idx+1}</h3>
      <button class="del" data-i="\${idx}">✕</button>
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
      </div>\`;
    div.querySelectorAll('[data-k]').forEach(el=>{
      el.oninput = el.onchange = ()=>{
        const k = el.getAttribute('data-k');
        let v = el.type==='checkbox' ? el.checked : el.value;
        if(k==='timeout') v = Math.max(1, parseInt(v||'5',10));
        state[idx][k] = v;
      }
    });
    div.querySelector('.del').onclick = ()=>{ state.splice(idx,1); render(); };
    servicesEl.appendChild(div);
  });
  if(!state.length){ state.push(defaults()); render(); }
}
addBtn.onclick = ()=>{ state.push(defaults()); render(); };

function b64url(s){
  return btoa(unescape(encodeURIComponent(s))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
genBtn.onclick = ()=>{
  const json = JSON.stringify(state, null, 2);
  jsonOut.value = json;
  const base = location.origin + '/manifest.json';
  const url = base + '?cfg=' + b64url(json);
  installUrl.value = url;
}
render();
</script>
</body></html>`;
const server = http.createServer((req, res) => {
  if (req.url === '/configure') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(CONFIG_HTML);
    return;
  }
  // hand over to the SDK interface (serves manifest.json and resources)
  addonInterface(req, res);
});
server.listen(process.env.PORT || 7000);
