const { addonBuilder, serveHTTP, getRouter } = require('stremio-addon-sdk')
const https = require('https')
const http = require('http')

const DEFAULT_SERVICES = {
    alldebrid: {
        name: 'AllDebrid',
        pingUrl: 'https://api.alldebrid.com/v4/ping'
    },
    realdebrid: {
        name: 'Real-Debrid',
        pingUrl: 'https://api.real-debrid.com/rest/1.0/time'
    }
}

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

async function checkServiceHealth(service) {
    return new Promise((resolve) => {
        const url = new URL(service.pingUrl)
        const client = url.protocol === 'https:' ? https : http
        
        const req = client.get(service.pingUrl, (res) => {
            resolve({ healthy: res.statusCode === 200 })
        })
        
        req.on('error', () => resolve({ healthy: false }))
        req.setTimeout(service.timeout || 5000, () => {
            req.destroy()
            resolve({ healthy: false })
        })
    })
}

builder.defineStreamHandler(async (args) => {
    const config = args.config || {}
    const services = config.services ? JSON.parse(config.services) : [{
        id: 'alldebrid',
        enabled: true,
        pingUrl: DEFAULT_SERVICES.alldebrid.pingUrl,
        showSuccess: true,
        showError: true,
        timeout: 5000
    }]
    
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
    
    return Promise.resolve({ streams })
})

// Get the router (this is how Torrentio does it)
const addonInterface = builder.getInterface()
const router = getRouter(addonInterface)

// Add custom /configure route BEFORE serveHTTP
router.get('/configure', (req, res) => {
    res.type('html')
    res.send(require('./landingHTML')())
})

// Serve addon
serveHTTP(addonInterface, { port: process.env.PORT || 7000 })
