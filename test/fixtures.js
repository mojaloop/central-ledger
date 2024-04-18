const { randomUUID } = require('node:crypto')
const { Enum } = require('@mojaloop/central-services-shared')

const ILP_PACKET = 'AYIBgQAAAAAAAASwNGxldmVsb25lLmRmc3AxLm1lci45T2RTOF81MDdqUUZERmZlakgyOVc4bXFmNEpLMHlGTFGCAUBQU0svMS4wCk5vbmNlOiB1SXlweUYzY3pYSXBFdzVVc05TYWh3CkVuY3J5cHRpb246IG5vbmUKUGF5bWVudC1JZDogMTMyMzZhM2ItOGZhOC00MTYzLTg0NDctNGMzZWQzZGE5OGE3CgpDb250ZW50LUxlbmd0aDogMTM1CkNvbnRlbnQtVHlwZTogYXBwbGljYXRpb24vanNvbgpTZW5kZXItSWRlbnRpZmllcjogOTI4MDYzOTEKCiJ7XCJmZWVcIjowLFwidHJhbnNmZXJDb2RlXCI6XCJpbnZvaWNlXCIsXCJkZWJpdE5hbWVcIjpcImFsaWNlIGNvb3BlclwiLFwiY3JlZGl0TmFtZVwiOlwibWVyIGNoYW50XCIsXCJkZWJpdElkZW50aWZpZXJcIjpcIjkyODA2MzkxXCJ9IgA'
const CONDITION = 'YlK5TZyhflbXaDRPtR5zhCu8FrbgvrQwwmzuH0iQ0AI'
const FULLFILMENT = 'oAKAAA'

const DFSP1_ID = 'dfsp1'
const DFSP2_ID = 'dfsp2'
const FXP_ID = 'fxp'
const SWITCH_ID = 'switch'

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
  fulfilment = FULLFILMENT,
  transferState = 'RECEIVED',
  completedTimestamp = new Date().toISOString(),
  extensionList = extensionListDto()
} = {}) => ({
  fulfilment,
  transferState,
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

const fulfilMetadataDto = ({
  id = randomUUID(), //  todo: think, how it relates to other ids
  type = 'fulfil',
  action = 'commit'
} = {}) => Object.freeze({
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

const fulfilKafkaMessageDto = ({
  id = randomUUID(),
  from = DFSP1_ID,
  to = DFSP2_ID,
  content = fulfilContentDto({ from, to }),
  metadata = fulfilMetadataDto(),
  topic = 'test-topic'
} = {}) => ({
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
  condition = CONDITION
} = {}) => ({
  commitRequestId,
  determiningTransferId,
  initiatingFsp,
  counterPartyFsp,
  amountType,
  sourceAmount,
  targetAmount,
  condition
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
  fulfilment: FULLFILMENT,
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
  FULLFILMENT,
  DFSP1_ID,
  DFSP2_ID,
  FXP_ID,
  SWITCH_ID,

  fulfilKafkaMessageDto,
  fulfilMetadataDto,
  fulfilContentDto,
  fulfilPayloadDto,
  metadataEventStateDto,
  errorInfoDto,
  extensionListDto,
  amountDto,
  transferDto,
  fxTransferDto,
  fxFulfilResponseDto,
  fxtGetAllDetailsByCommitRequestIdDto,
  watchListItemDto
}
