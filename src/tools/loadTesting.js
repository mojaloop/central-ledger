const p = '%{TIMESTAMP_ISO8601:timestamp} - %{DATA:specialCharacters}: L1p-Trace-Id=%{UUID:uuid} - %{GREEDYDATA:process}'
const nodeGrok = require('node-grok')
const _ = require('lodash')

const LineByLineReader = require('line-by-line')
const lr = new LineByLineReader('../../test/fixtures/output.log')
const logMap = {}
let firstLine
let lastLine
let perEntryResponse = []
let lineCount = 0

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
    if (entry.entries.length === 3) {
      entry.totalDifference = new Date(entry.entries[2].timestamp).getTime() - new Date(entry.entries[0].timestamp).getTime()
      perEntryResponse.push(entry.totalDifference)
    }
    logMap[logLine.uuid] = entry
  }
  lastLine = logLine
})

lr.on('end', function () {
  const firstTime = new Date(firstLine.timestamp).getTime()
  const lastTime = new Date(lastLine.timestamp).getTime()
  console.log('Total number of lines in log file ' + lineCount)
  console.log('Number of unique entries = ' + perEntryResponse.length)
  console.log('First request duration in milliseconds ' + new Date(firstLine.timestamp).getTime())
  console.log('Last request duration in milliseconds ' + new Date(lastLine.timestamp).getTime())
  console.log('Total difference of all requests in milliseconds ' + (lastTime - firstTime))
  console.log('Shortest response time in milliseconds ' + perEntryResponse.sort(compareNumbers)[0])
  console.log('Longest response time in milliseconds ' + perEntryResponse.sort(compareNumbers)[perEntryResponse.length - 1])
  console.log('The average transaction in milliseconds ' + perEntryResponse.reduce((a, b) => a + b, 0) / perEntryResponse.length)
  console.log('Average transactions per second ' + (((lastTime / 1000) - (firstTime / 1000)) / perEntryResponse.length))
})
