/*****
 License
 --------------
 Copyright © 2020-2025 Mojaloop Foundation
 The Mojaloop files are made available by the Mojaloop Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

 Contributors
 --------------
 This is the official list of the Mojaloop project contributors for this file.
 Names of the original copyright holders (individuals or organizations)
 should be listed with a '*' in the first column. People who have
 contributed from an organization can be listed under the organization
 that actually holds the copyright for their contributions (see the
 Mojaloop Foundation for an example). Those individuals should have
 their names indented and be marked with a '-'. Email address can be added
 optionally within square brackets <email>.

 * Mojaloop Foundation
 - Name Surname <name.surname@mojaloop.io>

 * Valentin Genev <valentin.genev@modusbox.com>
 * Deon Botha <deon.botha@modusbox.com>
 * Rajiv Mothilal <rajiv.mothilal@modusbox.com>
 * Miguel de Barros <miguel.debarros@modusbox.com>

 --------------
 ******/

'use strict'

// Deterministic request mock generator for the OpenAPI 3.0 settlement API
// document. It replaces the former `swagmock` based generator, which only
// supported Swagger 2.0 documents, while keeping the same calling interface:
//
//   Mockgen().requests({ path, operation }, callback)
//     -> callback(null, { request: { path, body } })

const Path = require('path')
const apiPath = Path.resolve(__dirname, '../../../src/settlement/interface/swagger.json')

const resolveRef = (spec, schema) => {
  if (schema && schema.$ref) {
    const refPath = schema.$ref.replace(/^#\//, '').split('/')
    return resolveRef(spec, refPath.reduce((acc, key) => acc[key], spec))
  }
  return schema
}

const mockFromSchema = (spec, schema) => {
  const resolved = resolveRef(spec, schema)
  if (!resolved) {
    return undefined
  }
  if (Array.isArray(resolved.enum)) {
    return resolved.enum[0]
  }
  switch (resolved.type) {
    case 'object': {
      const value = {}
      for (const [name, propertySchema] of Object.entries(resolved.properties || {})) {
        value[name] = mockFromSchema(spec, propertySchema)
      }
      return value
    }
    case 'array': {
      const length = Math.max(1, resolved.minItems || 0)
      return Array.from({ length }, () => mockFromSchema(spec, resolved.items))
    }
    case 'integer':
    case 'number':
      return 1
    case 'boolean':
      return true
    case 'string':
      if (resolved.format === 'date-time') {
        return '2017-07-20T17:32:28.000Z'
      }
      if (resolved.format === 'date') {
        return '2017-07-20'
      }
      return resolved.example || 'string'
    default:
      return resolved.example
  }
}

const mockRequest = (spec, options) => {
  const pathItem = spec.paths[options.path]
  const operation = pathItem && pathItem[options.operation]
  if (!operation) {
    throw new Error(`Mockgen: no operation found for '${options.operation} ${options.path}'`)
  }

  let resolvedPath = options.path
  const query = []
  const parameters = [...(pathItem.parameters || []), ...(operation.parameters || [])]
  for (const parameter of parameters) {
    const value = mockFromSchema(spec, parameter.schema)
    if (parameter.in === 'path') {
      resolvedPath = resolvedPath.replace(`{${parameter.name}}`, encodeURIComponent(value))
    } else if (parameter.in === 'query') {
      query.push(`${encodeURIComponent(parameter.name)}=${encodeURIComponent(value)}`)
    }
  }
  if (query.length > 0) {
    resolvedPath = `${resolvedPath}?${query.join('&')}`
  }

  const request = { path: resolvedPath }
  const requestBody = operation.requestBody && operation.requestBody.content &&
    operation.requestBody.content['application/json']
  if (requestBody && requestBody.schema) {
    request.body = mockFromSchema(spec, requestBody.schema)
  }
  return { request }
}

module.exports = function () {
  const spec = require(apiPath)
  return {
    requests (options, callback) {
      try {
        return callback(null, mockRequest(spec, options || {}))
      } catch (err) {
        return callback(err)
      }
    }
  }
}
