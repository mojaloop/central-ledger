/*****
 License
 --------------
 Copyright © 2020-2024 Mojaloop Foundation
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

 * Infitx
 - Vijay Kumar Guthi <vijaya.guthi@infitx.com>
 - Kevin Leyow <kevin.leyow@infitx.com>
 - Kalin Krustev <kalin.krustev@infitx.com>
 - Steven Oderayi <steven.oderayi@infitx.com>
 - Eugen Klymniuk <eugen.klymniuk@infitx.com>

 * ModusBox
 - Rajiv Mothilal <rajiv.mothilal@modusbox.com>
 --------------

 ******/

'use strict'

const Path = require('path')
const Inert = require('@hapi/inert')
const Vision = require('@hapi/vision')
const Blipp = require('blipp')
const ErrorHandling = require('@mojaloop/central-services-error-handling')
const { APIDocumentation, loggingPlugin } = require('@mojaloop/central-services-shared').Util.Hapi
const Config = require('../lib/config')
const { logger } = require('./logger')

const registerPlugins = async (server) => {
  if (Config.API_DOC_ENDPOINTS_ENABLED) {
    await server.register({
      plugin: APIDocumentation,
      options: {
        documentPath: Path.resolve(__dirname, '../api/interface/swagger.json')
      }
    })
  }

  await server.register({
    plugin: require('@hapi/good'),
    options: {
      ops: {
        interval: 10000
      }
    }
  })

  await server.register({
    plugin: require('@hapi/basic')
  })

  await server.register({
    plugin: require('@now-ims/hapi-now-auth')
  })

  await server.register({
    plugin: require('hapi-auth-bearer-token')
  })

  await server.register([Inert, Vision, Blipp, ErrorHandling])

  await server.register({
    plugin: loggingPlugin,
    options: { log: logger }
  })
}

module.exports = {
  registerPlugins
}
