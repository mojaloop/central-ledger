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

const Logger = require('@mojaloop/central-services-logger')
const Config = require('../lib/config')
const Setup = require('../shared/setup')
const PJson = require('../../package.json')
const Plugin = require('./api/plugin')
const MetricPlugin = require('../api/metrics/plugin')
const { Command } = require('commander')

const Program = new Command()

Program
  .version(PJson.version)
  .description('CLI to manage Handlers')

Program.command('handler') // sub-command name, coffeeType = type, required
  .alias('h') // alternative sub-command is 'o'
  .description('Start a specified Handler') // command description
  .option('--prepare', 'Start the Prepare Handler')
  .option('--position', 'Start the Position Handler')
  .option('--get', 'Start the Transfer Get Handler')
  .option('--fulfil', 'Start the Fulfil Handler')
  .option('--timeout', 'Start the Timeout Handler')
  .option('--admin', 'Start the Admin Handler')
  .option('--bulkprepare', 'Start the Bulk Prepare Handler')
  .option('--bulkfulfil', 'Start the Bulk Fulfil Handler')
  .option('--bulkprocessing', 'Start the Bulk Processing Handler')
  .option('--bulkget', 'Start the Bulk Get Handler')
  // .option('--reject', 'Start the Reject Handler')

  // function to execute when command is uses
  .action(async (args) => {
    const handlerList = []
    if (args.prepare) {
      Logger.isDebugEnabled && Logger.debug('CLI: Executing --prepare')
      const handler = {
        type: 'prepare',
        enabled: true
      }
      handlerList.push(handler)
    }
    if (args.position) {
      Logger.isDebugEnabled && Logger.debug('CLI: Executing --position')
      const handler = {
        type: 'position',
        enabled: true
      }
      handlerList.push(handler)
    }
    if (args.get) {
      Logger.isDebugEnabled && Logger.debug('CLI: Executing --get')
      const handler = {
        type: 'get',
        enabled: true
      }
      handlerList.push(handler)
    }
    if (args.fulfil) {
      Logger.isDebugEnabled && Logger.debug('CLI: Executing --fulfil')
      const handler = {
        type: 'fulfil',
        enabled: true
      }
      handlerList.push(handler)
    }
    if (args.timeout) {
      Logger.isDebugEnabled && Logger.debug('CLI: Executing --timeout')
      const handler = {
        type: 'timeout',
        enabled: true
      }
      handlerList.push(handler)
    }
    if (args.admin) {
      Logger.isDebugEnabled && Logger.debug('CLI: Executing --admin')
      const handler = {
        type: 'admin',
        enabled: true
      }
      handlerList.push(handler)
    }
    if (args.bulkprepare) {
      Logger.isDebugEnabled && Logger.debug('CLI: Executing --bulkprepare')
      const handler = {
        type: 'bulkprepare',
        enabled: true
      }
      handlerList.push(handler)
    }
    if (args.bulkfulfil) {
      Logger.isDebugEnabled && Logger.debug('CLI: Executing --bulkfulfil')
      const handler = {
        type: 'bulkfulfil',
        enabled: true
      }
      handlerList.push(handler)
    }
    if (args.bulkprocessing) {
      Logger.isDebugEnabled && Logger.debug('CLI: Executing --bulkprocessing')
      const handler = {
        type: 'bulkprocessing',
        enabled: true
      }
      handlerList.push(handler)
    }
    if (args.bulkget) {
      Logger.isDebugEnabled && Logger.debug('CLI: Executing --bulkget')
      const handler = {
        type: 'bulkget',
        enabled: true
      }
      handlerList.push(handler)
    }

    module.exports = Setup.initialize({
      service: 'handler',
      port: Config.PORT,
      modules: [Plugin, MetricPlugin],
      runMigrations: false,
      handlers: handlerList,
      runHandlers: true
    })
    // } else {
    //   Program.help()
    // }
  })

if (Array.isArray(process.argv) && process.argv.length > 2) {
  // parse command line vars
  Program.parse(process.argv)
} else {
  // display default help
  Program.help()
}
