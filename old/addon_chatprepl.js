const { addonBuilder, getRouter } = require('stremio-addon-sdk')
const https = require('https')
const http = require('http')
const landingHTML = require('./landingHTML')

// Defaults
const DEFAULT_SERVICES = {
  alldebrid: { name: 'AllDebrid', pingUrl: 'https://api.alldebrid.com/v4/ping' },
  realdebrid: { name: 'Real-Debrid', pingUrl: 'https://api.real-debrid.com/rest/1.0/time' }
}

// Minimal manifest
const manifest = {
  id: 'com.debrid.healthcheck',
  version: '2.0.0',
  name: 'Debrid Health Check',
  description: 'Check multiple debrid services',
  resources: ['stream'],
  types: ['movie', 'series'],
  idPrefixes: ['tt'],
  catalogs: []
}

const builder = new addonBuilder(manifest)

// Robust config normalizer (accepts stringified or object)
function normalizeConfig(args) {
  const cfg = args?.config || {}
  let services = cfg.services
  if (typeof services === 'string') {
    try { services = JSON.parse(services) } catch { services = null }
  }
  if (!Array.isArray(services)) {
    services = [{
      id: 'alldebrid',
      enabled: true,
      pingUrl: DEFAULT_SERVICES.alldebrid.pingUrl,
      showSuccess: true,
      showError: true,
      timeout: 5000
    }]
  }
  return services
}

// Simple HEAD/GET health check
async function checkServiceHealth(service) {
  return new Promise((resolve) => {
    const url = new URL(service.pingUrl)
    const client = url.protocol === 'https:' ? https : http
    const req = client.get(service.pingUrl, (res) => resolve({ healthy: res.statusCode === 200 }))
    req.on('error', () => resolve({ healthy: false }))
    req.setTimeout(service.timeout || 5000, () => { req.destroy(); resolve({ healthy: false }) })
  })
}

// Streams handler
builder.defineStreamHandler(async (args) => {
  const services = normalizeConfig(args)
  const streams = []
  for (const service of services) {
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
  return { streams }
})

// Build router the Torrentio way and add /configure
const addonInterface = builder.getInterface()
const router = getRouter(addonInterface)

// Redirect root to /configure
router.get('/', (req, res) => res.redirect('/configure'))

// Serve the configuration UI
router.get('/configure', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=UTF-8')
  res.send(landingHTML())
})

// Start HTTP server
require('http').createServer(router).listen(process.env.PORT || 7000)
