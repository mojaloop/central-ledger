#!/usr/bin/env node

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

 * Rajiv Mothilal <rajiv.mothilal@modusbox.com>
 * Miguel de Barros <miguel.debarros@modusbox.com>

 --------------
 ******/

// const p = '%{TIMESTAMP_ISO8601:timestamp} - %{DATA:specialCharacters}: guid=%{UUID:uuid} - %{GREEDYDATA:process}'
// const p = '%{TIMESTAMP_ISO8601:timestamp} - %{GREEDYDATA:specialCharacters}: guid=%{UUID:uuid} - %{GREEDYDATA:process}'
const p = '%{TIMESTAMP_ISO8601:timestamp} - %{DATA:specialCharacters}cid=%{GREEDYDATA:uuid}, fsp=%{GREEDYDATA:fsp}, source=%{GREEDYDATA:source}, dest=%{GREEDYDATA:dest}] ~ %{GREEDYDATA:process}'
const nodeGrok = require('node-grok')
const _ = require('lodash')

var argv = require('yargs')
  .usage('Usage: $0 [options]')
  .describe('file', 'File to be parsed for metrics')
  .describe('num', 'Number of entries per transaction')
  .demandOption(['f'])
  .demandOption(['n'])
  .help('h')
  .alias('h', 'help')
  .alias('f', 'file')
  .alias('n', 'num')
  .argv

const LineByLineReader = require('line-by-line')
const lr = new LineByLineReader(argv.file)
let logMap = {}
let firstLine
let lastLine
let perEntryResponse = []
let lineCount = 0
let totalMockDifferenceTime = 0

function compare (a, b) {
  const timestampA = a.timestamp
  const timeStampB = b.timestamp

  let comparison = 0
  if (timestampA > timeStampB) {
    comparison = 1
  } else if (timestampA < timeStampB) {
    comparison = -1
  }
  return comparison
}

function compareNumbers (a, b) {
  return a - b
}

lr.on('error', function (err) {
  throw err
})

lr.on('line', function (line) {
  lineCount++
  const patterns = nodeGrok.loadDefaultSync()
  const pattern = patterns.createPattern(p)
  const logLine = pattern.parseSync(line)
  if (logLine) {
    if (_.isEmpty(firstLine)) {
      firstLine = logLine
    }
    if (!logMap[logLine.uuid]) {
      logMap[logLine.uuid] = {
        entries: [logLine]
      }
    } else {
      const entry = logMap[logLine.uuid]
      entry.entries.push(logLine)
      entry.entries.sort(compare)
      if (entry.entries.length === parseInt(argv.num)) {
        let mockTimeDifference = 0
        let preCallbackTime = 0
        let loopDifference = 0
        for (var log of entry.entries) {
          if (log.process.includes('PRE-CALLBACK')) {
            preCallbackTime = new Date(log.timestamp)
          } else if (log.process.includes('POST-CALLBACK')) {
            loopDifference += new Date(log.timestamp) - preCallbackTime
            mockTimeDifference += loopDifference
            loopDifference = 0
            preCallbackTime = 0
          }
        }
        totalMockDifferenceTime += mockTimeDifference
        entry.totalDifference = new Date(entry.entries[entry.entries.length - 1].timestamp).getTime() - new Date(entry.entries[0].timestamp).getTime() - mockTimeDifference
        perEntryResponse.push(entry.totalDifference)
      }
      logMap[logLine.uuid] = entry
    }
    lastLine = logLine
  }
})

lr.on('end', function () {
  const firstTime = new Date(firstLine.timestamp).getTime()
  const lastTime = new Date(lastLine.timestamp).getTime()
  // const totalTime = (lastTime - firstTime)
  const totalTime = (lastTime - firstTime - totalMockDifferenceTime)
  const totalTransactions = perEntryResponse.length
  const sortedPerEntryResponse = perEntryResponse.sort(compareNumbers)
  const shortestResponse = sortedPerEntryResponse[0]
  const longestResponse = sortedPerEntryResponse[perEntryResponse.length - 1]
  const averageTransaction = (perEntryResponse.reduce((a, b) => a + b, 0) / totalTransactions)

  console.log('First request: ' + firstLine.timestamp)
  console.log('Last request: ' + lastLine.timestamp)
  console.log('Total number of lines in log file: ' + lineCount)
  console.log('Number of unique matched entries: ' + totalTransactions)
  console.log('Total difference of all requests in milliseconds: ' + (totalTime))
  console.log('Shortest response time in millisecond: ' + shortestResponse)
  console.log('Longest response time in millisecond: ' + longestResponse)
  console.log('The average time a transaction takes in milliseconds: ' + averageTransaction)
  console.log('Average transactions per second: ' + (totalTransactions / (totalTime / 1000)))
  console.log('Total time waiting for mock server in milliseconds: ' + totalMockDifferenceTime)
})
