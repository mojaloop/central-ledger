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

 * Claudio Viola <claudio.viola@modusbox.com>
 * Lazola Lucas <lazola.lucas@modusbox.com>
 * Shashikant Hirugade <shashikant.hirugade@modusbox.com>

 --------------
 ******/

'use strict'
const _ = require('lodash')
const fs = require('fs')
const vm = require('vm')
const path = require('path')
const { logger } = require('../shared/logger')
const ErrorHandler = require('@mojaloop/central-services-error-handling')
const scriptEngine = require('./scriptEngine')
const Enum = require('@mojaloop/central-services-shared').Enum

function loadScripts (scriptDirectory) {
  const scriptsMap = {}
  const scriptDirectoryPath = path.join(process.cwd(), scriptDirectory)
  let scriptFiles
  try {
    scriptFiles = fs.readdirSync(scriptDirectoryPath)
    scriptFiles = scriptFiles.filter(fileName => {
      return fs.statSync(path.join(scriptDirectoryPath, fileName)).isFile()
    })
  } catch (err) {
    logger.error(`Error loading scripts from : ${scriptDirectoryPath}`, err)
    return scriptsMap
  }
  for (const scriptFile of scriptFiles) {
    const scriptSource = fs.readFileSync(fs.realpathSync(scriptDirectoryPath + '/' + scriptFile), 'utf8')
    const scriptLines = scriptSource.split(/\r?\n/)
    retrieveScriptConfiguration(scriptLines, scriptsMap, scriptFile, scriptSource)
  }
  return scriptsMap
}

/**
 * [executeScripts Execute a script from the scriptsmap given a scriptType, scriptAction and scriptStatus providing the payload as argument]
 * @param  {[type]}  scriptsMap   [The object containing all loaded scripts]
 * @param  {[String]}  scriptType [The topic type of the script to run]
 * @param  {[type]}  scriptAction [The topic action of the script to run]
 * @param  {[type]}  scriptStatus [The Topic status of the script to run]
 * @param  {[type]}  payload      [description]
 * @return {Promise}              [description]
 */
async function executeScripts (scriptsMap, scriptType, scriptAction, scriptStatus, payload) {
  try {
    const scriptResults = {}
    if (scriptsMap[scriptType] && scriptsMap[scriptType][scriptAction] && scriptsMap[scriptType][scriptAction][scriptStatus]) {
      const now = new Date()
      for (const script of scriptsMap[scriptType][scriptAction][scriptStatus]) {
        if (now.getTime() >= script.startTime.getTime() && now.getTime() <= script.endTime.getTime()) {
          logger.debug(`Running script: ${JSON.stringify(script)}`)
          const scriptResult = await executeScript(script.script, payload)
          logger.debug(`Merging script result: ${scriptResult}`)
          _.mergeWith(scriptResults, scriptResult, (objValue, srcValue) => {
            if (_.isArray(objValue)) {
              return objValue.concat(srcValue)
            }
          })
        }
      }
    }
    return scriptResults
  } catch (err) {
    const error = ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR, 'Script execution was unsuccessful')
    logger.error(error)
    throw error
  }
}

async function executeScript (script, payload) {
  try {
    return await scriptEngine.execute(script, payload)
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

function retrieveScriptConfiguration (scriptLines, scriptsMap, scriptFile, scriptSource) {
  for (let i = 0; i < scriptLines.length; i++) {
    if (scriptLines[i].startsWith('// Type:')) {
      const scriptType = scriptLines[i].split(':').pop().trim()
      const scriptAction = scriptLines[i + 1].split(':').pop().trim()
      const scriptStatus = scriptLines[i + 2].split(':').pop().trim()
      const scriptStart = scriptLines[i + 3].substring(scriptLines[i + 3].indexOf(':') + 1).trim()
      const scriptEnd = scriptLines[i + 4].substring(scriptLines[i + 4].indexOf(':') + 1).trim()
      logger.info(`Rules file: ${scriptFile}: Type: ${scriptType}, Action: ${scriptAction}, Status: ${scriptStatus}, Start: ${scriptStart}, End: ${scriptEnd}`)

      if (Object.values(Enum.Events.Event.Type).indexOf(scriptType) === -1) {
        const errorMessage = `Rules file: ${scriptFile}: has invalid or missing header 'Type'`
        logger.error(errorMessage)
        throw new Error(errorMessage)
      }
      if (Object.values(Enum.Events.Event.Action).indexOf(scriptAction) === -1) {
        const errorMessage = `Rules file: ${scriptFile}: has invalid or missing header 'Action'`
        logger.error(errorMessage)
        throw new Error(errorMessage)
      }
      if (Object.values(Enum.Events.EventState).indexOf(scriptStatus) === -1) {
        const errorMessage = `Rules file: ${scriptFile}: has invalid or missing header 'Status'`
        logger.error(errorMessage)
        throw new Error(errorMessage)
      }
      if (new Date(scriptStart).toString() === 'Invalid Date') {
        const errorMessage = `Rules file: ${scriptFile}: has invalid or missing header 'Start'`
        logger.error(errorMessage)
        throw new Error(errorMessage)
      }
      if (new Date(scriptEnd).toString() === 'Invalid Date') {
        const errorMessage = `Rules file: ${scriptFile}: has invalid or missing header 'End'`
        logger.error(errorMessage)
        throw new Error(errorMessage)
      }

      let compiledScript
      try {
        compiledScript = new vm.Script(scriptSource)
      } catch (error) {
        const errorMessage = `Rules file: ${scriptFile}: is not a valid JavaScript file`
        logger.error(errorMessage)
        throw new Error(errorMessage)
      }

      const script = {
        filename: scriptFile,
        startTime: new Date(scriptStart),
        endTime: new Date(scriptEnd),
        script: compiledScript
      }
      const scriptMap = {}
      scriptMap[scriptType] = {}
      scriptMap[scriptType][scriptAction] = {}
      scriptMap[scriptType][scriptAction][scriptStatus] = [script]
      logger.info(`Loading script: ${scriptFile}: ${JSON.stringify(script)}`)
      _.mergeWith(scriptsMap, scriptMap, (objValue, srcValue) => {
        if (_.isArray(objValue)) {
          return objValue.concat(srcValue)
        }
      })
      break
    }
  }
}

module.exports = {
  executeScripts,
  loadScripts
}
