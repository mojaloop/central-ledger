/*****
 License
 --------------
 Copyright © 2017 Bill & Melinda Gates Foundation
 The Mojaloop files are made available by the Bill & Melinda Gates Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at
 http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 Contributors
 --------------
 This is the official list of the Mojaloop project contributors for this file.
 Names of the original copyright holders (individuals or organizations)
 should be listed with a '*' in the first column. People who have
 contributed from an organization can be listed under the organization
 that actually holds the copyright for their contributions (see the
 Gates Foundation organization for an example). Those individuals should have
 their names indented and be marked with a '-'. Email address can be added
 optionally within square brackets <email>.
 * Gates Foundation
 - Name Surname <name.surname@gatesfoundation.com>

 * Lewis Daly <lewis@vesselstech.com>
 --------------
 **********/

'use strict'

const Logger = require('@mojaloop/central-services-shared').Logger

/* Helper Functions */

/**
 * @function createRequest
 *
 * @description Create a mock request handler
 *
 * @param {object} Request - The request object
 * @param {object.payload}
 * @param {object.params}
 * @param {object.quert}
 *
 * @returns {Request} - A Hapi compatible request object
 */
const createRequest = ({ payload, params, query }) => {
  const requestPayload = payload || {}
  const requestParams = params || {}
  const requestQuery = query || {}

  return {
    payload: requestPayload,
    params: requestParams,
    query: requestQuery,
    server: {
      log: () => { },
      methods: { }
    }
  }
}

/**
 * @function sleepPromise
 *
 * @description A hacky method to sleep in JS. For testing purposes only.
 *
 * @param {number} seconds - The number of seconds to sleep for
 *
 * @returns {Promise<>}
 */
async function sleepPromise (seconds) {
  return new Promise(resolve => setTimeout(resolve, seconds * 1000))
}

/**
 * @function unwrapResponse
 *
 * @description Unwrap the innner response body and code from an async Handler. It's ugly, but it's my
 *   baby, and I love it.
 *
 * @param {async () => ({response: Hapi.Response})} asyncFunction - The function that we want to unwrap.
 *
 * @returns {res}
 * @returns {res.responseBody: object} - The response body unwrapped from the asyncFunction
 * @returns {res.responseCode: number} - The response code unwrapped from the asyncFunction
 */
const unwrapResponse = async (asyncFunction) => {
  let responseBody
  let responseCode
  const nestedReply = {
    response: (response) => {
      responseBody = response
      return {
        code: statusCode => {
          responseCode = statusCode
        }
      }
    }
  }
  await asyncFunction(nestedReply)

  return {
    responseBody,
    responseCode
  }
}

/**
 * @function waitFor
 *
 * @description Wait for a function to resolve true with a number of retries. Useful for waiting for Kafka Consumers to be up before
 *   we start our tests
 *
 * @param {() => Promise<any>} func - The function we are waiting for. It must return a Promise that throws an error if we should still wait
 * @param {string} name - The name of the function we are waiting for. For logging purposes only.
 * @param {number} retries - The number of times to retry before failing, defaults to 5
 * @param {increment} retries - The number of seconds to multiply the retry count by,
 *  in order to wait longer between retries. Defaults to 2
 * @returns {Promise<>}
 */
async function waitFor (func, name, retries = 5, increment = 2) {
  const retryList = Array.from({ length: retries }, (x, i) => i).filter(i => i > 0).map(i => i * increment)
  return retryList.reduce(async (acc, curr) => {
    const ready = await acc

    if (ready) {
      return Promise.resolve(true)
    }

    try {
      await func()
      return Promise.resolve(true)
    } catch (err) {
      Logger.error(`waitFor: '${name}' failed. Sleeping for: ${curr} seconds.`)
    }

    return sleepPromise(curr).then(() => false)
  }, Promise.resolve(false))
}

module.exports = {
  createRequest,
  sleepPromise,
  unwrapResponse,
  waitFor
}
