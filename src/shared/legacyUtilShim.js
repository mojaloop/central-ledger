'use strict'

/* istanbul ignore file: environment-dependent shim — which branches run depends on the Node.js version */

// Shim: the legacy util.is* type-check helpers were removed in Node.js >= 23,
// but hapi-openapi@3.0.0 and its enjoi dependency (both unmaintained, latest
// releases) still call them during plugin registration / schema resolution.
const util = require('node:util')

/* eslint-disable n/no-deprecated-api */
if (typeof util.isObject !== 'function') {
  util.isObject = (obj) => obj !== null && typeof obj === 'object'
}
if (typeof util.isUndefined !== 'function') {
  util.isUndefined = (obj) => obj === undefined
}
if (typeof util.isNumber !== 'function') {
  util.isNumber = (obj) => typeof obj === 'number'
}
/* eslint-enable n/no-deprecated-api */
