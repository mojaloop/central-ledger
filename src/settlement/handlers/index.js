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

 * ModusBox
 - Georgi Georgiev <georgi.georgiev@modusbox.com>
 - Miguel de Barros <miguel.debarros@modusbox.com>
 - Deon Botha <deon.botha@modusbox.com>
******/
'use strict'

/**
 * @module Handlers CLI Startup
 * Cli run command eg : node src/handlers/index.js handler --transferSettlement
 */

const { logger } = require('../shared/logger')
const Config = require('../lib/config')
const Setup = require('../shared/setup')
const PJson = require('../../../package.json')
const { Command } = require('commander')
const HandlerRoutes = require('../api/handlerRoutes')

const Program = new Command()

Program
  .version(PJson.version)
  .description('CLI to manage Handlers')

Program.command('handler') // sub-command name, coffeeType = type, required
  .alias('h') // alternative sub-command is `h`
  .description('Start a specified Handler') // command description
  .option('--deferredSettlement', 'Start the Deffered Settlement Handler')
  .option('--grossSettlement', 'Start the Gross Settlement Handler')
  .option('--rules', 'Start the Rules Handler')
  // function to execute when command is used
  .action(async (args) => {
    const handlerList = []
    if (args.deferredSettlement === true) {
      logger.debug('CLI: Executing --deferredSettlement')
      const handler = {
        type: 'deferredSettlement',
        enabled: true
      }
      handlerList.push(handler)
    }

    if (args.grossSettlement === true) {
      logger.debug('CLI: Executing --grossSettlement')
      const handler = {
        type: 'grossSettlement',
        enabled: true
      }
      handlerList.push(handler)
    }

    if (args.rules === true) {
      logger.debug('CLI: Executing --rules')
      const handler = {
        type: 'rules',
        enabled: true
      }
      handlerList.push(handler)
    }

    module.exports = Setup.initialize({
      service: 'handler',
      port: Config.PORT,
      modules: [HandlerRoutes],
      handlers: handlerList,
      runHandlers: true
    })
  })

if (Array.isArray(process.argv) && process.argv.length > 2) {
  // parse command line vars
  Program.parse(process.argv)
} else {
  // display default help
  Program.help()
}
