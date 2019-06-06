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
 --------------
 ******/

'use strict'

const endpointTypes = [
  {
    'name': 'ALARM_NOTIFICATION_URL',
    'description': 'Participant callback URL to which alarm notifications can be sent'
  },
  {
    'name': 'ALARM_NOTIFICATION_TOPIC',
    'description': 'Kafka topic used to publish alarm notifications'
  },
  {
    'name': 'FSPIOP_CALLBACK_URL_TRANSFER_POST',
    'description': 'Participant callback URL to which transfer post can be sent'
  },
  {
    'name': 'FSPIOP_CALLBACK_URL_TRANSFER_PUT',
    'description': 'Participant callback URL to which transfer put can be sent'
  },
  {
    'name': 'FSPIOP_CALLBACK_URL_TRANSFER_ERROR',
    'description': 'Participant callback URL to which transfer error notifications can be sent'
  },
  {
    'name': 'NET_DEBIT_CAP_THRESHOLD_BREACH_EMAIL',
    'description': 'Participant/Hub operator email address to which the net debit cap breach e-mail notification can be sent'
  },
  {
    'name': 'NET_DEBIT_CAP_ADJUSTMENT_EMAIL',
    'description': 'Participant/Hub operator email address to which the net debit cap adjustment e-mail notification can be sent'
  },
  {
    'name': 'SETTLEMENT_TRANSFER_POSITION_CHANGE_EMAIL',
    'description': 'Participant/Hub operator email address to which the position change due to settlement transfer e-mail notification can be sent'
  },
  {
    'name': 'FSPIOP_CALLBACK_URL_PARTICIPANT_PUT',
    'description': 'Participant callback URL to which put participant information can be sent'
  },
  {
    'name': 'FSPIOP_CALLBACK_URL_PARTIES_GET',
    'description': 'Participant callback URL to which get parties information can be requested'
  },
  {
    'name': 'FSPIOP_CALLBACK_URL_PARTICIPANT_PUT_ERROR',
    'description': 'Participant callback URL to which put participant error information can be sent'
  },
  {
    'name': 'FSPIOP_CALLBACK_URL_PARTICIPANT_BATCH_PUT',
    'description': 'Participant callback URL to which put batch participant information can be sent'
  },
  {
    'name': 'FSPIOP_CALLBACK_URL_PARTICIPANT_BATCH_PUT_ERROR',
    'description': 'Participant callback URL to which put batch participant error information can be sent'
  },
  {
    'name': 'FSPIOP_CALLBACK_URL_PARTIES_PUT',
    'description': 'Parties callback URL to which put participant information can be sent'
  },
  {
    'name': 'FSPIOP_CALLBACK_URL_PARTIES_PUT_ERROR',
    'description': 'Parties callback URL to which put participant error information can be sent'
  },
  {
    'name': 'FSPIOP_CALLBACK_URL_QUOTES',
    'description': 'Quotes callback URL to which put quotes requests can be sent'
  }
]

exports.seed = async function (knex) {
  try {
    return await knex('endpointType').insert(endpointTypes)
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return -1001
    else {
      console.log(`Uploading seeds for endpointType has failed with the following error: ${err}`)
      return -1000
    }
  }
}
