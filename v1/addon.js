const { addonBuilder, serveHTTP } = require('stremio-addon-sdk')
const https = require('https')

const manifest = {
    id: 'com.alldebrid.healthcheck',
    version: '1.0.0',
    name: 'AllDebrid Health Check',
    description: 'Returns a dummy stream when AllDebrid API is UP, empty when DOWN',
    resources: ['stream'],
    types: ['movie', 'series'],
    idPrefixes: ['tt'],
    catalogs: []
}

const builder = new addonBuilder(manifest)

async function checkAllDebridHealth() {
    return new Promise((resolve) => {
        const req = https.get('https://api.alldebrid.com/v4/ping', (res) => {
            if (res.statusCode === 200) {
                console.log('[Health Check] AllDebrid API is UP')
                resolve(true)
            } else {
                console.log(`[Health Check] AllDebrid returned ${res.statusCode}`)
                resolve(false)
            }
        })
        
        req.on('error', (error) => {
            console.error('[Health Check] AllDebrid is DOWN:', error.message)
            resolve(false)
        })
        
        req.setTimeout(5000, () => {
            req.destroy()
            console.error('[Health Check] AllDebrid timeout')
            resolve(false)
        })
    })
}

builder.defineStreamHandler(async (args) => {
    console.log(`[Request] ${args.type} ${args.id}`)
    
    const isHealthy = await checkAllDebridHealth()
    
    if (!isHealthy) {
        console.log('[Response] AllDebrid DOWN - blocking all addons')
        //return { streams: [] }
        return { 
            streams: [{
                name: '📡 HealthCheck',
                title: '🔴 AllDebrid is DOWN',
                url: 'https://api.alldebrid.com/v4/ping'
            }]
        }
    }
    
    console.log('[Response] AllDebrid UP - allowing addons to proceed')
    // Return a dummy stream that AIOStreams can detect
    return { 
        streams: [{
            //name: '✓ AllDebrid',
            name: '📡 HealthCheck',
            title: '🟢 AllDebrid is UP',
            url: 'https://api.alldebrid.com/v4/ping'
        }]
    }
})

const port = process.env.PORT || 7000
serveHTTP(builder.getInterface(), { port })
console.log(`Addon running on http://127.0.0.1:${port}`)