#!/usr/bin/env node

const { execSync } = require('child_process')

/**
 * @file _wait4_all.js
 * @description Waits for all docker-compose services to be running and healthy
 */

// Define the docker-compose containers you want to monitor here
const expectedContainers = [
  'cl_mysql',
  'cl_kafka'
  // ## NOTE: These are not needed for Integration Tests
  // 'cl_central-ledger',
  // 'cl_ml-api-adapter',
  // 'cl_simulator',
  // 'mockserver',
  // 'cl_objstore' //,
  // 'kowl'
]

let retries = 40
const waitTimeMs = 60000

async function main () {
  const waitingMap = {}
  // serviceName => status, where status is healthy, unhealthy or starting
  expectedContainers.forEach(serviceName => {
    waitingMap[serviceName] = 'starting'
  })

  try {
    let allHealthy = await areAllServicesHealthy(waitingMap, waitTimeMs)

    while (!allHealthy && retries > 0) {
      await sleep(waitTimeMs)
      allHealthy = await areAllServicesHealthy(waitingMap, waitTimeMs)

      if (retries === 0) {
        throw new Error(`Out of retries waiting for service health.\nStill waiting for: ${getServicesForStatus(waitingMap, 'starting')}`)
      }

      console.log('Still waiting for service health. Retries', retries)
      console.log(`${getServicesForStatus(waitingMap, 'healthy').length} services are healthy. Expected: ${expectedContainers.length}`)
      console.log('Waiting for', getServicesForStatus(waitingMap, 'starting'))

      retries--
    }

    console.log('All services are healthy. Time to get to work!')
    process.exit(0)
  } catch (error) {
    console.error(`_wait4_all: ${error}`)
    process.exit(1)
  }
}

/**
 * @function areAllServicesHealthy
 * @description Get Update the service status, and sleep for `waitTimeMs` if the services aren't healthy
 * @param {*} waitingMap
 * @returns boolean
 */
async function areAllServicesHealthy (waitingMap) {
  await updateServiceStatus(waitingMap)

  if (isSystemHealthy(waitingMap)) {
    return true
  }

  if (isSystemFailing(waitingMap)) {
    throw new Error(`One or more services went to unhealthy: \n\t${getServicesForStatus(waitingMap, 'unhealthy')}\n`)
  }

  return false
}

/**
 * @function updateServiceStatus
 * @description Go through all of the waiting services, and check their status
 * @param {*} waitingMap
 * @returns void
 */
async function updateServiceStatus (waitingMap) {
  const startingServices = getServicesForStatus(waitingMap, 'starting')

  Promise.all(startingServices.map(async serviceName => {
    // TODO: This info may be useful in future!
    // const currentStatus = waitingMap[serviceName]
    const progress = await getProgress(serviceName)
    waitingMap[serviceName] = progress
  }))
}

/**
 * @function getProgress
 * @description Invokes the `docker inspect` command for the given container
 * @param {string} containerName
 * @returns {'healthy' | 'unhealthy' | 'starting'}
 */
function getProgress (containerName) {
  const command = `docker inspect --format='{{json .State.Health.Status}}' ${containerName}`
  return execSync(command).toString().replace(/['"]+|[\n]+/g, '')
}

/**
 * @function isSystemHealthy
 * @param {*} waitingMap
 * @returns {boolean}
 */
function isSystemHealthy (waitingMap) {
  return getServicesForStatus(waitingMap, 'healthy').length === expectedContainers.length
}

/**
 * @function isSystemFailing
 * @param {*} waitingMap
 * @returns {boolean}
 */
function isSystemFailing (waitingMap) {
  return getServicesForStatus(waitingMap, 'unhealthy').length > 0
}

/**
 * @function getServicesForStatus
 * @param {*} waitingMap
 * @param {'healthy' | 'unhealthy' | 'starting'} status
 * @returns {Array<string>}
 */
function getServicesForStatus (waitingMap, status) {
  return Object
    .keys(waitingMap)
    .filter(k => waitingMap[k] === status)
}

/**
 * @function sleep
 * @param {*} timeMs - how long to sleep for
 */
async function sleep (timeMs) {
  console.log(`Sleeping for ${timeMs} ms`)
  return new Promise((resolve, reject) => setTimeout(() => resolve(), timeMs))
}

main()
