const Logger = require('@mojaloop/central-services-logger')
const Config = require('../../../src/lib/config')
const Setup = require('../../../src/shared/setup')
const PJson = require('../package.json')
const Plugin = require('../../../src/handlers/api/plugin')
const MetricPlugin = require('../../../src/api/metrics/plugin')
const { Command } = require('commander')
const { prepareHanlderRunner } = require('./prepareHanlderRunner')

const Program = new Command()

Program
  .version(PJson.version)
  .description('CLI to run separate handlers in benchmark mode')

Program.command('perf-prepare')
  .description('start transfer prepare handler in perfmode')
  .option('--numberOfMsgs <num>', 'number of messages')
  .option('--runDurationSec <num>', 'seconds the handler should be running')
  .option('--dfspList <string>', 'dfspList comma separated list of dfsps to be used in generated transfers e.g "simfsp01, simfsp02"')
  .action(async (args) => {
    if (args.numberOfMsgs) {
      Logger.debug(`CLI: Param --numberOfMsgs, ${args.numberOfMsgs}`)
    }
    if (args.runDurationSec) {
      Logger.debug(`CLI: Param --runDurationSec ${args.runDurationSec}`)
    }

    try {
      const handler = {
        type: 'prepare',
        enabled: true
      }
      const dfspList = args.dfspList ? args.dfspList.trim().split(',').map(string => string.trim()) : ['simfsp01', 'simfsp02', 'simfsp03', 'simfsp04', 'simfsp05', 'simfsp06', 'simfsp07', 'simfsp08']
      await Setup.initialize({
        service: 'handler',
        port: Config.PORT,
        modules: [Plugin, MetricPlugin],
        runMigrations: false,
        handlers: [handler],
        runHandlers: true
      })
      const count = await prepareHanlderRunner(parseInt(args.numberOfMsgs), parseInt(args.runDurationSec), dfspList)
      Logger.info(`Total records: ${count}`)
    } catch (err) {
      Logger.error(err)
    }
  })

if (Array.isArray(process.argv) && process.argv.length > 2) {
  // parse command line vars
  Program.parse(process.argv)
} else {
  // display default help
  Program.help()
}
