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
 * @module src/handlers/lib/kafka
 */

const CronJob = require('cron').CronJob
const Logger = require('@mojaloop/central-services-shared').Logger
const Config = require('../../../lib/config')
const DAO = require('../dao')
const Consumer = require('./consumer')
const Utility = require('../../lib/utility')
// const RegisterHandlers = require('../../../handlers/register')
const Enum = require('../../../lib/enum')
const TransferEventType = Enum.transferEventType
const TransferEventAction = Enum.transferEventAction

let jobList = {}

/**
 * @function registerNewPrepareHandlersTask
 *
 * @description Function to register new Prepare Handlers for any newly on-boarded FSPs.
 */
const registerNewPrepareHandlersTask = async () => {
  let handlerType = 'prepare'
  Logger.info(`lib.Kafka.Cron.registerNewHandlers running task for handlerType: ${handlerType}...`)
  let participantNamesList = null

  try {
    participantNamesList = await DAO.retrieveAllParticipants()
  } catch (err) {
    Logger.error(`lib.Kafka.Cron.registerNewHandlers is unable to retrieve new participants: ${err}`)
  }
  if (participantNamesList && Array.isArray(participantNamesList)) {
    for (let participantName of participantNamesList) {
      // lets check to see if there is a Prepare Consumer for this partiticipant
      let kafkaPrepareTopic = Utility.transformAccountToTopicName(participantName, TransferEventType.TRANSFER, TransferEventAction.PREPARE)
      let isConsumerForPrepareTopicExist = false
      try {
        if (Consumer.getConsumer(kafkaPrepareTopic)) {
          isConsumerForPrepareTopicExist = true
        }
      } catch (err) {
        Logger.debug(`lib.Kafka.Cron.registerNewHandlers - participant ${participantName} for topic ${kafkaPrepareTopic} does not exist: ${err}`)
        isConsumerForPrepareTopicExist = false
      }

      if (!isConsumerForPrepareTopicExist) {
        Logger.info(`lib.Kafka.Cron.registerNewHandlers - Registering new PrepareHandler for participant ${participantName} for topic ${kafkaPrepareTopic} `)
        const RegisterHandlers = require('../../register')
        await RegisterHandlers.transfers.registerPrepareHandlers([participantName])
      }
    }
  } else {
    Logger.error(`lib.Kafka.Cron.registerNewHandlers - participantNamesList not a valid list. Skipping job for handlerType: ${handlerType}.`)
  }
}

/**
 * @function registerNewPositionHandlersTask
 *
 * @description Function to register new Position Handlers for any newly on-boarded FSPs.
 */
const registerNewPositionHandlersTask = async () => {
  let handlerType = 'position'
  Logger.info(`lib.Kafka.Cron.registerNewHandlers running task for handlerType: ${handlerType}...`)
  let participantNamesList = null

  try {
    participantNamesList = await DAO.retrieveAllParticipants()
  } catch (err) {
    Logger.error(`lib.Kafka.Cron.registerNewHandlers is unable to retrieve new participants: ${err}`)
  }
  if (participantNamesList && Array.isArray(participantNamesList)) {
    for (let participantName of participantNamesList) {
      // lets check to see if there is a Prepare Consumer for this partiticipant
      let kafkaPositionTopicList = [
        Utility.transformAccountToTopicName(participantName, TransferEventType.POSITION, TransferEventAction.ABORT),
        Utility.transformAccountToTopicName(participantName, TransferEventType.POSITION, TransferEventType.FULFIL),
        Utility.transformAccountToTopicName(participantName, TransferEventType.POSITION, TransferEventAction.PREPARE)
      ]

      for (let kafkaPositionTopic of kafkaPositionTopicList) {
        let isConsumerForPositionTopicExist = false
        try {
          if (Consumer.getConsumer(kafkaPositionTopic)) {
            isConsumerForPositionTopicExist = true
          }
        } catch (err) {
          Logger.debug(`lib.Kafka.Cron.registerNewHandlers - participant ${participantName} for topic ${kafkaPositionTopic}  does not exist: ${err}`)
          isConsumerForPositionTopicExist = false
        }

        if (!isConsumerForPositionTopicExist) {
          Logger.info(`lib.Kafka.Cron.registerNewHandlers - Registering new PositionHandler for participant ${participantName} for topic ${kafkaPositionTopic} `)
          const RegisterHandlers = require('../../register')
          await RegisterHandlers.positions.registerPositionHandlers([participantName])
        }
      }
    }
  } else {
    Logger.error(`lib.Kafka.Cron.registerNewHandlers - participantNamesList not a valid list. Skipping job for handlerType: ${handlerType}.`)
  }
}

/**
 * @function isRunning
 *
 * @description Function to determine if the CronJob is running
 *
 * @returns {boolean} Returns true if the CronJob is running
 */
const isRunning = async (handlerType) => {
  let job = jobList[handlerType]
  if (job) {
    return job.running
  }
  return false
}

/**
 * @function start
 *
 * @description Function to determine if the CronJob is running
 *
 * @returns {boolean} Returns true if the CronJob is running
 */
const start = async (handlerType) => {
  let job = jobList[handlerType]
  if (job) {
    await stop(handlerType)
  }

  let funcTask
  switch (handlerType) {
    case 'prepare':
      funcTask = registerNewPrepareHandlersTask
      break
    case 'position':
      funcTask = registerNewPositionHandlersTask
      break
    default:
      throw new Error(`lib.Kafka.Cron.registerNewHandlers - unable to start CronJob with handlerType: ${handlerType}`)
  }

  job = new CronJob({
    cronTime: Config.HANDLERS_CRON_TIMEXP,
    onTick: funcTask,
    start: false,
    timeZone: Config.HANDLERS_CRON_TIMEZONE
  })

  jobList[handlerType] = job

  await job.start()
}

/**
 * @function stop
 *
 * @description Function to determine if the CronJob is running
 *
 * @returns {boolean} Returns true if the CronJob is running
 */
const stop = async (handlerType) => {
  let job = jobList[handlerType]
  if (job) {
    await job.destroy()
    jobList[handlerType] = undefined
  }
}

// /**
//  * Class JobError - custom error class for Job related errors.
//  * @extends Error
//  */
// class JobError extends Error {
//   constructor (...params) {
//     // Calling parent constructor of base Error class.
//     super(...params)
//
//     // Saving class name in the property of our custom error as a shortcut.
//     this.name = this.constructor.name
//
//     // Maintains proper stack trace for where our error was thrown (only available on V8)
//     if (Error.captureStackTrace) {
//       Error.captureStackTrace(this, JobError)
//     }
//
//     this.message(`lib.Kafka.Cron.registerNewHandlers - ${params.message}`)
//   }
// }

module.exports = {
  isRunning,
  start,
  stop
}
