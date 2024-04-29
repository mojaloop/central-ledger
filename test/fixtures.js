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

 * Eugen Klymniuk <eugen.klymniuk@infitx.com>
 --------------
 **********/

const { randomUUID } = require('node:crypto')
const { Enum } = require('@mojaloop/central-services-shared')

const ILP_PACKET = 'AYIBgQAAAAAAAASwNGxldmVsb25lLmRmc3AxLm1lci45T2RTOF81MDdqUUZERmZlakgyOVc4bXFmNEpLMHlGTFGCAUBQU0svMS4wCk5vbmNlOiB1SXlweUYzY3pYSXBFdzVVc05TYWh3CkVuY3J5cHRpb246IG5vbmUKUGF5bWVudC1JZDogMTMyMzZhM2ItOGZhOC00MTYzLTg0NDctNGMzZWQzZGE5OGE3CgpDb250ZW50LUxlbmd0aDogMTM1CkNvbnRlbnQtVHlwZTogYXBwbGljYXRpb24vanNvbgpTZW5kZXItSWRlbnRpZmllcjogOTI4MDYzOTEKCiJ7XCJmZWVcIjowLFwidHJhbnNmZXJDb2RlXCI6XCJpbnZvaWNlXCIsXCJkZWJpdE5hbWVcIjpcImFsaWNlIGNvb3BlclwiLFwiY3JlZGl0TmFtZVwiOlwibWVyIGNoYW50XCIsXCJkZWJpdElkZW50aWZpZXJcIjpcIjkyODA2MzkxXCJ9IgA'
const CONDITION = '8x04dj-RKEtfjStajaKXKJ5eL1mWm9iG2ltEKvEDOHc'
const FULFILMENT = 'uz0FAeutW6o8Mz7OmJh8ALX6mmsZCcIDOqtE01eo4uI'

const DFSP1_ID = 'dfsp1'
const DFSP2_ID = 'dfsp2'
const FXP_ID = 'fxp'
const SWITCH_ID = 'switch'

const TOPICS = Object.freeze({
  notificationEvent: 'topic-notification-event',
  transferPosition: 'topic-transfer-position',
  transferFulfil: 'topic-transfer-fulfil'
})
// think, how to define TOPICS dynamically (based on TOPIC_TEMPLATES.GENERAL_TOPIC_TEMPLATE)

const extensionListDto = ({
  key = 'key1',
  value = 'value1'
} = {}) => ({
  extensionList: {
    extension: [
      { key, value }
    ]
  }
})

const fulfilPayloadDto = ({
  fulfilment = FULFILMENT,
  transferState = 'RECEIVED',
  completedTimestamp = new Date().toISOString(),
  extensionList = extensionListDto()
} = {}) => ({
  fulfilment,
  transferState,
  completedTimestamp,
  extensionList
})

const fxFulfilPayloadDto = ({
  fulfilment = FULFILMENT,
  conversionState = 'RECEIVED',
  completedTimestamp = new Date().toISOString(),
  extensionList = extensionListDto()
} = {}) => ({
  fulfilment,
  conversionState,
  completedTimestamp,
  extensionList
})

const fulfilContentDto = ({
  payload = fulfilPayloadDto(),
  transferId = randomUUID(),
  from = DFSP1_ID,
  to = DFSP2_ID
} = {}) => ({
  payload,
  uriParams: {
    id: transferId
  },
  headers: {
    'fspiop-source': from,
    'fspiop-destination': to,
    'content-type': 'application/vnd.interoperability.transfers+json;version=1.1'
  }
})

const fxFulfilContentDto = ({
  payload = fxFulfilPayloadDto(),
  commitRequestId = randomUUID(),
  from = FXP_ID,
  to = DFSP1_ID
} = {}) => ({
  payload,
  uriParams: {
    id: commitRequestId
  },
  headers: {
    'fspiop-source': from,
    'fspiop-destination': to,
    'content-type': 'application/vnd.interoperability.fxTransfers+json;version=2.0'
  }
})

const fulfilMetadataDto = ({
  id = randomUUID(), // think, how it relates to other ids
  type = 'fulfil',
  action = 'commit'
} = {}) => ({
  event: {
    id,
    type,
    action,
    createdAt: new Date()
  }
})

const metadataEventStateDto = ({
  status = 'success',
  code = 0,
  description = 'action successful'
} = {}) => ({
  status,
  code,
  description
})

const createKafkaMessage = ({
  id = randomUUID(),
  from = DFSP1_ID,
  to = DFSP2_ID,
  content = fulfilContentDto({ from, to }),
  metadata = fulfilMetadataDto(),
  topic = 'topic-transfer-fulfil'
}) => ({
  topic,
  value: {
    id,
    from,
    to,
    content,
    metadata,
    type: 'application/json',
    pp: ''
  }
})

const fulfilKafkaMessageDto = ({
  id = randomUUID(),
  from = DFSP1_ID,
  to = DFSP2_ID,
  content = fulfilContentDto({ from, to }),
  metadata = fulfilMetadataDto(),
  topic
} = {}) => createKafkaMessage({
  id,
  from,
  to,
  content,
  metadata,
  topic
})

const fxFulfilKafkaMessageDto = ({
  id = randomUUID(),
  from = FXP_ID,
  to = DFSP1_ID,
  content = fxFulfilContentDto({ from, to }),
  metadata = fulfilMetadataDto(),
  topic
} = {}) => createKafkaMessage({
  id,
  from,
  to,
  content,
  metadata,
  topic
})

const amountDto = ({
  currency = 'BWP',
  amount = '300.33'
} = {}) => ({ currency, amount })

const errorInfoDto = ({
  errorCode = 5104,
  errorDescription = 'Transfer rejection error'
} = {}) => ({
  errorInformation: {
    errorCode,
    errorDescription
  }
})

const transferDto = ({
  transferId = randomUUID(),
  payerFsp = DFSP1_ID,
  payeeFsp = DFSP2_ID,
  amount = amountDto(),
  ilpPacket = ILP_PACKET,
  condition = CONDITION,
  expiration = new Date().toISOString(),
  extensionList = extensionListDto()
} = {}) => ({
  transferId,
  payerFsp,
  payeeFsp,
  amount,
  ilpPacket,
  condition,
  expiration,
  extensionList
})

const fxTransferDto = ({
  commitRequestId = randomUUID(),
  determiningTransferId = randomUUID(),
  initiatingFsp = DFSP1_ID,
  counterPartyFsp = FXP_ID,
  amountType = 'SEND',
  sourceAmount = amountDto({ currency: 'BWP', amount: '300.33' }),
  targetAmount = amountDto({ currency: 'TZS', amount: '48000' }),
  condition = CONDITION,
  expiration = new Date(Date.now() + (24 * 60 * 60 * 1000))
} = {}) => ({
  commitRequestId,
  determiningTransferId,
  initiatingFsp,
  counterPartyFsp,
  amountType,
  sourceAmount,
  targetAmount,
  condition,
  expiration
})

const fxtGetAllDetailsByCommitRequestIdDto = ({
  commitRequestId,
  determiningTransferId,
  sourceAmount,
  targetAmount,
  condition,
  initiatingFsp,
  counterPartyFsp
} = fxTransferDto()) => ({
  commitRequestId,
  determiningTransferId,
  sourceAmount: sourceAmount.amount,
  sourceCurrency: sourceAmount.currency,
  targetAmount: targetAmount.amount,
  targetCurrency: targetAmount.currency,
  ilpCondition: condition,
  initiatingFspName: initiatingFsp,
  initiatingFspParticipantId: 1,
  initiatingFspParticipantCurrencyId: 11,
  counterPartyFspName: counterPartyFsp,
  counterPartyFspParticipantId: 2,
  counterPartyFspTargetParticipantCurrencyId: 22,
  counterPartyFspSourceParticipantCurrencyId: 33,
  transferState: Enum.Transfers.TransferState.RESERVED,
  transferStateEnumeration: 'RECEIVED', // or RECEIVED_FULFIL?
  fulfilment: FULFILMENT,
  // todo: add other fields from getAllDetailsByCommitRequestId real response
  expirationDate: new Date(),
  createdDate: new Date()
})

// todo: add proper format
const fxFulfilResponseDto = ({
  savePayeeTransferResponseExecuted = true,
  fxTransferFulfilmentRecord = {},
  fxTransferStateChangeRecord = {}
} = {}) => ({
  savePayeeTransferResponseExecuted,
  fxTransferFulfilmentRecord,
  fxTransferStateChangeRecord
})

const watchListItemDto = ({
  fxWatchList = 100,
  commitRequestId = 'commitRequestId',
  determiningTransferId = 'determiningTransferId',
  fxTransferTypeId = 'fxTransferTypeId',
  createdDate = new Date()
} = {}) => ({
  fxWatchList,
  commitRequestId,
  determiningTransferId,
  fxTransferTypeId,
  createdDate
})

module.exports = {
  ILP_PACKET,
  CONDITION,
  FULFILMENT,
  DFSP1_ID,
  DFSP2_ID,
  FXP_ID,
  SWITCH_ID,
  TOPICS,

  fulfilKafkaMessageDto,
  fulfilMetadataDto,
  fulfilContentDto,
  fulfilPayloadDto,
  metadataEventStateDto,
  errorInfoDto,
  extensionListDto,
  amountDto,
  transferDto,
  fxFulfilKafkaMessageDto,
  fxFulfilPayloadDto,
  fxFulfilContentDto,
  fxTransferDto,
  fxFulfilResponseDto,
  fxtGetAllDetailsByCommitRequestIdDto,
  watchListItemDto
}
