'use strict'

const sleep = (milliseconds = 1000, debug = false, caller = null, reason = null) => {
  let start = new Date().getTime()
  if (debug) {
    let output = caller ? `(${caller}) ` : ''
    output += reason ? `${reason}: ` : ''
    output += `sleep ${milliseconds / 1000}s..`
    console.log(output)
  }
  while (1) {
    if ((new Date().getTime() - start) > milliseconds) {
      break
    }
  }
  if (debug) {
    console.log(`sleep end`)
  }
}

const msCurrentYear = () => {
  const now = new Date()
  const pastDate = new Date(now.getFullYear(), 0)
  return now - pastDate
}

const msCurrentMonth = () => {
  const now = new Date()
  const pastDate = new Date(now.getFullYear(), now.getMonth())
  return now - pastDate
}

const msToday = () => {
  const now = new Date()
  const pastDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return now - pastDate
}

const getCurrentUTCTimeInMilliseconds = () => {
  return new Date().getTime()
}

const getUTCString = (d) => {
  return d.toISOString().replace(/[TZ]/g, ' ').trim()
}

module.exports = {
  sleep,
  msCurrentYear,
  msCurrentMonth,
  msToday,
  getCurrentUTCTimeInMilliseconds,
  getUTCString
}
