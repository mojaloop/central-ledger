#!/usr/bin/env node

'use-strict'
const util = require('util')
/**
 * @file wait4.js
 * @description Waits for a given service's prerequisite services to be up and running.
 *
 *  Observe the following Environment Variables:
 *  `WAIT4_SERVICE`  - REQUIRED  The name of the service. Must refer to any entry of `services.[*].name` in config.json
 *  `WAIT4_CONFIG`   - OPTIONAL path to config.json file, by default `./wait4.config.json`
 *  `WAIT4_RETRIES`  - OPTIONAL  How many times should we retry waiting for a service? _optional_ Defaults to 10
 *  `WAIT4_WAIT_MS`  - OPTIONAL  How many ms to wait before retrying a service connection? _optional_ Defaults to 1000 (1 second)
 *
 *  To keep the script code simple, we drop any validation, so the format of config file must be perfect!
 *
 *
 */
async function main () {
  console.log('args are', process.argv)

  try {
    const config = require(process.env.WAIT4_CONFIG || './wait4.config.js')
    const service = getService(config)
    console.info(`wait4 Service: ${service.name}`)

    // merge config with environment or defaults
    config.retries = parseInt(process.env.WAIT4_RETRIES || config.retries || 10)
    config.waitMs = parseInt(process.env.WAIT4_WAIT_MS || config.waitMs || 2000)

    // wait for services connections or paradox to be ready
    const waitresses = getWaiters(service.wait4, config)
    const report = await Promise.all(waitresses)

    console.info(`wait4 Report:\n${util.inspect(report, false, 5, true)}`)
    process.exit(0)
  } catch (error) {
    console.error(`wait4 Error: ${error}`)
    process.exit(1)
  }
}

main()

function getService (config) {
  const serviceName = process.argv.slice(-1).pop() || process.env.WAIT4_SERVICE
  if (!serviceName) {
    console.error('wait4 Environment variable WAIT4_SERVICE or service name parameter are required')
    process.exit(1)
  }
  return config.services.find(s => s.name === serviceName)
}

/**
 * @function getWaiters
 * @description - generates the list of promises of doing the wait job
 * @param {array} wait4 - list of wait job descriptions
 * @param {object} config - configuration
 */
function getWaiters (wait4, config) {
  const methods = {
    mongo: methodMongoDB,
    mysql: methodMySQL,
    mysqlAlt: methodMySQLAlt,
    ncat: methodNCat
  }
  console.log(`wait4 Dependencies to wait for:\n${util.inspect(wait4, false, 5, true)}`)
  return wait4.map(waitJob => wrapWithRetries(
    methods[waitJob.method],
    waitJob,
    waitJob.retries || config.retries,
    waitJob.waitMs || config.waitMs
  ))
}

/**
 * @function wrapWithRetries
 * @description - Call the given function with a number of retries.
 * @param {fn} method - Async function to be called with retries
 * @param {object} waitJob - waitJob's definition
 * @param {number} retries - Number of times to retry before returning an error if the func fails
 * @param {number} waitTimeMs - Ms time to wait before trying again
 */
async function wrapWithRetries (method, waitJob, retries, waitTimeMs) {
  try {
    // generate method's RC config
    const RC = getRC(waitJob)
    // method do it's wait job
    waitJob = await method(waitJob, RC)
    waitJob.status = 'connected'
    return Promise.resolve(waitJob)
  } catch (err) {
    console.info(`wait4 Retry(${waitJob.uri})`)
    if (retries > 0) {
      // let retry wait job again
      return new Promise((resolve) => {
        waitJob.retries = (waitJob.retries || 0) + 1
        // Wait just a little bit longer each time.
        setTimeout(() => resolve(wrapWithRetries(method, waitJob, retries - 1, waitTimeMs * 1.5)), waitTimeMs)
      })
    }
    // no more retries left
    console.error(`wait4 Out of retries for uri:${waitJob.uri}\n\t\tand method: ${waitJob.method}`)
    waitJob.status = 'stalled'
    return Promise.reject(err)
  }
}

/**
 * @function getRC
 * @description - create RC config instance
 * @param {object} waitJob
 */
function getRC (waitJob) {
  // acquire rc parameters
  const namespace = (waitJob.rc && waitJob.rc.namespace) || 'CLEDG'
  const configPath = (waitJob.rc && waitJob.rc.configPath) || '../config/default.json'

  // require rc to deliver config
  try {
    return require('rc')(namespace, require(configPath))
  } catch (err) {
    return waitJob.rc || {}
  }
}

/**
 * @function methodMongoDB
 * @description Waits for the MongoDB service to be up and running
 * @param {object} waitJob
 * @param {object} RC
 */
async function methodMongoDB (waitJob, RC) {
  const isDisabled = RC.MONGODB.DISABLED && RC.MONGODB.DISABLED.toString().trim().toLowerCase() === 'true'
  if (isDisabled) {
    return `MongoDB(${waitJob.uri}) Disabled`
  }

  // make connection to MongoDB using `Mongoose`
  const mongoose = require('mongoose')
  const model = mongoose.model('test', mongoose.Schema({ name: 'string' }))
  await mongoose.connect(waitJob.uri, { useUnifiedTopology: true, promiseLibrary: global.Promise })
  await model.findOne({ name: 'x' }).exec()
  return waitJob
}

/**
 * @function methodMySQL
 * @description Waits for the MySQL service to be up and running
 * @param {*} waitJob
 * @param {*} RC
 */
async function methodMySQL (waitJob, RC) {
  // make connection to MySQL using `knex`
  const knex = require('knex')({
    client: RC.DATABASE.DIALECT,
    connection: {
      host: RC.DATABASE.HOST.replace(/\/$/, ''),
      port: RC.DATABASE.PORT,
      user: RC.DATABASE.USER,
      password: RC.DATABASE.PASSWORD,
      database: RC.DATABASE.SCHEMA
    }
  })
  await knex.select(1)

  return waitJob
}

// TODO: update auth-service config to be standardized like other services
/**
 * @function methodMySQLAlt
 * @description Waits for the MySQL service to be up and running based on deprecated config files
 * @param {*} waitJob
 * @param {*} RC
 */
async function methodMySQLAlt (waitJob, RC) {
  // make connection to MySQL using `knex`
  const knex = require('knex')({
    client: RC.DATABASE.client,
    connection: {
      host: RC.DATABASE.connection.host.replace(/\/$/, ''),
      port: RC.DATABASE.connection.port,
      user: RC.DATABASE.connection.user,
      password: RC.DATABASE.connection.password,
      database: RC.DATABASE.connection.database
    }
  })
  await knex.select(1)

  return waitJob
}

/**
 * @function methodNCat
 * @description checks is any TCP network stream up on given host:port
 * @param {*} waitJob
 * @param {*} RC
 */
async function methodNCat (waitJob) {
  const [host, port] = waitJob.uri.toString().split(':').map(x => x.trim())
  const { execSync } = require('child_process')
  const command = `nc -z ${host} ${port}`
  execSync(command)
  return waitJob
}
