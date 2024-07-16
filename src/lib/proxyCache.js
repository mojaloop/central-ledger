
'use strict'
const { createProxyCache } = require('@mojaloop/inter-scheme-proxy-cache-lib')
const Config = require('./config.js')

module.exports = createProxyCache(
  Config.PROXY_CACHE_CONFIG.type,
  Config.PROXY_CACHE_CONFIG.proxyConfig
)
