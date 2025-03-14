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

 * Georgi Georgiev <georgi.georgiev@modusbox.com>
 * Shashikant Hirugade <shashikant.hirugade@modusbox.com>
 --------------
 ******/

'use strict'

const { FspEndpointTypes } = require('@mojaloop/central-services-shared').Enum.EndPoints

const endpointTypes = [
  {
    name: 'ALARM_NOTIFICATION_URL',
    description: 'Participant callback URL to which alarm notifications can be sent'
  },
  {
    name: 'ALARM_NOTIFICATION_TOPIC',
    description: 'Kafka topic used to publish alarm notifications'
  },
  {
    name: 'FSPIOP_CALLBACK_URL_TRANSFER_POST',
    description: 'Participant callback URL to which transfer post can be sent'
  },
  {
    name: 'FSPIOP_CALLBACK_URL_TRANSFER_PUT',
    description: 'Participant callback URL to which transfer put can be sent'
  },
  {
    name: 'FSPIOP_CALLBACK_URL_TRANSFER_ERROR',
    description: 'Participant callback URL to which transfer error notifications can be sent'
  },
  {
    name: FspEndpointTypes.FSPIOP_CALLBACK_URL_FX_QUOTES,
    description: 'Participant callback URL to which FX quote requests can be sent'
  },
  {
    name: FspEndpointTypes.FSPIOP_CALLBACK_URL_FX_TRANSFER_POST,
    description: 'Participant callback URL to which FX transfer post can be sent'
  },
  {
    name: FspEndpointTypes.FSPIOP_CALLBACK_URL_FX_TRANSFER_PUT,
    description: 'Participant callback URL to which FX transfer put can be sent'
  },
  {
    name: FspEndpointTypes.FSPIOP_CALLBACK_URL_FX_TRANSFER_ERROR,
    description: 'Participant callback URL to which FX transfer error notifications can be sent'
  },
  {
    name: 'NET_DEBIT_CAP_THRESHOLD_BREACH_EMAIL',
    description: 'Participant/Hub operator email address to which the net debit cap breach e-mail notification can be sent'
  },
  {
    name: 'NET_DEBIT_CAP_ADJUSTMENT_EMAIL',
    description: 'Participant/Hub operator email address to which the net debit cap adjustment e-mail notification can be sent'
  },
  {
    name: 'SETTLEMENT_TRANSFER_POSITION_CHANGE_EMAIL',
    description: 'Participant/Hub operator email address to which the position change due to settlement transfer e-mail notification can be sent'
  },
  {
    name: 'FSPIOP_CALLBACK_URL_PARTICIPANT_PUT',
    description: 'Participant callback URL to which put participant information can be sent'
  },
  {
    name: 'FSPIOP_CALLBACK_URL_PARTICIPANT_SUB_ID_PUT',
    description: 'Participant callback URL to which put participant information can be sent, when subId is specified'
  },
  {
    name: 'FSPIOP_CALLBACK_URL_PARTICIPANT_PUT_ERROR',
    description: 'Participant callback URL to which put participant error information can be sent'
  },
  {
    name: 'FSPIOP_CALLBACK_URL_PARTICIPANT_SUB_ID_PUT_ERROR',
    description: 'Participant callback URL to which put participant error information can be sent, when subId is specified'
  },
  {
    name: 'FSPIOP_CALLBACK_URL_PARTICIPANT_DELETE',
    description: 'Participant callback URL to which delete participant information can be sent'
  },
  {
    name: 'FSPIOP_CALLBACK_URL_PARTICIPANT_SUB_ID_DELETE',
    description: 'Participant callback URL to which delete participant information can be sent, when subId is specified'
  },
  {
    name: 'FSPIOP_CALLBACK_URL_PARTICIPANT_BATCH_PUT',
    description: 'Participant callback URL to which put batch participant information can be sent'
  },
  {
    name: 'FSPIOP_CALLBACK_URL_PARTICIPANT_BATCH_PUT_ERROR',
    description: 'Participant callback URL to which put batch participant error information can be sent'
  },
  {
    name: 'FSPIOP_CALLBACK_URL_PARTIES_GET',
    description: 'Parties callback URL to which get parties information can be requested'
  },
  {
    name: 'FSPIOP_CALLBACK_URL_PARTIES_SUB_ID_GET',
    description: 'Parties callback URL to which get parties information can be requested'
  },
  {
    name: 'FSPIOP_CALLBACK_URL_PARTIES_PUT',
    description: 'Parties callback URL to which put parties information can be sent'
  },
  {
    name: 'FSPIOP_CALLBACK_URL_PARTIES_SUB_ID_PUT',
    description: 'Parties callback URL to which put parties information can be sent when SubId is specified'
  },
  {
    name: 'FSPIOP_CALLBACK_URL_PARTIES_PUT_ERROR',
    description: 'Parties callback URL to which put participant error information can be sent'
  },
  {
    name: 'FSPIOP_CALLBACK_URL_PARTIES_SUB_ID_PUT_ERROR',
    description: 'Parties callback URL to which put parties error information can be sent when SubId is specified'
  },
  {
    name: 'FSPIOP_CALLBACK_URL_QUOTES',
    description: 'Quotes callback URL to which put quotes requests can be sent'
  },
  {
    name: 'FSPIOP_CALLBACK_URL_BULK_TRANSFER_POST',
    description: 'Participant callback URL to which bulk transfer post can be sent'
  },
  {
    name: 'FSPIOP_CALLBACK_URL_BULK_TRANSFER_PUT',
    description: 'Participant callback URL to which bulk transfer put can be sent'
  },
  {
    name: 'FSPIOP_CALLBACK_URL_BULK_TRANSFER_ERROR',
    description: 'Participant callback URL to which bulk transfer error notifications can be sent'
  },
  {
    name: 'FSPIOP_CALLBACK_URL_AUTHORIZATIONS',
    description: 'Participant callback URL to which authorization requests can be sent'
  },
  {
    name: 'FSPIOP_CALLBACK_URL_TRX_REQ_SERVICE',
    description: 'Participant callback URL to which transaction requests can be sent'
  },
  {
    name: 'FSPIOP_CALLBACK_URL_BULK_QUOTES',
    description: 'Bulk Quotes callback URL to which put bulkQuotes requests can be sent'
  },
  {
    name: 'TP_CB_URL_TRANSACTION_REQUEST_GET',
    description: 'Participant callback URL where GET /thirdpartyRequests/transactions/{ID} can be sent'
  },
  {
    name: 'TP_CB_URL_TRANSACTION_REQUEST_POST',
    description: 'Participant callback URL where POST /thirdpartyRequests/transactions can be sent'
  },
  {
    name: 'TP_CB_URL_TRANSACTION_REQUEST_PUT',
    description: 'Participant callback URL where PUT /thirdpartyRequests/transactions/{ID} can be sent'
  },
  {
    name: 'TP_CB_URL_TRANSACTION_REQUEST_PUT_ERROR',
    description: 'Participant callback URL to which PUT /thirdpartyRequests/transactions/{ID}/error error information can be sent'
  },
  {
    name: 'TP_CB_URL_TRANSACTION_REQUEST_PATCH',
    description: 'Participant callback URL where PATCH /thirdpartyRequests/transactions/{ID} can be sent'
  },
  {
    name: 'TP_CB_URL_TRANSACTION_REQUEST_AUTH_POST',
    description: 'Participant callback URL where POST /thirdpartyRequests/transactions/{ID}/authorizations can be sent'
  },
  {
    name: 'TP_CB_URL_TRANSACTION_REQUEST_AUTH_PUT',
    description: 'Participant callback URL where PUT /thirdpartyRequests/transactions/{ID}/authorizations can be sent'
  },
  {
    name: 'TP_CB_URL_TRANSACTION_REQUEST_AUTH_PUT_ERROR',
    description: 'Participant callback URL where PUT /thirdpartyRequests/transactions/{ID}/authorizations/error error information can be sent'
  },
  {
    name: 'TP_CB_URL_TRANSACTION_REQUEST_VERIFY_POST',
    description: 'Participant callback URL where POST /thirdpartyRequests/verifications can be sent'
  },
  {
    name: 'TP_CB_URL_TRANSACTION_REQUEST_VERIFY_PUT',
    description: 'Participant callback URL where PUT /thirdpartyRequests/verifications/{ID} can be sent'
  },
  {
    name: 'TP_CB_URL_TRANSACTION_REQUEST_VERIFY_PUT_ERROR',
    description: 'Participant callback URL where PUT /thirdpartyRequests/verifications/{ID}/error can be sent'
  },
  {
    name: 'TP_CB_URL_CONSENT_REQUEST_POST',
    description: 'Participant callback URL where POST /consentRequests can be sent'
  },
  {
    name: 'TP_CB_URL_CONSENT_REQUEST_PUT',
    description: 'Participant callback URL where PUT /consentRequests/{ID} can be sent'
  },
  {
    name: 'TP_CB_URL_CONSENT_REQUEST_PUT_ERROR',
    description: 'Participant callback URL where PUT /consentRequests/{ID}/error error information can be sent'
  },
  {
    name: 'TP_CB_URL_CONSENT_REQUEST_PATCH',
    description: 'Participant callback URL where PATCH /consentRequests/{ID} can be sent'
  },
  {
    name: 'TP_CB_URL_CONSENT_REQUEST_PUT_ERROR',
    description: 'Participant callback URL where PUT /consentRequests/{ID}/error error information can be sent'
  },
  {
    name: 'TP_CB_URL_CREATE_CREDENTIAL_POST',
    description: 'Participant callback URL where POST /consentRequests/{ID}/createCredential can be sent'
  },
  {
    name: 'TP_CB_URL_CONSENT_POST',
    description: 'Participant callback URL where POST /consents/ can be sent'
  },
  {
    name: 'TP_CB_URL_CONSENT_GET',
    description: 'Participant callback URL where GET /consents/{ID} can be sent'
  },
  {
    name: 'TP_CB_URL_CONSENT_PUT',
    description: 'Participant callback URL where PUT /consents/{ID} can be sent'
  },
  {
    name: 'TP_CB_URL_CONSENT_PATCH',
    description: 'Participant callback URL where PATCH /consents/{ID} can be sent'
  },
  {
    name: 'TP_CB_URL_CONSENT_PUT_ERROR',
    description: 'Participant callback URL where PUT /consents/{ID}/error error information can be sent'
  },
  {
    name: 'TP_CB_URL_CONSENT_GENERATE_CHALLENGE_POST',
    description: 'Participant callback URL where POST /consents/{ID}/generateChallenge can be sent'
  },
  {
    name: 'TP_CB_URL_CONSENT_GENERATE_CHALLENGE_PUT_ERROR',
    description: 'Participant callback URL where PUT /consents/{ID}/generateChallenge/error error information can be sent'
  },
  {
    name: 'TP_CB_URL_ACCOUNTS_GET',
    description: 'Accounts callback URL where GET /accounts/{ID} can be sent'
  },
  {
    name: 'TP_CB_URL_ACCOUNTS_PUT',
    description: 'Accounts callback URL where PUT /accounts/{ID} can be sent'
  },
  {
    name: 'TP_CB_URL_ACCOUNTS_PUT_ERROR',
    description: 'Accounts callback URL where PUT /accounts/{ID}/error error information can be sent'
  },
  {
    name: 'TP_CB_URL_SERVICES_GET',
    description: 'Participant callback URL where GET /services/{ServiceType} can be sent'
  },
  {
    name: 'TP_CB_URL_SERVICES_PUT',
    description: 'Participant callback URL where PUT /services/{ServiceType} can be sent'
  },
  {
    name: 'TP_CB_URL_SERVICES_PUT_ERROR',
    description: 'Participant callback URL where PUT /services/{ServiceType}/error can be sent'
  }
]

exports.seed = async function (knex) {
  try {
    return await knex('endpointType').insert(endpointTypes).onConflict('name').ignore()
  } catch (err) {
    console.log(`Uploading seeds for endpointType has failed with the following error: ${err}`)
    return -1000
  }
}
