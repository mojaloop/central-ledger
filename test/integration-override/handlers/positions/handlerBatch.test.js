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

 * Vijay Kumar Guthi <vijaya.guthi@infitx.com>
 --------------
 **********/

'use strict'

const Test = require('tape')
const { randomUUID } = require('crypto')
const Logger = require('@mojaloop/central-services-logger')
const Config = require('#src/lib/config')
const ProxyCache = require('#src/lib/proxyCache')
const Db = require('../../../../src/lib/db')
const Cache = require('#src/lib/cache')
const { Producer, Consumer } = require('@mojaloop/central-services-stream').Util
const Utility = require('@mojaloop/central-services-shared').Util.Kafka
const Enum = require('@mojaloop/central-services-shared').Enum
const ParticipantHelper = require('#test/integration/helpers/participant')
const ParticipantLimitHelper = require('#test/integration/helpers/participantLimit')
const ParticipantFundsInOutHelper = require('#test/integration/helpers/participantFundsInOut')
const ParticipantEndpointHelper = require('#test/integration/helpers/participantEndpoint')
const SettlementHelper = require('#test/integration/helpers/settlementModels')
const HubAccountsHelper = require('#test/integration/helpers/hubAccounts')
const TransferService = require('#src/domain/transfer/index')
const FxTransferModels = require('#src/models/fxTransfer/index')
const ParticipantService = require('#src/domain/participant/index')
const Util = require('@mojaloop/central-services-shared').Util
const ErrorHandler = require('@mojaloop/central-services-error-handling')
const MLNumber = require('@mojaloop/ml-number')
const {
  wrapWithRetries
} = require('#test/util/helpers')
const TestConsumer = require('#test/integration/helpers/testConsumer')

const ParticipantCached = require('#src/models/participant/participantCached')
const ParticipantCurrencyCached = require('#src/models/participant/participantCurrencyCached')
const ParticipantLimitCached = require('#src/models/participant/participantLimitCached')
const SettlementModelCached = require('#src/models/settlement/settlementModelCached')

const Handlers = {
  index: require('#src/handlers/register'),
  positions: require('#src/handlers/positions/handler'),
  positionsBatch: require('#src/handlers/positions/handlerBatch'),
  transfers: require('#src/handlers/transfers/handler'),
  timeouts: require('#src/handlers/timeouts/handler')
}

const TransferState = Enum.Transfers.TransferState
const TransferInternalState = Enum.Transfers.TransferInternalState
const TransferEventType = Enum.Events.Event.Type
const TransferEventAction = Enum.Events.Event.Action

const debug = process?.env?.skip_INT_DEBUG || false
// const rebalanceDelay = process?.env?.skip_INT_REBALANCE_DELAY || 10000
const retryDelay = process?.env?.skip_INT_RETRY_DELAY || 2
const retryCount = process?.env?.skip_INT_RETRY_COUNT || 40
const retryOpts = {
  retries: retryCount,
  minTimeout: retryDelay,
  maxTimeout: retryDelay
}

const testData = {
  currencies: ['USD', 'XXX'],
  transfers: [
    {
      amount: {
        currency: 'USD',
        amount: 5
      }
    },
    {
      amount: {
        currency: 'USD',
        amount: 5
      }
    },
    {
      amount: {
        currency: 'USD',
        amount: 5
      }
    },
    {
      amount: {
        currency: 'USD',
        amount: 5
      }
    },
    {
      amount: {
        currency: 'USD',
        amount: 5
      }
    },
    {
      amount: {
        currency: 'USD',
        amount: 5
      }
    },
    {
      amount: {
        currency: 'USD',
        amount: 5
      }
    },
    {
      amount: {
        currency: 'USD',
        amount: 5
      }
    },
    {
      amount: {
        currency: 'USD',
        amount: 5
      }
    },
    {
      amount: {
        currency: 'USD',
        amount: 5
      }
    }
  ],
  payer: {
    name: 'payerFsp',
    limit: 1000,
    number: 2,
    fundsIn: 10000
  },
  payee: {
    name: 'payeeFsp',
    number: 2,
    limit: 1000
  },
  endpoint: {
    base: 'http://localhost:1080',
    email: 'test@example.com'
  },
  now: new Date(),
  expiration: new Date((new Date()).getTime() + (24 * 60 * 60 * 1000)) // tomorrow
}

const testFxData = {
  currencies: ['USD', 'XXX'],
  transfers: [
    {
      amount: {
        currency: 'USD',
        amount: 5
      },
      fx: {
        targetAmount: {
          currency: 'XXX',
          amount: 50
        }
      }
    },
    {
      amount: {
        currency: 'USD',
        amount: 5
      },
      fx: {
        targetAmount: {
          currency: 'XXX',
          amount: 50
        }
      }
    },
    {
      amount: {
        currency: 'USD',
        amount: 5
      },
      fx: {
        targetAmount: {
          currency: 'XXX',
          amount: 50
        }
      }
    },
    {
      amount: {
        currency: 'USD',
        amount: 5
      },
      fx: {
        targetAmount: {
          currency: 'XXX',
          amount: 50
        }
      }
    },
    {
      amount: {
        currency: 'USD',
        amount: 5
      },
      fx: {
        targetAmount: {
          currency: 'XXX',
          amount: 50
        }
      }
    },
    {
      amount: {
        currency: 'USD',
        amount: 5
      },
      fx: {
        targetAmount: {
          currency: 'XXX',
          amount: 50
        }
      }
    },
    {
      amount: {
        currency: 'USD',
        amount: 5
      },
      fx: {
        targetAmount: {
          currency: 'XXX',
          amount: 50
        }
      }
    },
    {
      amount: {
        currency: 'USD',
        amount: 5
      },
      fx: {
        targetAmount: {
          currency: 'XXX',
          amount: 50
        }
      }
    },
    {
      amount: {
        currency: 'USD',
        amount: 5
      },
      fx: {
        targetAmount: {
          currency: 'XXX',
          amount: 50
        }
      }
    },
    {
      amount: {
        currency: 'USD',
        amount: 5
      },
      fx: {
        targetAmount: {
          currency: 'XXX',
          amount: 50
        }
      }
    }
  ],
  payer: {
    name: 'payerFsp',
    limit: 1000,
    number: 1,
    fundsIn: 10000
  },
  payee: {
    name: 'payeeFsp',
    number: 1,
    limit: 1000
  },
  fxp: {
    name: 'testFxp',
    number: 1,
    limit: 1000
  },
  endpoint: {
    base: 'http://localhost:1080',
    email: 'test@example.com'
  },
  now: new Date(),
  expiration: new Date((new Date()).getTime() + (24 * 60 * 60 * 1000)) // tomorrow
}

const testDataLimitExceeded = {
  currencies: ['USD', 'XXX'],
  transfers: [
    {
      amount: {
        currency: 'USD',
        amount: 5
      }
    },
    {
      amount: {
        currency: 'USD',
        amount: 5
      }
    },
    {
      amount: {
        currency: 'USD',
        amount: 5
      }
    },
    {
      amount: {
        currency: 'USD',
        amount: 5
      }
    },
    {
      amount: {
        currency: 'USD',
        amount: 5
      }
    },
    {
      amount: {
        currency: 'USD',
        amount: 5
      }
    },
    {
      amount: {
        currency: 'USD',
        amount: 5
      }
    },
    {
      amount: {
        currency: 'USD',
        amount: 5
      }
    },
    {
      amount: {
        currency: 'USD',
        amount: 5
      }
    },
    {
      amount: {
        currency: 'USD',
        amount: 5
      }
    }
  ],
  payer: {
    name: 'payerFsp',
    limit: 1, // Limit set low
    number: 1,
    fundsIn: 10000
  },
  payee: {
    name: 'payeeFsp',
    number: 2,
    limit: 0
  },
  endpoint: {
    base: 'http://localhost:1080',
    email: 'test@example.com'
  },
  now: new Date(),
  expiration: new Date((new Date()).getTime() + (24 * 60 * 60 * 1000)) // tomorrow
}

const testDataLimitNoLiquidity = {
  currencies: ['USD', 'XXX'],
  transfers: [
    {
      amount: {
        currency: 'XXX',
        amount: 5
      }
    },
    {
      amount: {
        currency: 'XXX',
        amount: 5
      }
    },
    {
      amount: {
        currency: 'XXX',
        amount: 5
      }
    },
    {
      amount: {
        currency: 'XXX',
        amount: 5
      }
    },
    {
      amount: {
        currency: 'XXX',
        amount: 5
      }
    },
    {
      amount: {
        currency: 'XXX',
        amount: 5
      }
    },
    {
      amount: {
        currency: 'XXX',
        amount: 5
      }
    },
    {
      amount: {
        currency: 'XXX',
        amount: 5
      }
    },
    {
      amount: {
        currency: 'XXX',
        amount: 5
      }
    },
    {
      amount: {
        currency: 'XXX',
        amount: 5
      }
    }
  ],
  payer: {
    name: 'payerFsp',
    limit: 10000,
    number: 1,
    fundsIn: 1 // Low liquidity
  },
  payee: {
    name: 'payeeFsp',
    number: 2,
    limit: 0
  },
  endpoint: {
    base: 'http://localhost:1080',
    email: 'test@example.com'
  },
  now: new Date(),
  expiration: new Date((new Date()).getTime() + (24 * 60 * 60 * 1000)) // tomorrow
}

const testDataMixedWithLimitExceeded = {
  currencies: ['USD', 'XXX'],
  transfers: [
    {
      amount: {
        currency: 'USD',
        amount: 5
      }
    },
    {
      amount: {
        currency: 'USD',
        amount: 5000
      }
    },
    {
      amount: {
        currency: 'USD',
        amount: 6
      }
    }
  ],
  payer: {
    name: 'payerFsp',
    limit: 1000,
    number: 1,
    fundsIn: 10000
  },
  payee: {
    name: 'payeeFsp',
    number: 2,
    limit: 1000
  },
  endpoint: {
    base: 'http://localhost:1080',
    email: 'test@example.com'
  },
  now: new Date(),
  expiration: new Date((new Date()).getTime() + (24 * 60 * 60 * 1000)) // tomorrow
}

const testDataWithMixedCurrencies = {
  currencies: ['USD', 'XXX'],
  transfers: [
    {
      amount: {
        currency: 'USD',
        amount: 2
      }
    },
    {
      amount: {
        currency: 'XXX',
        amount: 3
      }
    },
    {
      amount: {
        currency: 'USD',
        amount: 4
      }

    },
    {
      amount: {
        currency: 'XXX',
        amount: 5
      }

    },
    {
      amount: {
        currency: 'USD',
        amount: 6
      }

    },
    {
      amount: {
        currency: 'XXX',
        amount: 7
      }

    },
    {
      amount: {
        currency: 'USD',
        amount: 8
      }

    },
    {
      amount: {
        currency: 'XXX',
        amount: 9
      }

    }
  ],
  payer: {
    name: 'payerFsp',
    limit: 1000,
    number: 1,
    fundsIn: 10000
  },
  payee: {
    name: 'payeeFsp',
    number: 2,
    limit: 1000
  },
  endpoint: {
    base: 'http://localhost:1080',
    email: 'test@example.com'
  },
  now: new Date(),
  expiration: new Date((new Date()).getTime() + (24 * 60 * 60 * 1000)) // tomorrow
}

const _endpointSetup = async (participantName, baseURL) => {
  await ParticipantEndpointHelper.prepareData(participantName, 'FSPIOP_CALLBACK_URL_TRANSFER_POST', `${baseURL}/transfers`)
  await ParticipantEndpointHelper.prepareData(participantName, 'FSPIOP_CALLBACK_URL_TRANSFER_PUT', `${baseURL}/transfers/{{transferId}}`)
  await ParticipantEndpointHelper.prepareData(participantName, 'FSPIOP_CALLBACK_URL_TRANSFER_ERROR', `${baseURL}/transfers/{{transferId}}/error`)
  await ParticipantEndpointHelper.prepareData(participantName, 'FSPIOP_CALLBACK_URL_BULK_TRANSFER_POST', `${baseURL}/bulkTransfers`)
  await ParticipantEndpointHelper.prepareData(participantName, 'FSPIOP_CALLBACK_URL_BULK_TRANSFER_PUT', `${baseURL}/bulkTransfers/{{id}}`)
  await ParticipantEndpointHelper.prepareData(participantName, 'FSPIOP_CALLBACK_URL_BULK_TRANSFER_ERROR', `${baseURL}/bulkTransfers/{{id}}/error`)
  await ParticipantEndpointHelper.prepareData(participantName, 'FSPIOP_CALLBACK_URL_QUOTES', `${baseURL}`)
  await ParticipantEndpointHelper.prepareData(participantName, Enum.EndPoints.FspEndpointTypes.FSPIOP_CALLBACK_URL_FX_QUOTES, `${baseURL}`)
  await ParticipantEndpointHelper.prepareData(participantName, Enum.EndPoints.FspEndpointTypes.FSPIOP_CALLBACK_URL_FX_TRANSFER_POST, `${baseURL}/fxTransfers`)
  await ParticipantEndpointHelper.prepareData(participantName, Enum.EndPoints.FspEndpointTypes.FSPIOP_CALLBACK_URL_FX_TRANSFER_PUT, `${baseURL}/fxTransfers/{{commitRequestId}}`)
  await ParticipantEndpointHelper.prepareData(participantName, Enum.EndPoints.FspEndpointTypes.FSPIOP_CALLBACK_URL_FX_TRANSFER_ERROR, `${baseURL}/fxTransfers/{{commitRequestId}}/error`)
}

const prepareTestData = async (dataObj) => {
  try {
    const payerList = []
    const payeeList = []
    const fxpList = []

    // Create Payers
    for (let i = 0; i < dataObj.payer.number; i++) {
      // Create payer
      const payer = await ParticipantHelper.prepareData(dataObj.payer.name, dataObj.currencies[0], dataObj.currencies[1])
      // limit,initial position and funds in
      payer.payerLimitAndInitialPosition = await ParticipantLimitHelper.prepareLimitAndInitialPosition(payer.participant.name, {
        currency: dataObj.currencies[0],
        limit: { value: dataObj.payer.limit }
      })
      payer.payerLimitAndInitialPositionSecondaryCurrency = await ParticipantLimitHelper.prepareLimitAndInitialPosition(payer.participant.name, {
        currency: dataObj.currencies[1],
        limit: { value: dataObj.payer.limit }
      })
      await ParticipantFundsInOutHelper.recordFundsIn(payer.participant.name, payer.participantCurrencyId2, {
        currency: dataObj.currencies[0],
        amount: dataObj.payer.fundsIn
      })
      await ParticipantFundsInOutHelper.recordFundsIn(payer.participant.name, payer.participantCurrencyIdSecondary2, {
        currency: dataObj.currencies[1],
        amount: dataObj.payer.fundsIn
      })
      // endpoint setup
      await _endpointSetup(payer.participant.name, dataObj.endpoint.base)

      payerList.push(payer)
    }

    // Create Payees
    for (let i = 0; i < dataObj.payee.number; i++) {
      // Create payee
      const payee = await ParticipantHelper.prepareData(dataObj.payee.name, dataObj.currencies[0], dataObj.currencies[1])
      // limit,initial position
      payee.payeeLimitAndInitialPosition = await ParticipantLimitHelper.prepareLimitAndInitialPosition(payee.participant.name, {
        currency: dataObj.currencies[0],
        limit: { value: dataObj.payee.limit }
      })
      payee.payeeLimitAndInitialPositionSecondaryCurrency = await ParticipantLimitHelper.prepareLimitAndInitialPosition(payee.participant.name, {
        currency: dataObj.currencies[1],
        limit: { value: dataObj.payee.limit }
      })
      // endpoint setup
      await _endpointSetup(payee.participant.name, dataObj.endpoint.base)
      payeeList.push(payee)
    }

    // Create FXPs

    if (dataObj.fxp) {
      for (let i = 0; i < dataObj.fxp.number; i++) {
        // Create payer
        const fxp = await ParticipantHelper.prepareData(dataObj.fxp.name, dataObj.currencies[0], dataObj.currencies[1])
        // limit,initial position and funds in
        fxp.payerLimitAndInitialPosition = await ParticipantLimitHelper.prepareLimitAndInitialPosition(fxp.participant.name, {
          currency: dataObj.currencies[0],
          limit: { value: dataObj.fxp.limit }
        })
        fxp.payerLimitAndInitialPositionSecondaryCurrency = await ParticipantLimitHelper.prepareLimitAndInitialPosition(fxp.participant.name, {
          currency: dataObj.currencies[1],
          limit: { value: dataObj.fxp.limit }
        })
        await ParticipantFundsInOutHelper.recordFundsIn(fxp.participant.name, fxp.participantCurrencyId2, {
          currency: dataObj.currencies[0],
          amount: dataObj.fxp.fundsIn
        })
        await ParticipantFundsInOutHelper.recordFundsIn(fxp.participant.name, fxp.participantCurrencyIdSecondary2, {
          currency: dataObj.currencies[1],
          amount: dataObj.fxp.fundsIn
        })
        // endpoint setup
        await _endpointSetup(fxp.participant.name, dataObj.endpoint.base)

        fxpList.push(fxp)
      }
    }

    // Create payloads for number of transfers
    const transfersArray = []
    for (let i = 0; i < dataObj.transfers.length; i++) {
      const payer = payerList[i % payerList.length]
      const payee = payeeList[i % payeeList.length]
      const fxp = fxpList.length > 0 ? fxpList[i % fxpList.length] : payee

      const transferPayload = {
        transferId: randomUUID(),
        payerFsp: payer.participant.name,
        payeeFsp: payee.participant.name,
        amount: {
          currency: dataObj.transfers[i].amount.currency,
          amount: dataObj.transfers[i].amount.amount
        },
        ilpPacket: 'AYIBgQAAAAAAAASwNGxldmVsb25lLmRmc3AxLm1lci45T2RTOF81MDdqUUZERmZlakgyOVc4bXFmNEpLMHlGTFGCAUBQU0svMS4wCk5vbmNlOiB1SXlweUYzY3pYSXBFdzVVc05TYWh3CkVuY3J5cHRpb246IG5vbmUKUGF5bWVudC1JZDogMTMyMzZhM2ItOGZhOC00MTYzLTg0NDctNGMzZWQzZGE5OGE3CgpDb250ZW50LUxlbmd0aDogMTM1CkNvbnRlbnQtVHlwZTogYXBwbGljYXRpb24vanNvbgpTZW5kZXItSWRlbnRpZmllcjogOTI4MDYzOTEKCiJ7XCJmZWVcIjowLFwidHJhbnNmZXJDb2RlXCI6XCJpbnZvaWNlXCIsXCJkZWJpdE5hbWVcIjpcImFsaWNlIGNvb3BlclwiLFwiY3JlZGl0TmFtZVwiOlwibWVyIGNoYW50XCIsXCJkZWJpdElkZW50aWZpZXJcIjpcIjkyODA2MzkxXCJ9IgA',
        condition: 'GRzLaTP7DJ9t4P-a_BA0WA9wzzlsugf00-Tn6kESAfM',
        expiration: dataObj.expiration,
        extensionList: {
          extension: [
            {
              key: 'key1',
              value: 'value1'
            },
            {
              key: 'key2',
              value: 'value2'
            }
          ]
        }
      }

      const fxTransferPayload = {
        commitRequestId: randomUUID(),
        determiningTransferId: randomUUID(),
        initiatingFsp: payer.participant.name,
        counterPartyFsp: fxp.participant.name,
        sourceAmount: {
          currency: dataObj.transfers[i].amount.currency,
          amount: dataObj.transfers[i].amount.amount.toString()
        },
        targetAmount: {
          currency: dataObj.transfers[i].fx?.targetAmount.currency || dataObj.transfers[i].amount.currency,
          amount: dataObj.transfers[i].fx?.targetAmount.amount.toString() || dataObj.transfers[i].amount.amount.toString()
        },
        condition: 'GRzLaTP7DJ9t4P-a_BA0WA9wzzlsugf00-Tn6kESAfM',
        expiration: dataObj.expiration
      }

      const fxFulfilPayload = {
        fulfilment: 'UNlJ98hZTY_dsw0cAqw4i_UN3v4utt7CZFB4yfLbVFA',
        completedTimestamp: dataObj.now,
        conversionState: 'RESERVED',
        extensionList: {
          extension: []
        }
      }

      const prepareHeaders = {
        'fspiop-source': payer.participant.name,
        'fspiop-destination': fxp.participant.name,
        'content-type': 'application/vnd.interoperability.transfers+json;version=1.1'
      }
      const fxPrepareHeaders = {
        'fspiop-source': payer.participant.name,
        'fspiop-destination': fxp.participant.name,
        'content-type': 'application/vnd.interoperability.fxtransfers+json;version=2.0'
      }
      const fxFulfilHeaders = {
        'fspiop-source': fxp.participant.name,
        'fspiop-destination': payer.participant.name,
        'content-type': 'application/vnd.interoperability.fxtransfers+json;version=2.0'
      }
      const fulfilAbortRejectHeaders = {
        'fspiop-source': payee.participant.name,
        'fspiop-destination': payer.participant.name,
        'content-type': 'application/vnd.interoperability.transfers+json;version=1.1'
      }

      const fulfilPayload = {
        fulfilment: 'UNlJ98hZTY_dsw0cAqw4i_UN3v4utt7CZFB4yfLbVFA',
        completedTimestamp: dataObj.now,
        transferState: 'COMMITTED',
        extensionList: {
          extension: []
        }
      }

      const fulfilPayloadReserved = {
        fulfilment: 'UNlJ98hZTY_dsw0cAqw4i_UN3v4utt7CZFB4yfLbVFA',
        completedTimestamp: dataObj.now,
        transferState: 'RESERVED',
        extensionList: {
          extension: []
        }
      }

      const rejectPayload = Object.assign({}, fulfilPayload, { transferState: TransferInternalState.ABORTED_REJECTED })

      const errorPayload = ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.PAYEE_FSP_REJECTED_TXN).toApiErrorObject()
      errorPayload.errorInformation.extensionList = { extension: [{ key: 'errorDetail', value: 'This is an abort extension' }] }

      const messageProtocolPrepare = {
        id: randomUUID(),
        from: transferPayload.payerFsp,
        to: transferPayload.payeeFsp,
        type: 'application/json',
        content: {
          headers: prepareHeaders,
          payload: transferPayload
        },
        metadata: {
          event: {
            id: randomUUID(),
            type: TransferEventAction.PREPARE,
            action: TransferEventType.PREPARE,
            createdAt: dataObj.now,
            state: {
              status: 'success',
              code: 0
            }
          }
        }
      }

      const messageProtocolFxPrepare = Util.clone(messageProtocolPrepare)
      messageProtocolFxPrepare.id = randomUUID()
      messageProtocolFxPrepare.from = fxTransferPayload.initiatingFsp
      messageProtocolFxPrepare.to = fxTransferPayload.counterPartyFsp
      messageProtocolFxPrepare.content.headers = fxPrepareHeaders
      messageProtocolFxPrepare.content.uriParams = { id: fxTransferPayload.commitRequestId }
      messageProtocolFxPrepare.content.payload = fxTransferPayload
      messageProtocolFxPrepare.metadata.event.id = randomUUID()
      messageProtocolFxPrepare.metadata.event.type = TransferEventType.PREPARE
      messageProtocolFxPrepare.metadata.event.action = TransferEventAction.FX_PREPARE

      const messageProtocolFxFulfil = Util.clone(messageProtocolPrepare)
      messageProtocolFxFulfil.id = randomUUID()
      messageProtocolFxFulfil.from = fxTransferPayload.counterPartyFsp
      messageProtocolFxFulfil.to = fxTransferPayload.initiatingFsp
      messageProtocolFxFulfil.content.headers = fxFulfilHeaders
      messageProtocolFxFulfil.content.uriParams = { id: fxTransferPayload.commitRequestId }
      messageProtocolFxFulfil.content.payload = fxFulfilPayload
      messageProtocolFxFulfil.metadata.event.id = randomUUID()
      messageProtocolFxFulfil.metadata.event.type = TransferEventType.FULFIL
      messageProtocolFxFulfil.metadata.event.action = TransferEventAction.FX_RESERVE

      const messageProtocolFulfil = Util.clone(messageProtocolPrepare)
      messageProtocolFulfil.id = randomUUID()
      messageProtocolFulfil.from = transferPayload.payeeFsp
      messageProtocolFulfil.to = transferPayload.payerFsp
      messageProtocolFulfil.content.headers = fulfilAbortRejectHeaders
      messageProtocolFulfil.content.uriParams = { id: transferPayload.transferId }
      messageProtocolFulfil.content.payload = fulfilPayload
      messageProtocolFulfil.metadata.event.id = randomUUID()
      messageProtocolFulfil.metadata.event.type = TransferEventType.FULFIL
      messageProtocolFulfil.metadata.event.action = TransferEventAction.COMMIT

      const messageProtocolFulfilReserved = Util.clone(messageProtocolPrepare)
      messageProtocolFulfilReserved.id = randomUUID()
      messageProtocolFulfilReserved.from = transferPayload.payeeFsp
      messageProtocolFulfilReserved.to = transferPayload.payerFsp
      messageProtocolFulfilReserved.content.headers = fulfilAbortRejectHeaders
      messageProtocolFulfilReserved.content.uriParams = { id: transferPayload.transferId }
      messageProtocolFulfilReserved.content.payload = fulfilPayloadReserved
      messageProtocolFulfilReserved.metadata.event.id = randomUUID()
      messageProtocolFulfilReserved.metadata.event.type = TransferEventType.FULFIL
      messageProtocolFulfilReserved.metadata.event.action = TransferEventAction.RESERVE

      const messageProtocolReject = Util.clone(messageProtocolFulfil)
      messageProtocolReject.id = randomUUID()
      messageProtocolFulfil.content.uriParams = { id: transferPayload.transferId }
      messageProtocolReject.content.payload = rejectPayload
      messageProtocolReject.metadata.event.action = TransferEventAction.REJECT

      const messageProtocolError = Util.clone(messageProtocolFulfil)
      messageProtocolError.id = randomUUID()
      messageProtocolFulfil.content.uriParams = { id: transferPayload.transferId }
      messageProtocolError.content.payload = errorPayload
      messageProtocolError.metadata.event.action = TransferEventAction.ABORT
      transfersArray.push({
        transferPayload,
        fxTransferPayload,
        fulfilPayload,
        rejectPayload,
        errorPayload,
        messageProtocolPrepare,
        messageProtocolFulfil,
        messageProtocolReject,
        messageProtocolError,
        messageProtocolFulfilReserved,
        messageProtocolFxPrepare,
        messageProtocolFxFulfil,
        payer,
        payee,
        fxp
      })
    }
    const topicConfTransferPrepare = Utility.createGeneralTopicConf(Config.KAFKA_CONFIG.TOPIC_TEMPLATES.GENERAL_TOPIC_TEMPLATE.TEMPLATE, TransferEventType.TRANSFER, TransferEventType.PREPARE)
    const topicConfTransferFulfil = Utility.createGeneralTopicConf(Config.KAFKA_CONFIG.TOPIC_TEMPLATES.GENERAL_TOPIC_TEMPLATE.TEMPLATE, TransferEventType.TRANSFER, TransferEventType.FULFIL)
    return {
      payerList,
      payeeList,
      fxpList,
      topicConfTransferPrepare,
      topicConfTransferFulfil,
      transfersArray
    }
  } catch (err) {
    Logger.error(err)
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

Test('Handlers test', async handlersTest => {
  const startTime = new Date()
  await Db.connect(Config.DATABASE)
  await ParticipantCached.initialize()
  await ParticipantCurrencyCached.initialize()
  await ParticipantLimitCached.initialize()
  await SettlementModelCached.initialize()
  await Cache.initCache()
  await SettlementHelper.prepareData()
  await HubAccountsHelper.prepareData()

  const wrapWithRetriesConf = {
    remainingRetries: retryOpts?.retries || 10, // default 10
    timeout: retryOpts?.maxTimeout || 2 // default 2
  }

  // Start a testConsumer to monitor events that our handlers emit
  const testConsumer = new TestConsumer([
    {
      topicName: Utility.transformGeneralTopicName(
        Config.KAFKA_CONFIG.TOPIC_TEMPLATES.GENERAL_TOPIC_TEMPLATE.TEMPLATE,
        Enum.Events.Event.Type.TRANSFER,
        Enum.Events.Event.Action.FULFIL
      ),
      config: Utility.getKafkaConfig(
        Config.KAFKA_CONFIG,
        Enum.Kafka.Config.CONSUMER,
        Enum.Events.Event.Type.TRANSFER.toUpperCase(),
        Enum.Events.Event.Action.FULFIL.toUpperCase()
      )
    },
    {
      topicName: Utility.transformGeneralTopicName(
        Config.KAFKA_CONFIG.TOPIC_TEMPLATES.GENERAL_TOPIC_TEMPLATE.TEMPLATE,
        Enum.Events.Event.Type.NOTIFICATION,
        Enum.Events.Event.Action.EVENT
      ),
      config: Utility.getKafkaConfig(
        Config.KAFKA_CONFIG,
        Enum.Kafka.Config.CONSUMER,
        Enum.Events.Event.Type.NOTIFICATION.toUpperCase(),
        Enum.Events.Event.Action.EVENT.toUpperCase()
      )
    },
    {
      topicName: Utility.transformGeneralTopicName(
        Config.KAFKA_CONFIG.TOPIC_TEMPLATES.GENERAL_TOPIC_TEMPLATE.TEMPLATE,
        Enum.Events.Event.Type.TRANSFER,
        Enum.Events.Event.Action.POSITION
      ),
      config: Utility.getKafkaConfig(
        Config.KAFKA_CONFIG,
        Enum.Kafka.Config.CONSUMER,
        Enum.Events.Event.Type.TRANSFER.toUpperCase(),
        Enum.Events.Event.Action.POSITION.toUpperCase()
      )
    }
  ])

  await handlersTest.test('setup', async setupTests => {
    await setupTests.test('start testConsumer', async (test) => {
      // Set up the testConsumer here
      await testConsumer.startListening()
      await new Promise(resolve => setTimeout(resolve, 5_000))
      testConsumer.clearEvents()

      test.pass('done')
      test.end()
      setupTests.end()
    })
  })

  await handlersTest.test('position batch handler should', async transferPositionPrepare => {
    const prepareConfig = Utility.getKafkaConfig(
      Config.KAFKA_CONFIG,
      Enum.Kafka.Config.PRODUCER,
      TransferEventType.TRANSFER.toUpperCase(),
      TransferEventType.PREPARE.toUpperCase())
    const fulfilConfig = Utility.getKafkaConfig(
      Config.KAFKA_CONFIG,
      Enum.Kafka.Config.PRODUCER,
      TransferEventType.TRANSFER.toUpperCase(),
      TransferEventType.FULFIL.toUpperCase())
    const positionConfig = Utility.getKafkaConfig(
      Config.KAFKA_CONFIG,
      Enum.Kafka.Config.PRODUCER,
      TransferEventType.TRANSFER.toUpperCase(),
      TransferEventType.POSITION.toUpperCase())
    prepareConfig.logger = Logger
    fulfilConfig.logger = Logger
    positionConfig.logger = Logger

    await transferPositionPrepare.skip('process batch of messages with mixed keys (accountIds) and update transfer state to RESERVED', async (test) => {
      // Construct test data for 10 transfers. Default object contains 10 transfers.
      const td = await prepareTestData(testData)

      // Produce prepare messages for transfersArray
      for (const transfer of td.transfersArray) {
        await Producer.produceMessage(transfer.messageProtocolPrepare, td.topicConfTransferPrepare, prepareConfig)
      }
      await new Promise(resolve => setTimeout(resolve, 5000))
      try {
        const positionPrepare = await wrapWithRetries(() => testConsumer.getEventsForFilter({
          topicFilter: 'topic-notification-event',
          action: 'prepare'
        }), wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)

        // filter positionPrepare messages where destination is not Hub
        const positionPrepareFiltered = positionPrepare.filter((notification) => notification.to !== 'Hub')
        test.equal(positionPrepareFiltered.length, 10, 'Notification Messages received for all 10 transfers')
      } catch (err) {
        test.notOk('Error should not be thrown')
        console.error(err)
      }
      const tests = async (totalTransferAmounts) => {
        for (const value of Object.values(totalTransferAmounts)) {
          const payerCurrentPosition = await ParticipantService.getPositionByParticipantCurrencyId(value.payer.participantCurrencyId) || {}
          const payerInitialPosition = value.payer.payerLimitAndInitialPosition.participantPosition.value
          const payerExpectedPosition = payerInitialPosition + value.totalTransferAmount
          const payerPositionChange = await ParticipantService.getPositionChangeByParticipantPositionId(payerCurrentPosition.participantPositionId) || {}
          test.ok(new MLNumber(payerCurrentPosition.value).isEqualTo(payerExpectedPosition), 'Payer position incremented by transfer amount and updated in participantPosition')
          test.ok(new MLNumber(payerPositionChange.value).isEqualTo(payerCurrentPosition.value), 'Payer position change value inserted and matches the updated participantPosition value')
        }
      }

      try {
        const totalTransferAmounts = {}
        for (const tdTest of td.transfersArray) {
          const transfer = await TransferService.getById(tdTest.messageProtocolPrepare.content.payload.transferId) || {}
          if (transfer?.transferState !== TransferState.RESERVED) {
            if (debug) console.log(`retrying in ${retryDelay / 1000}s..`)
            throw ErrorHandler.Factory.createFSPIOPError(
              ErrorHandler.Enums.FSPIOPErrorCodes.INTERNAL_SERVER_ERROR,
              `#1 Max retry count ${retryCount} reached after ${retryCount * retryDelay / 1000}s. Tests fail. TRANSFER STATE: ${transfer?.transferState}`
            )
          }
          totalTransferAmounts[tdTest.payer.participantCurrencyId] = {
            payer: tdTest.payer,
            totalTransferAmount: (
              (totalTransferAmounts[tdTest.payer.participantCurrencyId] &&
                totalTransferAmounts[tdTest.payer.participantCurrencyId].totalTransferAmount) || 0
            ) + tdTest.transferPayload.amount.amount
          }
        }
        await tests(totalTransferAmounts)
      } catch (err) {
        Logger.error(err)
        test.fail(err.message)
      }
      testConsumer.clearEvents()
      test.end()
    })

    await transferPositionPrepare.skip('process batch of messages with payer limit reached and update transfer state to ABORTED_REJECTED', async (test) => {
      // Construct test data for 10 transfers. Default object contains 10 transfers.
      const td = await prepareTestData(testDataLimitExceeded)

      // Produce prepare messages for transfersArray
      for (const transfer of td.transfersArray) {
        await Producer.produceMessage(transfer.messageProtocolPrepare, td.topicConfTransferPrepare, prepareConfig)
      }
      await new Promise(resolve => setTimeout(resolve, 5000))
      try {
        const positionPrepare = await wrapWithRetries(() => testConsumer.getEventsForFilter({
          topicFilter: 'topic-notification-event',
          action: 'prepare',
          errorCodeFilter: ErrorHandler.Enums.FSPIOPErrorCodes.PAYER_LIMIT_ERROR.code
        }), wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)

        // filter positionPrepare messages where destination is not Hub
        const positionPrepareFiltered = positionPrepare.filter((notification) => notification.to !== 'Hub')
        test.equal(positionPrepareFiltered.length, 10, 'Notification Messages received for all 10 transfers payer limit aborts')
      } catch (err) {
        test.notOk('Error should not be thrown')
        console.error(err)
      }

      try {
        for (const tdTest of td.transfersArray) {
          const transfer = await TransferService.getById(tdTest.messageProtocolPrepare.content.payload.transferId) || {}
          test.equal(transfer?.transferState, TransferInternalState.ABORTED_REJECTED, 'Transfer state updated to ABORTED_REJECTED')
        }
      } catch (err) {
        Logger.error(err)
        test.fail(err.message)
      }

      const payerCurrentPosition = await ParticipantService.getPositionByParticipantCurrencyId(td.transfersArray[0].payer.participantCurrencyIdSecondary) || {}
      const payerExpectedPosition = td.transfersArray[0].payer.payerLimitAndInitialPositionSecondaryCurrency.participantPosition.value
      test.ok(new MLNumber(payerCurrentPosition.value).isEqualTo(payerExpectedPosition), 'Payer position should not have changed')
      testConsumer.clearEvents()
      test.end()
    })

    await transferPositionPrepare.skip('process batch of messages with not enough liquidity and update transfer state to ABORTED_REJECTED', async (test) => {
      // Construct test data for 10 transfers. Default object contains 10 transfers.
      const td = await prepareTestData(testDataLimitNoLiquidity)

      // Produce prepare messages for transfersArray
      for (const transfer of td.transfersArray) {
        await Producer.produceMessage(transfer.messageProtocolPrepare, td.topicConfTransferPrepare, prepareConfig)
      }
      await new Promise(resolve => setTimeout(resolve, 5000))
      try {
        const positionPrepare = await wrapWithRetries(() => testConsumer.getEventsForFilter({
          topicFilter: 'topic-notification-event',
          action: 'prepare',
          errorCodeFilter: ErrorHandler.Enums.FSPIOPErrorCodes.PAYER_FSP_INSUFFICIENT_LIQUIDITY.code
        }), wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)

        // filter positionPrepare messages where destination is not Hub
        const positionPrepareFiltered = positionPrepare.filter((notification) => notification.to !== 'Hub')
        test.equal(positionPrepareFiltered.length, 10, 'Notification Messages received for all 10 transfers payer insufficient liquidity aborts')
      } catch (err) {
        test.notOk('Error should not be thrown')
        console.error(err)
      }

      try {
        for (const tdTest of td.transfersArray) {
          const transfer = await TransferService.getById(tdTest.messageProtocolPrepare.content.payload.transferId) || {}
          test.equal(transfer?.transferState, TransferInternalState.ABORTED_REJECTED, 'Transfer state updated to ABORTED_REJECTED')
        }
      } catch (err) {
        Logger.error(err)
        test.fail(err.message)
      }

      const payerCurrentPosition = await ParticipantService.getPositionByParticipantCurrencyId(td.transfersArray[0].payer.participantCurrencyIdSecondary) || {}
      const payerExpectedPosition = td.transfersArray[0].payer.payerLimitAndInitialPositionSecondaryCurrency.participantPosition.value
      test.ok(new MLNumber(payerCurrentPosition.value).isEqualTo(payerExpectedPosition), 'Payer position should not have changed')

      testConsumer.clearEvents()
      test.end()
    })

    await transferPositionPrepare.skip('process batch of messages with some transfers having amount that exceeds NDC. Those transfers should be ABORTED', async (test) => {
      // Construct test data for 10 transfers. Default object contains 10 transfers.
      const td = await prepareTestData(testDataMixedWithLimitExceeded)

      // filter out the transferId for the transfer that will be aborted
      const transferIdForLimitExceeded = td.transfersArray.filter(transfer => transfer.transferPayload.amount.amount === 5000)[0].transferPayload.transferId
      console.log('transferIdForLimitExceeded:', transferIdForLimitExceeded)

      // Produce prepare messages for transfersArray
      for (const transfer of td.transfersArray) {
        await Producer.produceMessage(transfer.messageProtocolPrepare, td.topicConfTransferPrepare, prepareConfig)
      }
      await new Promise(resolve => setTimeout(resolve, 5000))
      // Consume messages from notification topic
      const positionPrepare = await wrapWithRetries(() => testConsumer.getEventsForFilter({
        topicFilter: 'topic-notification-event',
        action: 'prepare'
      }), wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)

      // filter positionPrepare messages where destination is not Hub
      const positionPrepareFiltered = positionPrepare.filter((notification) => notification.to !== 'Hub')
      test.equal(positionPrepareFiltered.length, 3, 'Notification Messages received for all 3 transfers')

      // Check error code for the transfer that exceeded NDC
      positionPrepare.forEach((notification) => {
        console.log('notification:', notification)
        if (notification.content?.payload?.transferId === transferIdForLimitExceeded) {
          test.equal(notification.content.payload.errorInformation.errorCode, ErrorHandler.Enums.FSPIOPErrorCodes.PAYER_LIMIT_ERROR.code, 'Notification Messages received for transfer that exceeded NDC')
        }
      })

      // Check that payer position is only updated by sum of transfers that did not exceed NDC
      const payerCurrentPosition = await ParticipantService.getPositionByParticipantCurrencyId(td.transfersArray[0].payer.participantCurrencyId) || {}
      const payerExpectedPosition = testDataMixedWithLimitExceeded.transfers[0].amount.amount + testDataMixedWithLimitExceeded.transfers[2].amount.amount
      test.ok(new MLNumber(payerCurrentPosition.value).isEqualTo(payerExpectedPosition), 'Payer position should only increase by the amounts that did not exceed NDC')

      // Check that the transfer state for transfers that exceeded NDC is ABORTED_REJECTED and for transfers that did not exceed NDC is RESERVED
      try {
        for (const tdTest of td.transfersArray) {
          const transfer = await TransferService.getById(tdTest.messageProtocolPrepare.content.payload.transferId) || {}
          // check if transferId is not transferIdForLimitExceeded
          if (tdTest.messageProtocolPrepare.content.payload.transferId === transferIdForLimitExceeded) {
            test.equal(transfer?.transferState, TransferInternalState.ABORTED_REJECTED, 'Transfer state updated to ABORTED_REJECTED')
          } else {
            test.equal(transfer?.transferState, TransferInternalState.RESERVED, 'Transfer state updated to RESERVED')
          }
        }
      } catch (err) {
        Logger.error(err)
        test.fail(err.message)
      }

      testConsumer.clearEvents()
      test.end()
    })

    await transferPositionPrepare.skip('process batch of transfers with mixed currencies', async (test) => {
      // Construct test data for 10 transfers. Default object contains 10 transfers.
      const td = await prepareTestData(testDataWithMixedCurrencies)

      // Produce prepare messages for transfersArray
      for (const transfer of td.transfersArray) {
        await Producer.produceMessage(transfer.messageProtocolPrepare, td.topicConfTransferPrepare, prepareConfig)
      }
      await new Promise(resolve => setTimeout(resolve, 5000))
      // Consume messages from notification topic
      const positionPrepare = await wrapWithRetries(() => testConsumer.getEventsForFilter({
        topicFilter: 'topic-notification-event',
        action: 'prepare'
      }), wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)

      // filter positionPrepare messages where destination is not Hub
      const positionPrepareFiltered = positionPrepare.filter((notification) => notification.to !== 'Hub')
      test.equal(positionPrepareFiltered.length, 8, 'Notification Messages received for all 8 transfers')

      // Check that payer position is only updated by sum of transfers relevant to the currency
      const payerCurrentPositionForUSD = await ParticipantService.getPositionByParticipantCurrencyId(td.transfersArray[0].payer.participantCurrencyId) || {}
      const payerExpectedPositionForUSD = 20 // Sum of USD transfers in testDataWithMixedCurrencies
      test.ok(new MLNumber(payerCurrentPositionForUSD.value).isEqualTo(payerExpectedPositionForUSD), 'Payer position increases for USD transfers')

      const payerCurrentPositionForXXX = await ParticipantService.getPositionByParticipantCurrencyId(td.transfersArray[0].payer.participantCurrencyIdSecondary) || {}
      const payerExpectedPositionForXXX = 24 // Sum of XXX transfers in testDataWithMixedCurrencies
      test.ok(new MLNumber(payerCurrentPositionForXXX.value).isEqualTo(payerExpectedPositionForXXX), 'Payer position increases for XXX transfers')

      // Check that the transfer state for transfers is RESERVED
      try {
        for (const tdTest of td.transfersArray) {
          const transfer = await TransferService.getById(tdTest.messageProtocolPrepare.content.payload.transferId) || {}
          test.equal(transfer?.transferState, TransferInternalState.RESERVED, 'Transfer state updated to RESERVED')
        }
      } catch (err) {
        Logger.error(err)
        test.fail(err.message)
      }

      testConsumer.clearEvents()
      test.end()
    })

    await transferPositionPrepare.skip('process batch of fxtransfers', async (test) => {
      // Construct test data for 10 fxTransfers.
      const td = await prepareTestData(testFxData)

      // Produce fx prepare messages for transfersArray
      for (const transfer of td.transfersArray) {
        await Producer.produceMessage(transfer.messageProtocolFxPrepare, td.topicConfTransferPrepare, prepareConfig)
      }
      await new Promise(resolve => setTimeout(resolve, 5000))
      // Consume messages from notification topic
      const positionFxPrepare = await wrapWithRetries(() => testConsumer.getEventsForFilter({
        topicFilter: 'topic-notification-event',
        action: 'fx-prepare'
      }), wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)

      // filter positionFxPrepare messages where destination is not Hub
      const positionFxPrepareFiltered = positionFxPrepare.filter((notification) => notification.to !== 'Hub')
      test.equal(positionFxPrepareFiltered.length, 10, 'Notification Messages received for all 10 fxTransfers')

      // Check that initiating FSP position is only updated by sum of transfers relevant to the source currency
      const initiatingFspCurrentPositionForSourceCurrency = await ParticipantService.getPositionByParticipantCurrencyId(td.transfersArray[0].payer.participantCurrencyId) || {}
      const initiatingFspExpectedPositionForSourceCurrency = td.transfersArray.reduce((acc, tdTest) => acc + Number(tdTest.fxTransferPayload.sourceAmount.amount), 0)
      test.ok(new MLNumber(initiatingFspCurrentPositionForSourceCurrency.value).isEqualTo(initiatingFspExpectedPositionForSourceCurrency), 'Initiating FSP position increases for Source Currency')

      // Check that initiating FSP position is not updated for target currency
      const initiatingFspCurrentPositionForTargetCurrency = await ParticipantService.getPositionByParticipantCurrencyId(td.transfersArray[0].payer.participantCurrencyIdSecondary) || {}
      const initiatingFspExpectedPositionForTargetCurrency = 0
      test.ok(new MLNumber(initiatingFspCurrentPositionForTargetCurrency.value).isEqualTo(initiatingFspExpectedPositionForTargetCurrency), 'Initiating FSP position not changed for Target Currency')

      // Check that CounterParty FSP position is only updated by sum of transfers relevant to the source currency
      const counterPartyFspCurrentPositionForSourceCurrency = await ParticipantService.getPositionByParticipantCurrencyId(td.transfersArray[0].fxp.participantCurrencyId) || {}
      const counterPartyFspExpectedPositionForSourceCurrency = 0
      test.ok(new MLNumber(counterPartyFspCurrentPositionForSourceCurrency.value).isEqualTo(counterPartyFspExpectedPositionForSourceCurrency), 'CounterParty FSP position not changed for Source Currency')

      // Check that CounterParty FSP position is not updated for target currency
      const counterPartyFspCurrentPositionForTargetCurrency = await ParticipantService.getPositionByParticipantCurrencyId(td.transfersArray[0].fxp.participantCurrencyIdSecondary) || {}
      const counterPartyFspExpectedPositionForTargetCurrency = 0
      test.ok(new MLNumber(counterPartyFspCurrentPositionForTargetCurrency.value).isEqualTo(counterPartyFspExpectedPositionForTargetCurrency), 'CounterParty FSP position not changed for Target Currency')

      // Check that the fx transfer state for fxTransfers is RESERVED
      try {
        for (const tdTest of td.transfersArray) {
          const fxTransfer = await FxTransferModels.fxTransfer.getByIdLight(tdTest.fxTransferPayload.commitRequestId) || {}
          test.equal(fxTransfer?.fxTransferState, TransferInternalState.RESERVED, 'FX Transfer state updated to RESERVED')
        }
      } catch (err) {
        Logger.error(err)
        test.fail(err.message)
      }

      testConsumer.clearEvents()
      test.end()
    })

    await transferPositionPrepare.skip('process batch of transfers and fxtransfers', async (test) => {
      // Construct test data for 10 transfers / fxTransfers.
      const td = await prepareTestData(testFxData)

      // Produce prepare and fx prepare messages
      for (const transfer of td.transfersArray) {
        await Producer.produceMessage(transfer.messageProtocolPrepare, td.topicConfTransferPrepare, prepareConfig)
        await Producer.produceMessage(transfer.messageProtocolFxPrepare, td.topicConfTransferPrepare, prepareConfig)
      }

      await new Promise(resolve => setTimeout(resolve, 5000))
      // Consume messages from notification topic
      const positionPrepare = await wrapWithRetries(() => testConsumer.getEventsForFilter({
        topicFilter: 'topic-notification-event',
        action: 'prepare'
      }), wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
      const positionFxPrepare = await wrapWithRetries(() => testConsumer.getEventsForFilter({
        topicFilter: 'topic-notification-event',
        action: 'fx-prepare'
      }), wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)

      // filter positionPrepare messages where destination is not Hub
      const positionPrepareFiltered = positionPrepare.filter((notification) => notification.to !== 'Hub')
      test.equal(positionPrepareFiltered.length, 10, 'Notification Messages received for all 10 transfers')

      // filter positionFxPrepare messages where destination is not Hub
      const positionFxPrepareFiltered = positionFxPrepare.filter((notification) => notification.to !== 'Hub')
      test.equal(positionFxPrepareFiltered.length, 10, 'Notification Messages received for all 10 fxTransfers')

      // Check that payer / initiating FSP position is only updated by sum of transfers relevant to the source currency
      const payerCurrentPositionForSourceCurrency = await ParticipantService.getPositionByParticipantCurrencyId(td.transfersArray[0].payer.participantCurrencyId) || {}
      const payerExpectedPositionForSourceCurrency = td.transfersArray.reduce((acc, tdTest) => acc + Number(tdTest.transferPayload.amount.amount), 0) + td.transfersArray.reduce((acc, tdTest) => acc + Number(tdTest.fxTransferPayload.sourceAmount.amount), 0)
      test.ok(new MLNumber(payerCurrentPositionForSourceCurrency.value).isEqualTo(payerExpectedPositionForSourceCurrency), 'Payer / Initiating FSP position increases for Source Currency')

      // Check that payer / initiating FSP position is not updated for target currency
      const payerCurrentPositionForTargetCurrency = await ParticipantService.getPositionByParticipantCurrencyId(td.transfersArray[0].payer.participantCurrencyIdSecondary) || {}
      const payerExpectedPositionForTargetCurrency = 0
      test.ok(new MLNumber(payerCurrentPositionForTargetCurrency.value).isEqualTo(payerExpectedPositionForTargetCurrency), 'Payer / Initiating FSP position not changed for Target Currency')

      // Check that FXP position is only updated by sum of transfers relevant to the source currency
      const fxpCurrentPositionForSourceCurrency = await ParticipantService.getPositionByParticipantCurrencyId(td.transfersArray[0].fxp.participantCurrencyId) || {}
      const fxpExpectedPositionForSourceCurrency = 0
      test.ok(new MLNumber(fxpCurrentPositionForSourceCurrency.value).isEqualTo(fxpExpectedPositionForSourceCurrency), 'FXP position not changed for Source Currency')

      // Check that payee / CounterParty FSP position is not updated for target currency
      const fxpCurrentPositionForTargetCurrency = await ParticipantService.getPositionByParticipantCurrencyId(td.transfersArray[0].fxp.participantCurrencyIdSecondary) || {}
      const fxpExpectedPositionForTargetCurrency = 0
      test.ok(new MLNumber(fxpCurrentPositionForTargetCurrency.value).isEqualTo(fxpExpectedPositionForTargetCurrency), 'FXP position not changed for Target Currency')

      // Check that the transfer state for transfers is RESERVED
      try {
        for (const tdTest of td.transfersArray) {
          const transfer = await TransferService.getById(tdTest.messageProtocolPrepare.content.payload.transferId) || {}
          test.equal(transfer?.transferState, TransferInternalState.RESERVED, 'Transfer state updated to RESERVED')
        }
      } catch (err) {
        Logger.error(err)
        test.fail(err.message)
      }

      // Check that the fx transfer state for fxTransfers is RESERVED
      try {
        for (const tdTest of td.transfersArray) {
          const fxTransfer = await FxTransferModels.fxTransfer.getByIdLight(tdTest.fxTransferPayload.commitRequestId) || {}
          test.equal(fxTransfer?.fxTransferState, TransferInternalState.RESERVED, 'FX Transfer state updated to RESERVED')
        }
      } catch (err) {
        Logger.error(err)
        test.fail(err.message)
      }

      testConsumer.clearEvents()
      test.end()
    })

    await transferPositionPrepare.skip('process batch of prepare/commit messages with mixed keys (accountIds) and update transfer state to COMMITTED', async (test) => {
      // Construct test data for 10 transfers. Default object contains 10 transfers.
      const td = await prepareTestData(testData)

      // Produce prepare messages for transfersArray
      for (const transfer of td.transfersArray) {
        await Producer.produceMessage(transfer.messageProtocolPrepare, td.topicConfTransferPrepare, prepareConfig)
      }
      await new Promise(resolve => setTimeout(resolve, 5000))
      try {
        const positionPrepare = await wrapWithRetries(() => testConsumer.getEventsForFilter({
          topicFilter: 'topic-notification-event',
          action: 'prepare'
        }), wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)

        // filter positionPrepare messages where destination is not Hub
        const positionPrepareFiltered = positionPrepare.filter((notification) => notification.to !== 'Hub')
        test.equal(positionPrepareFiltered.length, 10, 'Notification Messages received for all 10 transfers')
      } catch (err) {
        test.notOk('Error should not be thrown')
        console.error(err)
      }
      const tests = async (totalTransferAmounts) => {
        for (const value of Object.values(totalTransferAmounts)) {
          const payerCurrentPosition = await ParticipantService.getPositionByParticipantCurrencyId(value.payer.participantCurrencyId) || {}
          const payerInitialPosition = value.payer.payerLimitAndInitialPosition.participantPosition.value
          const payerExpectedPosition = payerInitialPosition + value.totalTransferAmount
          const payerPositionChange = await ParticipantService.getPositionChangeByParticipantPositionId(payerCurrentPosition.participantPositionId) || {}
          test.ok(new MLNumber(payerCurrentPosition.value).isEqualTo(payerExpectedPosition), 'Payer position incremented by transfer amount and updated in participantPosition')
          test.ok(new MLNumber(payerPositionChange.value).isEqualTo(payerCurrentPosition.value), 'Payer position change value inserted and matches the updated participantPosition value')
        }
      }

      try {
        const totalTransferAmounts = {}
        for (const tdTest of td.transfersArray) {
          const transfer = await TransferService.getById(tdTest.messageProtocolPrepare.content.payload.transferId) || {}
          if (transfer?.transferState !== TransferState.RESERVED) {
            if (debug) console.log(`retrying in ${retryDelay / 1000}s..`)
            throw ErrorHandler.Factory.createFSPIOPError(
              ErrorHandler.Enums.FSPIOPErrorCodes.INTERNAL_SERVER_ERROR,
              `#1 Max retry count ${retryCount} reached after ${retryCount * retryDelay / 1000}s. Tests fail. TRANSFER STATE: ${transfer?.transferState}`
            )
          }
          totalTransferAmounts[tdTest.payer.participantCurrencyId] = {
            payer: tdTest.payer,
            totalTransferAmount: (
              (totalTransferAmounts[tdTest.payer.participantCurrencyId] &&
                totalTransferAmounts[tdTest.payer.participantCurrencyId].totalTransferAmount) || 0
            ) + tdTest.transferPayload.amount.amount
          }
        }
        await tests(totalTransferAmounts)
      } catch (err) {
        Logger.error(err)
        test.fail(err.message)
      }

      testConsumer.clearEvents()

      // Produce fulfil messages for transfersArray
      for (const transfer of td.transfersArray) {
        await Producer.produceMessage(transfer.messageProtocolFulfil, td.topicConfTransferFulfil, fulfilConfig)
      }
      await new Promise(resolve => setTimeout(resolve, 5000))
      try {
        const positionFulfil = await wrapWithRetries(() => testConsumer.getEventsForFilter({
          topicFilter: 'topic-notification-event',
          action: 'commit'
        }), wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)

        // filter positionFulfil messages where destination is not Hub
        const positionFulfilFiltered = positionFulfil.filter((notification) => notification.to !== 'Hub')
        test.equal(positionFulfilFiltered.length, 10, 'Notification Messages received for all 10 transfers')
      } catch (err) {
        test.notOk('Error should not be thrown')
        console.error(err)
      }

      const testsFulfil = async (totalTransferAmounts) => {
        for (const value of Object.values(totalTransferAmounts)) {
          const payeeCurrentPosition = await ParticipantService.getPositionByParticipantCurrencyId(value.payee.participantCurrencyId) || {}
          const payeeInitialPosition = value.payee.payeeLimitAndInitialPosition.participantPosition.value
          const payeeExpectedPosition = payeeInitialPosition + value.totalTransferAmount
          const payeePositionChange = await ParticipantService.getPositionChangeByParticipantPositionId(payeeCurrentPosition.participantPositionId) || {}
          test.ok(new MLNumber(payeeCurrentPosition.value).isEqualTo(payeeExpectedPosition), 'Payee position incremented by transfer amount and updated in participantPosition')
          test.ok(new MLNumber(payeePositionChange.value).isEqualTo(payeeCurrentPosition.value), 'Payee position change value inserted and matches the updated participantPosition value')
        }
      }
      try {
        const totalTransferAmounts = {}
        for (const tdTest of td.transfersArray) {
          const transfer = await TransferService.getById(tdTest.messageProtocolPrepare.content.payload.transferId) || {}
          if (transfer?.transferState !== TransferState.COMMITTED) {
            if (debug) console.log(`retrying in ${retryDelay / 1000}s..`)
            throw ErrorHandler.Factory.createFSPIOPError(
              ErrorHandler.Enums.FSPIOPErrorCodes.INTERNAL_SERVER_ERROR,
              `#1 Max retry count ${retryCount} reached after ${retryCount * retryDelay / 1000}s. Tests fail. TRANSFER STATE: ${transfer?.transferState}`
            )
          }
          totalTransferAmounts[tdTest.payee.participantCurrencyId] = {
            payee: tdTest.payee,
            totalTransferAmount: (
              (totalTransferAmounts[tdTest.payee.participantCurrencyId] &&
                totalTransferAmounts[tdTest.payee.participantCurrencyId].totalTransferAmount) || 0
            ) - tdTest.transferPayload.amount.amount
          }
        }
        await testsFulfil(totalTransferAmounts)
      } catch (err) {
        Logger.error(err)
        test.fail(err.message)
      }
      testConsumer.clearEvents()
      test.end()
    })

    await transferPositionPrepare.skip('process batch of prepare/reserve messages with mixed keys (accountIds) and update transfer state to COMMITTED', async (test) => {
      // Construct test data for 10 transfers. Default object contains 10 transfers.
      const td = await prepareTestData(testData)

      // Produce prepare messages for transfersArray
      for (const transfer of td.transfersArray) {
        await Producer.produceMessage(transfer.messageProtocolPrepare, td.topicConfTransferPrepare, prepareConfig)
      }
      await new Promise(resolve => setTimeout(resolve, 5000))
      try {
        const positionPrepare = await wrapWithRetries(() => testConsumer.getEventsForFilter({
          topicFilter: 'topic-notification-event',
          action: 'prepare'
        }), wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)

        // filter positionPrepare messages where destination is not Hub
        const positionPrepareFiltered = positionPrepare.filter((notification) => notification.to !== 'Hub')
        test.equal(positionPrepareFiltered.length, 10, 'Notification Messages received for all 10 transfers')
      } catch (err) {
        test.notOk('Error should not be thrown')
        console.error(err)
      }
      const tests = async (totalTransferAmounts) => {
        for (const value of Object.values(totalTransferAmounts)) {
          const payerCurrentPosition = await ParticipantService.getPositionByParticipantCurrencyId(value.payer.participantCurrencyId) || {}
          const payerInitialPosition = value.payer.payerLimitAndInitialPosition.participantPosition.value
          const payerExpectedPosition = payerInitialPosition + value.totalTransferAmount
          const payerPositionChange = await ParticipantService.getPositionChangeByParticipantPositionId(payerCurrentPosition.participantPositionId) || {}
          test.ok(new MLNumber(payerCurrentPosition.value).isEqualTo(payerExpectedPosition), 'Payer position incremented by transfer amount and updated in participantPosition')
          test.ok(new MLNumber(payerPositionChange.value).isEqualTo(payerCurrentPosition.value), 'Payer position change value inserted and matches the updated participantPosition value')
        }
      }

      try {
        const totalTransferAmounts = {}
        for (const tdTest of td.transfersArray) {
          const transfer = await TransferService.getById(tdTest.messageProtocolPrepare.content.payload.transferId) || {}
          if (transfer?.transferState !== TransferState.RESERVED) {
            if (debug) console.log(`retrying in ${retryDelay / 1000}s..`)
            throw ErrorHandler.Factory.createFSPIOPError(
              ErrorHandler.Enums.FSPIOPErrorCodes.INTERNAL_SERVER_ERROR,
              `#1 Max retry count ${retryCount} reached after ${retryCount * retryDelay / 1000}s. Tests fail. TRANSFER STATE: ${transfer?.transferState}`
            )
          }
          totalTransferAmounts[tdTest.payer.participantCurrencyId] = {
            payer: tdTest.payer,
            totalTransferAmount: (
              (totalTransferAmounts[tdTest.payer.participantCurrencyId] &&
                totalTransferAmounts[tdTest.payer.participantCurrencyId].totalTransferAmount) || 0
            ) + tdTest.transferPayload.amount.amount
          }
        }
        await tests(totalTransferAmounts)
      } catch (err) {
        Logger.error(err)
        test.fail(err.message)
      }

      testConsumer.clearEvents()

      // Produce fulfil messages for transfersArray
      for (const transfer of td.transfersArray) {
        await Producer.produceMessage(transfer.messageProtocolFulfilReserved, td.topicConfTransferFulfil, fulfilConfig)
      }
      await new Promise(resolve => setTimeout(resolve, 5000))
      try {
        const positionFulfil = await wrapWithRetries(() => testConsumer.getEventsForFilter({
          topicFilter: 'topic-notification-event',
          action: 'reserve'
        }), wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)

        // filter positionFulfil messages where destination is not Hub
        const positionFulfilFiltered = positionFulfil.filter((notification) => notification.to !== 'Hub')
        test.equal(positionFulfilFiltered.length, 10, 'Notification Messages received for all 10 transfers')
      } catch (err) {
        test.notOk('Error should not be thrown')
        console.error(err)
      }

      const testsFulfil = async (totalTransferAmounts) => {
        for (const value of Object.values(totalTransferAmounts)) {
          const payeeCurrentPosition = await ParticipantService.getPositionByParticipantCurrencyId(value.payee.participantCurrencyId) || {}
          const payeeInitialPosition = value.payee.payeeLimitAndInitialPosition.participantPosition.value
          const payeeExpectedPosition = payeeInitialPosition + value.totalTransferAmount
          const payeePositionChange = await ParticipantService.getPositionChangeByParticipantPositionId(payeeCurrentPosition.participantPositionId) || {}
          test.ok(new MLNumber(payeeCurrentPosition.value).isEqualTo(payeeExpectedPosition), 'Payee position incremented by transfer amount and updated in participantPosition')
          test.ok(new MLNumber(payeePositionChange.value).isEqualTo(payeeCurrentPosition.value), 'Payee position change value inserted and matches the updated participantPosition value')
        }
      }
      try {
        const totalTransferAmounts = {}
        for (const tdTest of td.transfersArray) {
          const transfer = await TransferService.getById(tdTest.messageProtocolPrepare.content.payload.transferId) || {}
          if (transfer?.transferState !== TransferState.COMMITTED) {
            if (debug) console.log(`retrying in ${retryDelay / 1000}s..`)
            throw ErrorHandler.Factory.createFSPIOPError(
              ErrorHandler.Enums.FSPIOPErrorCodes.INTERNAL_SERVER_ERROR,
              `#1 Max retry count ${retryCount} reached after ${retryCount * retryDelay / 1000}s. Tests fail. TRANSFER STATE: ${transfer?.transferState}`
            )
          }
          totalTransferAmounts[tdTest.payee.participantCurrencyId] = {
            payee: tdTest.payee,
            totalTransferAmount: (
              (totalTransferAmounts[tdTest.payee.participantCurrencyId] &&
                totalTransferAmounts[tdTest.payee.participantCurrencyId].totalTransferAmount) || 0
            ) - tdTest.transferPayload.amount.amount
          }
        }
        await testsFulfil(totalTransferAmounts)
      } catch (err) {
        Logger.error(err)
        test.fail(err.message)
      }
      testConsumer.clearEvents()
      test.end()
    })

    await transferPositionPrepare.skip('process batch of fx prepare/ fx reserve messages with mixed keys (accountIds) and update transfer state to COMMITTED', async (test) => {
      // Construct test data for 10 transfers. Default object contains 10 transfers.
      const td = await prepareTestData(testFxData)

      // Produce prepare messages for transfersArray
      for (const transfer of td.transfersArray) {
        await Producer.produceMessage(transfer.messageProtocolFxPrepare, td.topicConfTransferPrepare, prepareConfig)
      }
      await new Promise(resolve => setTimeout(resolve, 5000))
      try {
        const positionFxPrepare = await wrapWithRetries(() => testConsumer.getEventsForFilter({
          topicFilter: 'topic-notification-event',
          action: 'fx-prepare'
        }), wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)

        // filter positionPrepare messages where destination is not Hub
        const positionFxPrepareFiltered = positionFxPrepare.filter((notification) => notification.to !== 'Hub')
        test.equal(positionFxPrepareFiltered.length, 10, 'Notification Messages received for all 10 fx transfers')
      } catch (err) {
        test.notOk('Error should not be thrown')
        console.error(err)
      }
      // Check that payer / initiating FSP position is only updated by sum of transfers relevant to the source currency
      const payerCurrentPositionForSourceCurrency = await ParticipantService.getPositionByParticipantCurrencyId(td.transfersArray[0].payer.participantCurrencyId) || {}
      const payerExpectedPositionForSourceCurrency = td.transfersArray.reduce((acc, tdTest) => acc + Number(tdTest.fxTransferPayload.sourceAmount.amount), 0)
      test.ok(new MLNumber(payerCurrentPositionForSourceCurrency.value).isEqualTo(payerExpectedPositionForSourceCurrency), 'Payer / Initiating FSP position increases for Source Currency')

      // Check that payer / initiating FSP position is not updated for target currency
      const payerCurrentPositionForTargetCurrency = await ParticipantService.getPositionByParticipantCurrencyId(td.transfersArray[0].payer.participantCurrencyIdSecondary) || {}
      const payerExpectedPositionForTargetCurrency = 0
      test.ok(new MLNumber(payerCurrentPositionForTargetCurrency.value).isEqualTo(payerExpectedPositionForTargetCurrency), 'Payer / Initiating FSP position not changed for Target Currency')

      // Check that FXP position is only updated by sum of transfers relevant to the source currency
      const fxpCurrentPositionForSourceCurrency = await ParticipantService.getPositionByParticipantCurrencyId(td.transfersArray[0].fxp.participantCurrencyId) || {}
      const fxpExpectedPositionForSourceCurrency = 0
      test.ok(new MLNumber(fxpCurrentPositionForSourceCurrency.value).isEqualTo(fxpExpectedPositionForSourceCurrency), 'FXP position not changed for Source Currency')

      // Check that FXP position is not updated for target currency
      const fxpCurrentPositionForTargetCurrency = await ParticipantService.getPositionByParticipantCurrencyId(td.transfersArray[0].fxp.participantCurrencyIdSecondary) || {}
      const fxpExpectedPositionForTargetCurrency = 0
      test.ok(new MLNumber(fxpCurrentPositionForTargetCurrency.value).isEqualTo(fxpExpectedPositionForTargetCurrency), 'FXP position not changed for Target Currency')

      // Check that the fx transfer state for fxTransfers is RESERVED
      try {
        for (const tdTest of td.transfersArray) {
          const fxTransfer = await FxTransferModels.fxTransfer.getByIdLight(tdTest.fxTransferPayload.commitRequestId) || {}
          test.equal(fxTransfer?.fxTransferState, TransferInternalState.RESERVED, 'FX Transfer state updated to RESERVED')
        }
      } catch (err) {
        Logger.error(err)
        test.fail(err.message)
      }

      testConsumer.clearEvents()

      // Produce fx fulfil messages for transfersArray
      for (const transfer of td.transfersArray) {
        await Producer.produceMessage(transfer.messageProtocolFxFulfil, td.topicConfTransferFulfil, fulfilConfig)
      }
      await new Promise(resolve => setTimeout(resolve, 5000))
      try {
        const positionFxFulfil = await wrapWithRetries(() => testConsumer.getEventsForFilter({
          topicFilter: 'topic-notification-event',
          action: 'fx-reserve'
        }), wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)

        // filter positionFxFulfil messages where destination is not Hub
        const positionFxFulfilFiltered = positionFxFulfil.filter((notification) => notification.to !== 'Hub')
        test.equal(positionFxFulfilFiltered.length, 10, 'Notification Messages received for all 10 transfers')
      } catch (err) {
        test.notOk('Error should not be thrown')
        console.error(err)
      }

      // Check that payer / initiating FSP position is not updated for source currency
      const payerCurrentPositionForSourceCurrencyAfterFxFulfil = await ParticipantService.getPositionByParticipantCurrencyId(td.transfersArray[0].payer.participantCurrencyId) || {}
      test.ok(new MLNumber(payerCurrentPositionForSourceCurrencyAfterFxFulfil.value).isEqualTo(payerExpectedPositionForSourceCurrency), 'Payer / Initiating FSP position not changed for Source Currency')

      // Check that payer / initiating FSP position is not updated for target currency
      const payerCurrentPositionForTargetCurrencyAfterFxFulfil = await ParticipantService.getPositionByParticipantCurrencyId(td.transfersArray[0].payer.participantCurrencyIdSecondary) || {}
      test.ok(new MLNumber(payerCurrentPositionForTargetCurrencyAfterFxFulfil.value).isEqualTo(payerExpectedPositionForTargetCurrency), 'Payer / Initiating FSP position not changed for Target Currency')

      // Check that FXP position is only updated by sum of transfers relevant to the source currency
      const fxpCurrentPositionForSourceCurrencyAfterFxFulfil = await ParticipantService.getPositionByParticipantCurrencyId(td.transfersArray[0].fxp.participantCurrencyId) || {}
      test.ok(new MLNumber(fxpCurrentPositionForSourceCurrencyAfterFxFulfil.value).isEqualTo(fxpExpectedPositionForSourceCurrency), 'FXP position not changed for Source Currency')

      // Check that FXP position is not updated for target currency
      const fxpCurrentPositionForTargetCurrencyAfterFxFulfil = await ParticipantService.getPositionByParticipantCurrencyId(td.transfersArray[0].fxp.participantCurrencyIdSecondary) || {}
      test.ok(new MLNumber(fxpCurrentPositionForTargetCurrencyAfterFxFulfil.value).isEqualTo(fxpExpectedPositionForTargetCurrency), 'FXP position not changed for Target Currency')

      testConsumer.clearEvents()
      test.end()
    })

    await transferPositionPrepare.skip('timeout should', async timeoutTest => {
      const td = await prepareTestData(testData)

      await timeoutTest.skip('update transfer state to RESERVED by PREPARE request', async (test) => {
        // Produce prepare messages for transfersArray
        for (const transfer of td.transfersArray) {
          transfer.messageProtocolPrepare.content.payload.expiration = new Date((new Date()).getTime() + (5 * 1000)) // 4 seconds
          await Producer.produceMessage(transfer.messageProtocolPrepare, td.topicConfTransferPrepare, prepareConfig)
        }
        await new Promise(resolve => setTimeout(resolve, 2500))
        try {
          const positionPrepare = await wrapWithRetries(() => testConsumer.getEventsForFilter({
            topicFilter: 'topic-notification-event',
            action: 'prepare'
          }), wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)

          // filter positionPrepare messages where destination is not Hub
          const positionPrepareFiltered = positionPrepare.filter((notification) => notification.to !== 'Hub')
          test.equal(positionPrepareFiltered.length, 10, 'Notification Messages received for all 10 transfers')
        } catch (err) {
          test.notOk('Error should not be thrown')
          console.error(err)
        }
        const tests = async (totalTransferAmounts) => {
          for (const value of Object.values(totalTransferAmounts)) {
            const payerCurrentPosition = await ParticipantService.getPositionByParticipantCurrencyId(value.payer.participantCurrencyId) || {}
            const payerInitialPosition = value.payer.payerLimitAndInitialPosition.participantPosition.value
            const payerExpectedPosition = payerInitialPosition + value.totalTransferAmount
            const payerPositionChange = await ParticipantService.getPositionChangeByParticipantPositionId(payerCurrentPosition.participantPositionId) || {}
            test.ok(new MLNumber(payerCurrentPosition.value).isEqualTo(payerExpectedPosition), 'Payer position incremented by transfer amount and updated in participantPosition')
            test.ok(new MLNumber(payerPositionChange.value).isEqualTo(payerCurrentPosition.value), 'Payer position change value inserted and matches the updated participantPosition value')
          }
        }

        try {
          const totalTransferAmounts = {}
          for (const tdTest of td.transfersArray) {
            const transfer = await TransferService.getById(tdTest.messageProtocolPrepare.content.payload.transferId) || {}
            if (transfer?.transferState !== TransferState.RESERVED) {
              if (debug) console.log(`retrying in ${retryDelay / 1000}s..`)
              throw ErrorHandler.Factory.createFSPIOPError(
                ErrorHandler.Enums.FSPIOPErrorCodes.INTERNAL_SERVER_ERROR,
                `#1 Max retry count ${retryCount} reached after ${retryCount * retryDelay / 1000}s. Tests fail. TRANSFER STATE: ${transfer?.transferState}`
              )
            }
            totalTransferAmounts[tdTest.payer.participantCurrencyId] = {
              payer: tdTest.payer,
              totalTransferAmount: (
                (totalTransferAmounts[tdTest.payer.participantCurrencyId] &&
                  totalTransferAmounts[tdTest.payer.participantCurrencyId].totalTransferAmount) || 0
              ) + tdTest.transferPayload.amount.amount
            }
          }
          await tests(totalTransferAmounts)
        } catch (err) {
          Logger.error(err)
          test.fail(err.message)
        }
        testConsumer.clearEvents()
        test.end()
      })

      await timeoutTest.skip('update transfer after timeout with timeout status & error', async (test) => {
        for (const tf of td.transfersArray) {
          // Re-try function with conditions
          const inspectTransferState = async () => {
            try {
              // Fetch Transfer record
              const transfer = await TransferService.getById(tf.messageProtocolPrepare.content.payload.transferId) || {}

              // Check Transfer for correct state
              if (transfer?.transferState === Enum.Transfers.TransferInternalState.EXPIRED_RESERVED) {
                // We have a Transfer with the correct state, lets check if we can get the TransferError record
                try {
                  // Fetch the TransferError record
                  const transferError = await TransferService.getTransferErrorByTransferId(tf.messageProtocolPrepare.content.payload.transferId)
                  // TransferError record found, so lets return it
                  return {
                    transfer,
                    transferError
                  }
                } catch (err) {
                  // NO TransferError record found, so lets return the transfer and the error
                  return {
                    transfer,
                    err
                  }
                }
              } else {
                // NO Transfer with the correct state was found, so we return false
                return false
              }
            } catch (err) {
              // NO Transfer with the correct state was found, so we return false
              Logger.error(err)
              return false
            }
          }
          const result = await wrapWithRetries(
            inspectTransferState,
            wrapWithRetriesConf.remainingRetries,
            wrapWithRetriesConf.timeout
          )

          // Assert
          if (result === false) {
            test.fail(`Transfer['${tf.messageProtocolPrepare.content.payload.transferId}'].TransferState failed to transition to ${Enum.Transfers.TransferInternalState.EXPIRED_RESERVED}`)
          } else {
            test.equal(result.transfer && result.transfer?.transferState, Enum.Transfers.TransferInternalState.EXPIRED_RESERVED, `Transfer['${tf.messageProtocolPrepare.content.payload.transferId}'].TransferState = ${Enum.Transfers.TransferInternalState.EXPIRED_RESERVED}`)
            test.equal(result.transferError && result.transferError.errorCode, ErrorHandler.Enums.FSPIOPErrorCodes.TRANSFER_EXPIRED.code, `Transfer['${tf.messageProtocolPrepare.content.payload.transferId}'].transferError.errorCode = ${ErrorHandler.Enums.FSPIOPErrorCodes.TRANSFER_EXPIRED.code}`)
            test.equal(result.transferError && result.transferError.errorDescription, ErrorHandler.Enums.FSPIOPErrorCodes.TRANSFER_EXPIRED.message, `Transfer['${tf.messageProtocolPrepare.content.payload.transferId}'].transferError.errorDescription = ${ErrorHandler.Enums.FSPIOPErrorCodes.TRANSFER_EXPIRED.message}`)
            test.pass()
          }
        }
        test.end()
      })

      await timeoutTest.skip('position resets after a timeout', async (test) => {
        // Arrange
        for (const payer of td.payerList) {
          const payerInitialPosition = payer.payerLimitAndInitialPosition.participantPosition.value
          // Act
          const payerPositionDidReset = async () => {
            const payerCurrentPosition = await ParticipantService.getPositionByParticipantCurrencyId(payer.participantCurrencyId)
            console.log(payerCurrentPosition)
            return new MLNumber(payerCurrentPosition.value).isEqualTo(payerInitialPosition)
          }
          // wait until we know the position reset, or throw after 5 tries
          await wrapWithRetries(payerPositionDidReset, wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
          const payerCurrentPosition = await ParticipantService.getPositionByParticipantCurrencyId(payer.participantCurrencyId) || {}

          // Assert
          test.ok(new MLNumber(payerCurrentPosition.value).isEqualTo(payerInitialPosition), 'Position resets after a timeout')
        }

        test.end()
      })

      timeoutTest.end()
    })
    transferPositionPrepare.end()
  })

  await handlersTest.test('teardown', async (assert) => {
    try {
      await Handlers.timeouts.stop()
      await Cache.destroyCache()
      await Db.disconnect()
      assert.pass('database connection closed')
      await testConsumer.destroy() // this disconnects the consumers
      await ProxyCache.disconnect()
      await Producer.disconnect()
      // Disconnect all consumers
      await Promise.all(Consumer.getListOfTopics().map(async (topic) => {
        Logger.info(`Disconnecting consumer for topic: ${topic}`)
        return Consumer.getConsumer(topic).disconnect()
      }))

      if (debug) {
        const elapsedTime = Math.round(((new Date()) - startTime) / 100) / 10
        console.log(`handlers.skip.js finished in (${elapsedTime}s)`)
      }

      assert.end()
    } catch (err) {
      Logger.error(`teardown failed with error - ${err}`)
      assert.fail()
      assert.end()
    } finally {
      handlersTest.end()
    }
  })
})
