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

 * Miguel de Barros <miguel.debarros@modusbox.com>

 --------------
 ******/
'use strict'

/**
 * @module Handlers CLI Startup
 */

const Logger = require('@mojaloop/central-services-shared').Logger
const Config = require('../lib/config')
const Setup = require('../shared/setup')
const Program = require('commander')
const PJson = require('../../package.json')
const Plugin = require('./api/plugin')

Program
  .version(PJson.version)
  .description('CLI to manage Handlers')

Program.command('handler') // sub-command name, coffeeType = type, required
  .alias('h') // alternative sub-command is `o`
  .description('Start a specified Handler') // command description
  .option('--prepare [fspNameList]', 'Start the Prepare Handler - [fspNameList]: "," delimited list of FSPs. Optional, e,g "dfsp1, dfsp2", and if not provided all existing FSPs will be registered')
  .option('--position [fspNameList]', 'Start the Position Handler - [fspNameList]: "," delimited list of FSPs. Optional, e,g "dfsp1, dfsp2", and if not provided all existing FSPs will be registered')
  .option('--transfer', 'Start the Transfer Handler')
  .option('--fulfil', 'Start the Fulfil Handler')
  // .option('--reject', 'Start the Reject Handler')

  // function to execute when command is uses
  .action(function (args) {
    if (Array.isArray(args.options) && args.options.length > 0) {
      let handlerList = []
      if (args.prepare && typeof args.prepare === 'string') {
        Logger.debug(`CLI: Executing --prepare ${args.prepare}`)
        let handlerList = args.prepare.replace(/\s/g, '').split(',')
        if (Array.isArray(handlerList) && handlerList.length >= 1) {
          var handler = {
            type: 'prepare',
            enabled: true,
            fspList: handlerList
          }
          handlerList.push(handler)
        } else {
          throw new Error('Invalid [fspNameList] provided for --prepare. Please ensure that it is a "," delimated string. e.g. "fsp1, fsp2".')
        }
      }
      if (args.position) {
        Logger.debug(`CLI: Executing --position ${args.position}`)
        let parsedHandlerList = args.position.replace(/\s/g, '').split(',')
        if (Array.isArray(parsedHandlerList) && parsedHandlerList.length >= 1) {
          let handler = {
            type: 'position',
            enabled: true,
            fspList: parsedHandlerList
          }
          handlerList.push(handler)
        } else {
          throw new Error('Invalid [fspNameList] provided for --position. Please ensure that it is a "," delimated string. e.g. "fsp1, fsp2".')
        }
      }
      if (args.transfer) {
        Logger.debug(`CLI: Executing --transfer`)
        let handler = {
          type: 'transfer',
          enabled: true
        }
        handlerList.push(handler)
      }
      if (args.fulfil) {
        Logger.debug(`CLI: Executing --fulfil`)
        let handler = {
          type: 'fulfil',
          enabled: true
        }
        handlerList.push(handler)
      }
      // if (args.reject) {
      //   Logger.debug(`CLI: Executing --reject`)
      //   let handler = {
      //     type: 'reject',
      //     enabled: true
      //   }
      //   handlerList.push(handler)
      // }

      module.exports = Setup.initialize({
        service: 'handler',
        port: Config.PORT,
        modules: [Plugin],
        runMigrations: false,
        handlers: handlerList,
        runHandlers: true
      })
    }
  })

// parse command line vars
Program.parse(process.argv)

// display default help
if (!Program.args.length) {
  Program.help()
}
