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

 --------------

 ******/

const { asyncStorage } = require('@mojaloop/central-services-logger/src/contextLogger')
const { logger } = require('./logger') // pass though options

const loggingPlugin = {
  name: 'loggingPlugin',
  version: '1.0.0',
  once: true,
  register: async (server, options) => {
    // const { logger } = options;
    server.ext({
      type: 'onPreHandler',
      method: (request, h) => {
        const { path, method, headers, payload, query } = request
        const { remoteAddress } = request.info
        const requestId = request.info.id = `${request.info.id}__${headers.traceid}`
        asyncStorage.enterWith({ requestId })

        if (method.toUpperCase() === 'POST') {
          logger.info(`[==> req] POST ${path} ${request.payload.transferId}`, { payload, query})
          return h.continue  
        }
        logger.info(`[==> req] ${method.toUpperCase()} ${path}`, { payload, query})
        return h.continue
      }
    })

    server.ext({
      type: 'onPreResponse',
      method: (request, h) => {
        if (logger.isInfoEnabled) {
          const { path, method, headers, payload, query, response } = request
          const { received } = request.info

          const statusCode = response instanceof Error
            ? response.output?.statusCode
            : response.statusCode
          const respTimeSec = ((Date.now() - received) / 1000).toFixed(3)

          logger.info(`[<== ${statusCode}][${respTimeSec} s] ${method.toUpperCase()} ${path}`, { headers, payload, query })
        }
        return h.continue
      }
    })
  }
}

module.exports = loggingPlugin
