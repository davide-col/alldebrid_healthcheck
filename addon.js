const express = require('express')
const https = require('https')
const http = require('http')

const DEFAULT_SERVICES = {
    alldebrid: {
        name: 'AllDebrid',
        pingUrl: 'https://api.alldebrid.com/v4/ping',
        timeout: 5000
    },
    realdebrid: {
        name: 'Real-Debrid',
        pingUrl: 'https://api.real-debrid.com/rest/1.0/time',
        timeout: 5000
    }
}

const manifest = {
    id: 'com.debrid.healthcheck',
    version: '2.0.0',
    name: 'Debrid Health Check',
    description: 'Check multiple debrid services - configurable',
    resources: ['stream'],
    types: ['movie', 'series'],
    idPrefixes: ['tt'],
    catalogs: []
}

function parseConfig(args) {
    const config = args.config || {}
    
    return {
        services: config.services ? JSON.parse(config.services) : [{
            id: 'alldebrid',
            enabled: true,
            pingUrl: DEFAULT_SERVICES.alldebrid.pingUrl,
            showSuccess: true,
            showError: true,
            timeout: 5000
        }]
    }
}

async function checkServiceHealth(service) {
    return new Promise((resolve) => {
        const url = new URL(service.pingUrl)
        const client = url.protocol === 'https:' ? https : http
        
        const req = client.get(service.pingUrl, (res) => {
            if (res.statusCode === 200) {
                console.log(`[${service.id}] UP`)
                resolve({ healthy: true })
            } else {
                console.log(`[${service.id}] DOWN`)
                resolve({ healthy: false })
            }
        })
        
        req.on('error', () => resolve({ healthy: false }))
        req.setTimeout(service.timeout || 5000, () => {
            req.destroy()
            resolve({ healthy: false })
        })
    })
}

const app = express()

// CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*')
    res.header('Access-Control-Allow-Headers', '*')
    next()
})

// Root redirects to configure (like Torrentio)
app.get('/', (req, res) => {
    res.redirect('/configure')
})

// Configuration page
app.get('/configure', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>Debrid Health Check - Configure</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        * { box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            max-width: 900px;
            margin: 0 auto;
            padding: 20px;
            background: #14151a;
            color: #fff;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 30px;
            border-radius: 10px;
            margin-bottom: 30px;
            text-align: center;
        }
        h1 { color: #fff; margin: 0; }
        .info {
            background: #2a2d3a;
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
        }
        .service {
            background: #1e1f26;
            padding: 20px;
            margin: 15px 0;
            border-radius: 8px;
            border-left: 4px solid #7b5bf5;
        }
        label {
            display: block;
            margin: 10px 0 5px;
            font-weight: 500;
        }
        input, select {
            width: 100%;
            padding: 10px;
            background: #14151a;
            border: 1px solid #3a3b45;
            border-radius: 5px;
            color: #fff;
            font-size: 14px;
        }
        input[type="checkbox"] {
            width: auto;
            margin-right: 8px;
        }
        button {
            background: #7b5bf5;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 5px;
            cursor: pointer;
            margin: 5px;
            font-size: 15px;
        }
        button:hover { background: #6b4be0; }
        .add-btn { background: #28a745; }
        .remove-btn { background: #dc3545; float: right; }
        .manifest-url {
            background: #14151a;
            padding: 15px;
            border-radius: 5px;
            word-break: break-all;
            font-family: monospace;
            font-size: 12px;
        }
        .helper-text {
            font-size: 12px;
            opacity: 0.7;
            margin-top: 3px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🔧 Configure Debrid Health Check</h1>
    </div>
    
    <div class="info">
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
    <button class="add-btn" onclick="addService()">➕ Add Service</button>

    <div style="margin-top: 30px;">
        <button onclick="generateManifest()">📦 Generate Install URL</button>
    </div>
    
    <div id="result" style="display:none; margin-top: 20px;">
        <h3>Install URL:</h3>
        <div class="manifest-url" id="manifestUrl"></div>
        <button onclick="copyUrl()">📋 Copy</button>
        <button onclick="installAddon()">🚀 Install</button>
    </div>

    <script>
        let serviceCount = 0;
        
        function addService() {
            const id = serviceCount++;
            const div = document.createElement('div');
            div.className = 'service';
            div.id = 'service-' + id;
            div.innerHTML = '<button class="remove-btn" onclick="removeService(' + id + ')">✕</button>' +
                '<h3>Service #' + (id + 1) + '</h3>' +
                '<label>Service Type:</label>' +
                '<select id="type-' + id + '" onchange="updateDefaults(' + id + ')">' +
                '<option value="alldebrid">AllDebrid</option>' +
                '<option value="realdebrid">Real-Debrid</option>' +
                '<option value="custom">Custom</option>' +
                '</select>' +
                '<label>Ping URL:</label>' +
                '<input type="text" id="url-' + id + '" value="https://api.alldebrid.com/v4/ping" />' +
                '<div class="helper-text">API endpoint to check</div>' +
                '<label>Timeout (seconds):</label>' +
                '<input type="number" id="timeout-' + id + '" value="5" min="1" max="30" step="1" />' +
                '<div class="helper-text">5 seconds recommended</div>' +
                '<label><input type="checkbox" id="enabled-' + id + '" checked /> Enabled</label>' +
                '<label><input type="checkbox" id="success-' + id + '" checked /> Show success message</label>' +
                '<label><input type="checkbox" id="error-' + id + '" checked /> Show error message</label>';
            document.getElementById('services').appendChild(div);
        }

        function removeService(id) {
            document.getElementById('service-' + id).remove();
        }

        function updateDefaults(id) {
            const type = document.getElementById('type-' + id).value;
            const url = document.getElementById('url-' + id);
            if (type === 'alldebrid') {
                url.value = 'https://api.alldebrid.com/v4/ping';
            } else if (type === 'realdebrid') {
                url.value = 'https://api.real-debrid.com/rest/1.0/time';
            }
        }

        function generateManifest() {
            const services = [];
            for (let i = 0; i < serviceCount; i++) {
                const svc = document.getElementById('service-' + i);
                if (!svc) continue;
                
                const type = document.getElementById('type-' + i).value;
                services.push({
                    id: type === 'custom' ? 'custom-' + i : type,
                    enabled: document.getElementById('enabled-' + i).checked,
                    pingUrl: document.getElementById('url-' + i).value,
                    showSuccess: document.getElementById('success-' + i).checked,
                    showError: document.getElementById('error-' + i).checked,
                    timeout: parseInt(document.getElementById('timeout-' + i).value) * 1000
                });
            }
            
            if (services.length === 0) {
                alert('Add at least one service!');
                return;
            }
            
            const configObj = { services: JSON.stringify(services) };
            const configJson = JSON.stringify(configObj);
            const configBase64 = btoa(unescape(encodeURIComponent(configJson)));
            const baseUrl = window.location.origin;
            const url = baseUrl + '/' + configBase64 + '/manifest.json';
            
            document.getElementById('manifestUrl').textContent = url;
            document.getElementById('result').style.display = 'block';
        }

        function copyUrl() {
            navigator.clipboard.writeText(document.getElementById('manifestUrl').textContent);
            alert('Copied!');
        }

        function installAddon() {
            window.location.href = 'stremio://' + document.getElementById('manifestUrl').textContent;
        }

        addService();
    </script>
</body>
</html>
    `)
})

// Manifest routes
app.get('/manifest.json', (req, res) => {
    res.json(manifest)
})

app.get('/:config/manifest.json', (req, res) => {
    res.json(manifest)
})

// Stream routes
app.get('/stream/:type/:id.json', async (req, res) => {
    try {
        const args = { 
            type: req.params.type, 
            id: req.params.id, 
            config: {} 
        }
        
        const config = parseConfig(args)
        const streams = []
        
        for (const service of config.services) {
            if (!service.enabled) continue
            
            const result = await checkServiceHealth(service)
            
            if (!result.healthy && service.showError) {
                streams.push({
                    name: `⚠️ ${DEFAULT_SERVICES[service.id]?.name || service.id}`,
                    title: `${DEFAULT_SERVICES[service.id]?.name || service.id} is DOWN`,
                    url: service.pingUrl
                })
            } else if (result.healthy && service.showSuccess) {
                streams.push({
                    name: `✓ ${DEFAULT_SERVICES[service.id]?.name || service.id}`,
                    title: `${DEFAULT_SERVICES[service.id]?.name || service.id} is UP`,
                    url: service.pingUrl
                })
            }
        }
        
        res.json({ streams })
    } catch (error) {
        console.error('Stream error:', error)
        res.json({ streams: [] })
    }
})

app.get('/:config/stream/:type/:id.json', async (req, res) => {
    try {
        const configBase64 = req.params.config
        const configJson = Buffer.from(configBase64, 'base64').toString('utf-8')
        const configData = JSON.parse(configJson)
        
        const args = { 
            type: req.params.type, 
            id: req.params.id, 
            config: configData 
        }
        
        const config = parseConfig(args)
        const streams = []
        
        for (const service of config.services) {
            if (!service.enabled) continue
            
            const result = await checkServiceHealth(service)
            
            if (!result.healthy && service.showError) {
                streams.push({
                    name: `⚠️ ${DEFAULT_SERVICES[service.id]?.name || service.id}`,
                    title: `${DEFAULT_SERVICES[service.id]?.name || service.id} is DOWN`,
                    url: service.pingUrl
                })
            } else if (result.healthy && service.showSuccess) {
                streams.push({
                    name: `✓ ${DEFAULT_SERVICES[service.id]?.name || service.id}`,
                    title: `${DEFAULT_SERVICES[service.id]?.name || service.id} is UP`,
                    url: service.pingUrl
                })
            }
        }
        
        res.json({ streams })
    } catch (error) {
        console.error('Config stream error:', error)
        res.json({ streams: [] })
    }
})

const port = process.env.PORT || 7000
app.listen(port, () => {
    console.log(`✅ Debrid Health Check running on port ${port}`)
    console.log(`⚙️  Configure: http://127.0.0.1:${port}/configure`)
    console.log(`📦 Manifest: http://127.0.0.1:${port}/manifest.json`)
})
