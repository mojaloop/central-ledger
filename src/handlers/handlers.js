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

 * Lazola Lucas <lazola.lucas@modusbox.com>
 * Rajiv Mothilal <rajiv.mothilal@modusbox.com>
 * Miguel de Barros <miguel.debarros@modusbox.com>

 --------------
 ******/
'use strict'


const Logger = require('@mojaloop/central-services-shared').Logger
const Translator = require('./lib/translator')
const Transfers = require('./transfers')
const DAO = require("./lib/dao")
const Consumer = require('./lib/consumer')

exports.registerAllHandlers = async function (config) {
  try {
    const dfspNames = DAO.retrieveAllAccounts()
    Logger.info(dfspNames)
    for (var i = 0; i < dfspNames.length; i++) {
      const transfersList = Transfers.allHandlers(dfspNames[i])
      for (var k = 0; k < transfersList.length; k++) {
        const handlerDetails = transfersList[k]
        await Consumer.createHandler(handlerDetails.topicName, config, handlerDetails.consumerMode, handlerDetails.command)
      }
    }
  } catch (e) {
    Logger.error(e)
  }
}

exports.transferHandler = async function () {
}
