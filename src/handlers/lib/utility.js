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

 * Georgi Georgiev <georgi.georgiev@modusbox.com>
 * Shashikant Hirugade <shashikant.hirugade@modusbox.com>
 * Rajiv Mothilal <rajiv.mothilal@modusbox.com>
 * Miguel de Barros <miguel.debarros@modusbox.com>

 --------------
 ******/

'use strict'

/**
 * @module src/handlers/lib
 */

const Config = require('../../lib/config')
const Utility = require('@mojaloop/central-services-shared').Util
const Enum = require('@mojaloop/central-services-shared').Enum
const decodePayload = require('@mojaloop/central-services-stream').Kafka.Protocol.decodePayload

const proceed = async (params, opts) => {
  const { message, kafkaTopic, consumer } = params
  const { consumerCommit, histTimerEnd, fspiopError, producer, fromSwitch, toDestination } = opts
  let metadataState

  if (consumerCommit) {
    await Utility.Kafka.commitMessageSync(kafkaTopic, consumer, message)
  }
  if (fspiopError) {
    if (!message.value.content.uriParams || !message.value.content.uriParams.id) {
      message.value.content.uriParams = { id: decodePayload(params.message.value.content.payload).transferId }
    }

    message.value.content.payload = fspiopError
    metadataState = Utility.StreamingProtocol.createEventState(Enum.Events.EventStatus.FAILURE.status, fspiopError.errorInformation.errorCode, fspiopError.errorInformation.errorDescription)
  } else {
    metadataState = Enum.Events.EventStatus.SUCCESS
  }
  if (fromSwitch) {
    message.value.to = message.value.from
    message.value.from = Enum.headers.FSPIOP.SWITCH
  }
  if (producer) {
    const p = producer
    const key = toDestination && message.value.content.headers[Enum.headers.FSPIOP.DESTINATION]
    await Utility.Kafka.produceGeneralMessage(Config.KAFKA_CONFIG, p.functionality, p.action, message.value, metadataState, key)
  }
  if (histTimerEnd && typeof histTimerEnd === 'function') {
    histTimerEnd({ success: true, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
  }
  return true
}

module.exports = {
  proceed
}
