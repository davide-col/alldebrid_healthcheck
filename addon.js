const { addonBuilder, serveHTTP } = require('stremio-addon-sdk')
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
    catalogs: [],
    behaviorHints: {
        configurable: true,
        configurationRequired: false
    }
}

const builder = new addonBuilder(manifest)

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
                console.log(`[${service.id}] UP (${res.statusCode})`)
                resolve({ healthy: true, status: res.statusCode })
            } else {
                console.log(`[${service.id}] ${res.statusCode}`)
                resolve({ healthy: false, status: res.statusCode })
            }
        })
        
        req.on('error', (error) => {
            console.error(`[${service.id}] DOWN:`, error.message)
            resolve({ healthy: false, error: error.message })
        })
        
        req.setTimeout(service.timeout || 5000, () => {
            req.destroy()
            console.error(`[${service.id}] timeout`)
            resolve({ healthy: false, error: 'timeout' })
        })
    })
}

builder.defineStreamHandler(async (args) => {
    console.log(`[Request] ${args.type} ${args.id}`)
    
    const config = parseConfig(args)
    const streams = []
    
    for (const service of config.services) {
        if (!service.enabled) continue
        
        const result = await checkServiceHealth(service)
        
        if (!result.healthy) {
            if (service.showError) {
                streams.push({
                    name: `⚠️ ${DEFAULT_SERVICES[service.id]?.name || service.id}`,
                    title: `${DEFAULT_SERVICES[service.id]?.name || service.id} is DOWN`,
                    url: service.pingUrl
                })
            }
        } else {
            if (service.showSuccess) {
                streams.push({
                    name: `✓ ${DEFAULT_SERVICES[service.id]?.name || service.id}`,
                    title: `${DEFAULT_SERVICES[service.id]?.name || service.id} is UP`,
                    url: service.pingUrl
                })
            }
        }
    }
    
    return { streams }
})

const port = process.env.PORT || 7000
serveHTTP(builder.getInterface(), { port })
console.log(`Running on http://127.0.0.1:${port}`)
console.log(`Configure: http://127.0.0.1:${port}/configure`)