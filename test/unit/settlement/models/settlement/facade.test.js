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

 * ModusBoc
 - Georgi Georgiev <georgi.georgiev@modusbox.com>
 - Valentin Genev <valentin.genev@modusbox.com>
 --------------
 ******/
'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const Db = require('../../../../../src/settlement/lib/db')
const { logger } = require('../../../../../src/settlement/shared/logger')
const SettlementFacade = require('../../../../../src/settlement/models/settlement/facade')
const ParticipantFacade = require('../../../../../src/models/participant/facade')
const idGenerator = require('@mojaloop/central-services-shared').Util.id
const Utility = require('../../../../../src/settlement/lib/utility')
const FSPIOPError = require('@mojaloop/central-services-error-handling').Factory.FSPIOPError

const generateULID = idGenerator({ type: 'ulid' })

Test('Settlement facade', async (settlementFacadeTest) => {
  let sandbox
  let clock
  const now = new Date()

  settlementFacadeTest.beforeEach(test => {
    sandbox = Sinon.createSandbox()
    clock = Sinon.useFakeTimers(now.getTime())
    Db.from = (table) => {
      return Db[table]
    }
    test.end()
  })

  settlementFacadeTest.afterEach(test => {
    sandbox.restore()
    clock.restore()
    test.end()
  })

  const payload = new Map()
  payload.putById = [
    {
      participants: [
        {
          id: 1,
          accounts: [
            {
              id: 11,
              reason: 'Account not found',
              state: 'SETTLED'
            },
            {
              id: 1,
              reason: 'PENDING_SETTLEMENT to PS_TRANSFERS_RECORDED',
              state: 'PS_TRANSFERS_RECORDED'
            },
            {
              id: 2,
              reason: 'PENDING_SETTLEMENT to PS_TRANSFERS_RECORDED',
              state: 'PS_TRANSFERS_RECORDED'
            },
            {
              id: 1,
              reason: 'Account already processed once',
              state: 'PS_TRANSFERS_RECORDED'
            },
            {
              id: 3,
              reason: 'Same state',
              state: 'SETTLED'
            },
            {
              id: 4,
              reason: 'State change not allowed',
              state: 'SETTLED'
            }
          ]
        },
        {
          id: 2,
          accounts: [
            {
              id: 5,
              reason: 'Participant and account mismatch',
              state: 'SETTLED'
            }
          ]
        }
      ]
    },
    {
      participants: [
        {
          id: 1,
          accounts: [
            {
              id: 1,
              reason: 'PS_TRANSFERS_RECORDED to PS_TRANSFERS_RESERVED',
              state: 'PS_TRANSFERS_RESERVED'
            }
          ]
        }
      ]
    },
    {
      participants: [
        {
          id: 1,
          accounts: [
            {
              id: 1,
              reason: 'PS_TRANSFERS_RESERVED to PS_TRANSFERS_COMMITTED',
              state: 'PS_TRANSFERS_COMMITTED'
            }
          ]
        }
      ]
    },
    {
      participants: [
        {
          id: 1,
          accounts: [
            {
              id: 1,
              reason: 'PS_TRANSFERS_COMMITTED to SETTLED',
              state: 'SETTLED'
            }
          ]
        }
      ]
    },
    {
      participants: [
        {
          id: 1,
          accounts: [
            {
              id: 1,
              reason: 'PENDING_SETTLEMENT to PS_TRANSFERS_RECORDED',
              state: 'PS_TRANSFERS_RECORDED'
            }
          ]
        }
      ]
    },
    {
      participants: [
        {
          id: 1,
          accounts: [
            {
              id: 1,
              reason: 'PS_TRANSFERS_COMMITTED to SETTLING',
              state: 'SETTLED'
            }
          ]
        }
      ]
    }
  ]
  payload.triggerSettlementEvent = {
    idList: [1, 2],
    reason: 'text'
  }

  const enums = {
    transferStates: {
      RESERVED: 'RESERVED',
      COMMITTED: 'COMMITTED'
    },
    transferStateEnums: {
      ABORTED: 'ABORTED',
      RESERVED: 'RESERVED'
    },
    transferParticipantRoleTypes: {
      PAYER_DFSP: 'PAYER_DFSP',
      PAYEE_DFSP: 'PAYEE_DFSP',
      DFSP_SETTLEMENT_ACCOUNT: 'DFSP_SETTLEMENT_ACCOUNT',
      DFSP_POSITION_ACCOUNT: 'DFSP_POSITION_ACCOUNT'
    },
    ledgerAccountTypes: {
      POSITION: 'POSITION',
      SETTLEMENT: 'SETTLEMENT'
    },
    ledgerEntryTypes: {
      PRINCIPLE_VALUE: 1,
      INTERCHANGE_FEE: 2,
      HUB_FEE: 3,
      SETTLEMENT_NET_RECIPIENT: 6,
      SETTLEMENT_NET_SENDER: 7,
      SETTLEMENT_NET_ZERO: 8
    },
    settlementStates: {
      PENDING_SETTLEMENT: 'PENDING_SETTLEMENT',
      PS_TRANSFERS_RECORDED: 'PS_TRANSFERS_RECORDED',
      PS_TRANSFERS_RESERVED: 'PS_TRANSFERS_RESERVED',
      PS_TRANSFERS_COMMITTED: 'PS_TRANSFERS_COMMITTED',
      SETTLING: 'SETTLING',
      SETTLED: 'SETTLED',
      ABORTED: 'ABORTED'
    },
    settlementWindowStates: {
      PENDING_SETTLEMENT: 'PENDING_SETTLEMENT',
      SETTLED: 'SETTLED',
      ABORTED: 'ABORTED',
      CLOSED: 'CLOSED'
    },
    participantLimitTypes: {
      NET_DEBIT_CAP: 'NET_DEBIT_CAP'
    }
  }

  const stubData = new Map()
  stubData.settlementTransfersPrepare = {
    settlementTransferList: [
      {
        settlementParticipantCurrencyId: 1,
        settlementId: 1,
        participantCurrencyId: 3,
        netAmount: 800,
        createdDate: new Date(),
        currentStateChangeId: 3,
        settlementTransferId: generateULID(),
        currencyId: 'USD'
      },
      {
        settlementParticipantCurrencyId: 2,
        settlementId: 1,
        participantCurrencyId: 5,
        netAmount: -800,
        createdDate: new Date(),
        currentStateChangeId: 4,
        settlementTransferId: generateULID(),
        currencyId: 'USD'
      },
      {
        settlementParticipantCurrencyId: 3,
        settlementId: 1,
        participantCurrencyId: 7,
        netAmount: 0,
        createdDate: new Date(),
        currentStateChangeId: 5,
        settlementTransferId: generateULID(),
        currencyId: 'USD'
      }
    ]
  }
  stubData.settlementTransfersReserve = {
    settlementTransferList: [
      {
        transferId: generateULID(),
        ledgerEntryTypeId: 7,
        dfspAccountId: 3,
        dfspAmount: -800,
        hubAccountId: 2,
        hubAmount: 800
      },
      {
        transferId: generateULID(),
        ledgerEntryTypeId: 6,
        dfspAccountId: 5,
        dfspAmount: 800,
        hubAccountId: 2,
        hubAmount: -800
      },
      {
        transferId: generateULID(),
        ledgerEntryTypeId: 6,
        dfspAccountId: 5,
        dfspAmount: 1001,
        hubAccountId: 2,
        hubAmount: -1001
      }
    ]
  }
  stubData.settlementTransfersAbort = {
    settlementTransferList: [
      {
        transferId: generateULID(),
        ledgerEntryTypeId: 7,
        dfspAccountId: 3,
        dfspAmount: -800,
        hubAccountId: 2,
        hubAmount: 800
      },
      {
        transferId: generateULID(),
        ledgerEntryTypeId: 6,
        dfspAccountId: 5,
        dfspAmount: 800,
        hubAccountId: 2,
        hubAmount: -800
      },
      {
        transferId: generateULID(),
        ledgerEntryTypeId: 6,
        dfspAccountId: 5,
        dfspAmount: 1001,
        hubAccountId: 2,
        hubAmount: -1001
      }
    ]
  }
  stubData.settlementTransfersCommit = {
    settlementTransferList: [
      {
        transferId: generateULID(),
        ledgerEntryTypeId: 7,
        dfspAccountId: 3,
        dfspAmount: -800,
        hubAccountId: 2,
        hubAmount: 800
      },
      {
        transferId: generateULID(),
        ledgerEntryTypeId: 6,
        dfspAccountId: 5,
        dfspAmount: 800,
        hubAccountId: 2,
        hubAmount: -800
      }
    ]
  }
  stubData.putById = [
    {
      settlementData: {
        settlementId: 1,
        settlementStateId: 'PENDING_SETTLEMENT',
        reason: 'reason',
        createdDate: now,
        autoPositionReset: true
      },
      settlementAccountList: [
        {
          participantId: 1,
          participantCurrencyId: 1,
          settlementStateId: 'PENDING_SETTLEMENT',
          reason: 'text',
          netAmount: 100,
          currencyId: 'USD',
          key: 1
        },
        {
          participantId: 1,
          participantCurrencyId: 2,
          settlementStateId: 'PENDING_SETTLEMENT',
          reason: 'text',
          netAmount: 100,
          currencyId: 'USD',
          key: 2
        },
        {
          participantId: 1,
          participantCurrencyId: 3,
          settlementStateId: 'SETTLED',
          reason: 'text',
          netAmount: 100,
          currencyId: 'USD',
          key: 3
        },
        {
          participantId: 1,
          participantCurrencyId: 4,
          settlementStateId: 'ABORTED',
          reason: 'text',
          netAmount: 100,
          currencyId: 'USD',
          key: 5
        },
        {
          participantId: 1,
          participantCurrencyId: 5,
          settlementStateId: 'unknown',
          reason: 'text',
          netAmount: 100,
          currencyId: 'USD',
          key: 6
        },
        {
          participantId: 1,
          participantCurrencyId: 6,
          settlementStateId: 'PENDING_SETTLEMENT',
          reason: 'text',
          netAmount: 100,
          currencyId: 'USD',
          key: 6
        },
        {
          participantId: 1,
          participantCurrencyId: 7,
          settlementStateId: 'PENDING_SETTLEMENT',
          reason: 'text',
          netAmount: 100,
          currencyId: 'USD',
          key: 7
        },
        {
          participantId: 1,
          participantCurrencyId: 8,
          settlementStateId: 'PS_TRANSFERS_RECORDED',
          reason: 'text',
          netAmount: 100,
          currencyId: 'USD',
          key: 8
        },
        {
          participantId: 1,
          participantCurrencyId: 9,
          settlementStateId: 'PS_TRANSFERS_RESERVED',
          reason: 'text',
          netAmount: 100,
          currencyId: 'USD',
          key: 9
        },
        {
          participantId: 1,
          participantCurrencyId: 10,
          settlementStateId: 'PS_TRANSFERS_COMMITTED',
          reason: 'text',
          netAmount: 100,
          currencyId: 'USD',
          key: 10
        }
      ],
      windowsList: [
        {
          settlementWindowId: 1,
          settlementWindowStateId: 'PENDING_SETTLEMENT',
          reason: 'text',
          createdDate: now
        },
        {
          settlementWindowId: 2,
          settlementWindowStateId: 'SETTLED',
          reason: 'text',
          createdDate: now
        },
        {
          settlementWindowId: 3,
          settlementWindowStateId: 'ABORTED',
          reason: 'text',
          createdDate: now
        },
        {
          settlementWindowId: 4,
          settlementWindowStateId: 'other',
          reason: 'text',
          createdDate: now
        },
        {
          settlementWindowId: 5,
          settlementWindowStateId: 'PENDING_SETTLEMENT',
          reason: 'text',
          createdDate: now
        }
      ],
      windowsAccountsList: [
        {
          settlementWindowId: 1,
          participantCurrencyId: 1
        },
        {
          settlementWindowId: 2,
          participantCurrencyId: 3
        },
        {
          settlementWindowId: 3,
          participantCurrencyId: 1
        },
        {
          settlementWindowId: 3,
          participantCurrencyId: 2
        },
        {
          settlementWindowId: 4,
          participantCurrencyId: 4
        },
        {
          settlementWindowId: 5,
          participantCurrencyId: 6
        },
        {
          settlementWindowId: 5,
          participantCurrencyId: 7
        },
        {
          settlementWindowId: 6,
          participantCurrencyId: 5
        },
        {
          settlementWindowId: 7,
          participantCurrencyId: 8
        },
        {
          settlementWindowId: 7,
          participantCurrencyId: 9
        },
        {
          settlementWindowId: 7,
          participantCurrencyId: 10
        }
      ],
      settlementTransferList: [
        {
          settlementTransferId: 1,
          netAmount: 100,
          currencyId: 'USD',
          participantCurrencyId: 1
        }
      ],
      processedContent: [{
        settlementWindowId: 1,
        settlementWindowStateId: 'PENDING_SETTLEEMENT',
        reason: 'unit testing',
        createdDate1: 'date',
        changedDate1: 'date',
        settlementWindowContentId: 1,
        state: 'PENDING_SETTLEMENT',
        ledgerAccountType: 1,
        currencyId: 'USD',
        createdDate: 'date',
        changedDate: 'date'
      }, {
        settlementWindowId: 1,
        settlementWindowStateId: 'PENDING_SETTLEEMENT',
        reason: 'unit testing',
        createdDate1: 'date',
        changedDate1: 'date',
        settlementWindowContentId: 1,
        state: 'PENDING_SETTLEMENT',
        ledgerAccountType: 6,
        currencyId: 'USD',
        createdDate: 'date',
        changedDate: 'date'
      }, {
        settlementWindowId: 2,
        settlementWindowStateId: 'PENDING_SETTLEEMENT',
        reason: 'unit testing',
        createdDate1: 'date',
        changedDate1: 'date',
        settlementWindowContentId: 1,
        state: 'PENDING_SETTLEMENT',
        ledgerAccountType: 1,
        currencyId: 'USD',
        createdDate: 'date',
        changedDate: 'date'
      }]
    },
    {
      settlementData: {
        settlementId: 1,
        settlementStateId: 'PS_TRANSFERS_RECORDED',
        reason: 'reason',
        createdDate: now,
        autoPositionReset: true
      },
      settlementAccountList: [
        {
          participantId: 1,
          participantCurrencyId: 1,
          settlementStateId: 'PS_TRANSFERS_RECORDED',
          reason: 'text',
          netAmount: 100,
          currencyId: 'USD',
          key: 1
        }
      ],
      windowsList: [
        {
          settlementWindowId: 1,
          settlementWindowStateId: 'PENDING_SETTLEMENT',
          reason: 'text',
          createdDate: now
        }
      ],
      windowsAccountsList: [
        {
          settlementWindowId: 1,
          participantCurrencyId: 1
        }
      ],
      settlementTransferList: [
        {
          settlementTransferId: 1,
          netAmount: 100,
          currencyId: 'USD',
          participantCurrencyId: 1
        }
      ],
      processedContent: [{
        settlementWindowId: 1,
        settlementWindowStateId: 'PENDING_SETTLEEMENT',
        reason: 'unit testing',
        createdDate1: 'date',
        changedDate1: 'date',
        settlementWindowContentId: 1,
        state: 'PENDING_SETTLEMENT',
        ledgerAccountType: 1,
        currencyId: 'USD',
        createdDate: 'date',
        changedDate: 'date'
      }, {
        settlementWindowId: 1,
        settlementWindowStateId: 'PENDING_SETTLEEMENT',
        reason: 'unit testing',
        createdDate1: 'date',
        changedDate1: 'date',
        settlementWindowContentId: 1,
        state: 'PENDING_SETTLEMENT',
        ledgerAccountType: 6,
        currencyId: 'USD',
        createdDate: 'date',
        changedDate: 'date'
      }, {
        settlementWindowId: 2,
        settlementWindowStateId: 'PENDING_SETTLEEMENT',
        reason: 'unit testing',
        createdDate1: 'date',
        changedDate1: 'date',
        settlementWindowContentId: 1,
        state: 'PENDING_SETTLEMENT',
        ledgerAccountType: 1,
        currencyId: 'USD',
        createdDate: 'date',
        changedDate: 'date'
      }]
    },
    {
      settlementData: {
        settlementId: 1,
        settlementStateId: 'PS_TRANSFERS_RESERVED',
        reason: 'reason',
        createdDate: now,
        autoPositionReset: true
      },
      settlementAccountList: [
        {
          participantId: 1,
          participantCurrencyId: 1,
          settlementStateId: 'PS_TRANSFERS_RESERVED',
          reason: 'text',
          netAmount: 100,
          currencyId: 'USD',
          key: 1
        }
      ],
      windowsList: [
        {
          settlementWindowId: 1,
          settlementWindowStateId: 'PENDING_SETTLEMENT',
          reason: 'text',
          createdDate: now
        }
      ],
      windowsAccountsList: [
        {
          settlementWindowId: 1,
          participantCurrencyId: 1
        }
      ],
      settlementTransferList: [
        {
          settlementTransferId: 1,
          netAmount: 100,
          currencyId: 'USD',
          participantCurrencyId: 1
        }
      ],
      processedContent: [{
        settlementWindowId: 1,
        settlementWindowStateId: 'PENDING_SETTLEEMENT',
        reason: 'unit testing',
        createdDate1: 'date',
        changedDate1: 'date',
        settlementWindowContentId: 1,
        state: 'PENDING_SETTLEMENT',
        ledgerAccountType: 1,
        currencyId: 'USD',
        createdDate: 'date',
        changedDate: 'date'
      }, {
        settlementWindowId: 1,
        settlementWindowStateId: 'PENDING_SETTLEEMENT',
        reason: 'unit testing',
        createdDate1: 'date',
        changedDate1: 'date',
        settlementWindowContentId: 1,
        state: 'PENDING_SETTLEMENT',
        ledgerAccountType: 6,
        currencyId: 'USD',
        createdDate: 'date',
        changedDate: 'date'
      }, {
        settlementWindowId: 2,
        settlementWindowStateId: 'PENDING_SETTLEEMENT',
        reason: 'unit testing',
        createdDate1: 'date',
        changedDate1: 'date',
        settlementWindowContentId: 1,
        state: 'PENDING_SETTLEMENT',
        ledgerAccountType: 1,
        currencyId: 'USD',
        createdDate: 'date',
        changedDate: 'date'
      }]
    },
    {
      settlementData: {
        settlementId: 1,
        settlementStateId: 'PS_TRANSFERS_COMMITTED',
        reason: 'reason',
        createdDate: now,
        autoPositionReset: true
      },
      settlementAccountList: [
        {
          participantId: 1,
          participantCurrencyId: 1,
          settlementStateId: 'PS_TRANSFERS_COMMITTED',
          reason: 'text',
          netAmount: 100,
          currencyId: 'USD',
          key: 1
        }
      ],
      windowsList: [
        {
          settlementWindowId: 1,
          settlementWindowStateId: 'PENDING_SETTLEMENT',
          reason: 'text',
          createdDate: now
        }
      ],
      windowsAccountsList: [
        {
          settlementWindowId: 1,
          participantCurrencyId: 1
        }
      ],
      settlementTransferList: [
        {
          settlementTransferId: 1,
          netAmount: 100,
          currencyId: 'USD',
          participantCurrencyId: 1
        }
      ],
      processedContent: [{
        settlementWindowId: 1,
        settlementWindowStateId: 'PENDING_SETTLEEMENT',
        reason: 'unit testing',
        createdDate1: 'date',
        changedDate1: 'date',
        settlementWindowContentId: 1,
        state: 'PENDING_SETTLEMENT',
        ledgerAccountType: 1,
        currencyId: 'USD',
        createdDate: 'date',
        changedDate: 'date'
      }, {
        settlementWindowId: 1,
        settlementWindowStateId: 'PENDING_SETTLEEMENT',
        reason: 'unit testing',
        createdDate1: 'date',
        changedDate1: 'date',
        settlementWindowContentId: 1,
        state: 'PENDING_SETTLEMENT',
        ledgerAccountType: 6,
        currencyId: 'USD',
        createdDate: 'date',
        changedDate: 'date'
      }, {
        settlementWindowId: 2,
        settlementWindowStateId: 'PENDING_SETTLEEMENT',
        reason: 'unit testing',
        createdDate1: 'date',
        changedDate1: 'date',
        settlementWindowContentId: 1,
        state: 'PENDING_SETTLEMENT',
        ledgerAccountType: 1,
        currencyId: 'USD',
        createdDate: 'date',
        changedDate: 'date'
      }],
      scaContentToCheck: [{
        settlementWindowContentId: 1
      }, {
        settlementWindowContentId: 2
      }],
      unsettledContent: [{
        settlementWindowContentId: 2
      }],
      windowsToCheck: [{
        settlementWindowId: 1
      }, {
        settlementWindowId: 2
      }],
      unsettledWindows: [{
        settlementWindowId: 2
      }]
    },
    {
      settlementData: {
        settlementId: 1,
        settlementStateId: 'PENDING_SETTLEMENT',
        reason: 'reason',
        createdDate: now,
        autoPositionReset: true
      },
      settlementAccountList: [
        {
          participantId: 1,
          participantCurrencyId: 1,
          settlementStateId: 'PENDING_SETTLEMENT',
          reason: 'text',
          netAmount: 100,
          currencyId: 'USD',
          key: 1
        }
      ],
      windowsList: [
        {
          settlementWindowId: 1,
          settlementWindowStateId: 'PENDING_SETTLEMENT',
          reason: 'text',
          createdDate: now
        }
      ],
      windowsAccountsList: [
        {
          settlementWindowId: 1,
          participantCurrencyId: 1
        }
      ],
      settlementTransferList: [
        {
          settlementTransferId: 1,
          netAmount: 100,
          currencyId: 'USD',
          participantCurrencyId: 1
        }
      ],
      processedContent: [{
        settlementWindowId: 1,
        settlementWindowStateId: 'PENDING_SETTLEEMENT',
        reason: 'unit testing',
        createdDate1: 'date',
        changedDate1: 'date',
        settlementWindowContentId: 1,
        state: 'PENDING_SETTLEMENT',
        ledgerAccountType: 1,
        currencyId: 'USD',
        createdDate: 'date',
        changedDate: 'date'
      }, {
        settlementWindowId: 1,
        settlementWindowStateId: 'PENDING_SETTLEEMENT',
        reason: 'unit testing',
        createdDate1: 'date',
        changedDate1: 'date',
        settlementWindowContentId: 1,
        state: 'PENDING_SETTLEMENT',
        ledgerAccountType: 6,
        currencyId: 'USD',
        createdDate: 'date',
        changedDate: 'date'
      }, {
        settlementWindowId: 2,
        settlementWindowStateId: 'PENDING_SETTLEEMENT',
        reason: 'unit testing',
        createdDate1: 'date',
        changedDate1: 'date',
        settlementWindowContentId: 1,
        state: 'PENDING_SETTLEMENT',
        ledgerAccountType: 1,
        currencyId: 'USD',
        createdDate: 'date',
        changedDate: 'date'
      }]
    },
    {
      settlementData: {
        settlementId: 1,
        settlementStateId: 'PS_TRANSFERS_COMMITTED',
        reason: 'reason',
        createdDate: now,
        autoPositionReset: false
      },
      settlementAccountList: [
        {
          participantId: 1,
          participantCurrencyId: 1,
          settlementStateId: 'PS_TRANSFERS_COMMITTED',
          reason: 'text',
          netAmount: 100,
          currencyId: 'USD',
          key: 1
        },
        {
          participantId: 1,
          participantCurrencyId: 2,
          settlementStateId: 'PS_TRANSFERS_COMMITTED',
          reason: 'text',
          netAmount: 100,
          currencyId: 'USD',
          key: 2
        }
      ],
      windowsList: [
        {
          settlementWindowId: 1,
          settlementWindowStateId: 'PENDING_SETTLEMENT',
          reason: 'text',
          createdDate: now
        }
      ],
      windowsAccountsList: [
        {
          settlementWindowId: 1,
          participantCurrencyId: 1
        }
      ],
      settlementTransferList: [
        {
          settlementTransferId: 1,
          netAmount: 100,
          currencyId: 'USD',
          participantCurrencyId: 1
        }
      ],
      processedContent: [{
        settlementWindowId: 1,
        settlementWindowStateId: 'PENDING_SETTLEEMENT',
        reason: 'unit testing',
        createdDate1: 'date',
        changedDate1: 'date',
        settlementWindowContentId: 1,
        state: 'PENDING_SETTLEMENT',
        ledgerAccountType: 1,
        currencyId: 'USD',
        createdDate: 'date',
        changedDate: 'date'
      }, {
        settlementWindowId: 1,
        settlementWindowStateId: 'PENDING_SETTLEEMENT',
        reason: 'unit testing',
        createdDate1: 'date',
        changedDate1: 'date',
        settlementWindowContentId: 1,
        state: 'PENDING_SETTLEMENT',
        ledgerAccountType: 6,
        currencyId: 'USD',
        createdDate: 'date',
        changedDate: 'date'
      }, {
        settlementWindowId: 2,
        settlementWindowStateId: 'PENDING_SETTLEEMENT',
        reason: 'unit testing',
        createdDate1: 'date',
        changedDate1: 'date',
        settlementWindowContentId: 1,
        state: 'PENDING_SETTLEMENT',
        ledgerAccountType: 1,
        currencyId: 'USD',
        createdDate: 'date',
        changedDate: 'date'
      }]
    }
  ]
  stubData.triggerSettlementEvent = {
    settlementId: 1,
    settlementParticipantCurrencyList: [
      {
        settlementParticipantCurrencyId: 'USD'
      }
    ],
    settlementParticipantCurrencyStateChangeIdList: [
      {
        settlementParticipantCurrencyStateChangeId: 11
      }
    ],
    settlementWindowStateChangeIdList: [
      {
        settlementWindowStateChangeId: 3
      },
      {
        settlementWindowStateChangeId: 4
      }
    ],
    swcIdList: [{
      settlementWindowContentId: 1
    }],
    windowsStateToBeUpdatedIdList: [{
      settlementWindowId: 1
    }]
  }

  await settlementFacadeTest.test('settlementTransfersPrepare should', async settlementTransfersPrepareTest => {
    try {
      await settlementTransfersPrepareTest.test('throw error if database is not available', async test => {
        try {
          const settlementId = 1
          const transactionTimestamp = new Date().toISOString().replace(/[TZ]/g, ' ').trim()
          const trxStub = sandbox.stub()

          const knexStub = sandbox.stub().throws(new Error('Database unavailable'))
          sandbox.stub(Db, 'getKnex').returns(knexStub)

          await SettlementFacade.settlementTransfersPrepare(settlementId, transactionTimestamp, enums, trxStub)
          test.fail('Error not thrown!')
          test.end()
        } catch (err) {
          logger.error(`settlementTransfersPrepare failed with error - ${err}`)
          test.pass('Error thrown')
          test.end()
        }
      })

      await settlementTransfersPrepareTest.test('make transfer prepare when called from within a transaction', async test => {
        try {
          const settlementId = 1
          const transactionTimestamp = new Date().toISOString().replace(/[TZ]/g, ' ').trim()
          const trxStub = sandbox.stub()

          const knexStub = sandbox.stub()
          sandbox.stub(Db, 'getKnex').returns(knexStub)
          knexStub.returns({
            join: sandbox.stub().returns({
              join: sandbox.stub().returns({
                leftJoin: sandbox.stub().returns({
                  select: sandbox.stub().returns({
                    where: sandbox.stub().returns({
                      where: sandbox.stub().returns({
                        whereNotNull: sandbox.stub().returns({
                          whereNull: sandbox.stub().returns({
                            transacting: sandbox.stub().returns(
                              Promise.resolve(stubData.settlementTransfersPrepare.settlementTransferList)
                            )
                          })
                        })
                      })
                    })
                  })
                })
              })
            }),
            insert: sandbox.stub().returns({
              transacting: sandbox.stub()
            })
          })

          const context = sandbox.stub()
          context.on = sandbox.stub().returns({
            andOn: sandbox.stub().returns({
              andOn: sandbox.stub().returns({
                andOn: sandbox.stub()
              })
            })
          })
          const participantCurrencyJoinStub = sandbox.stub().callsArgOn(1, context)
          knexStub.withArgs('participantCurrency AS pc1').returns({
            join: participantCurrencyJoinStub.returns({
              select: sandbox.stub().returns({
                where: sandbox.stub().returns({
                  first: sandbox.stub().returns({
                    transacting: sandbox.stub().returns(
                      Promise.resolve({ settlementAccountId: 1 })
                    )
                  })
                })
              })
            })
          })
          const result = await SettlementFacade.settlementTransfersPrepare(settlementId, transactionTimestamp, enums, trxStub)
          test.equal(result, 0, 'Result for successful operation returned')
          test.equal(knexStub.withArgs('settlementParticipantCurrency AS spc').callCount, 1)
          test.equal(knexStub().join.withArgs('settlementParticipantCurrencyStateChange AS spcsc', 'spcsc.settlementParticipantCurrencyId', 'spc.settlementParticipantCurrencyId').callCount, 1)
          test.equal(knexStub().join().join.withArgs('participantCurrency AS pc', 'pc.participantCurrencyId', 'spc.participantCurrencyId').callCount, 1)
          test.equal(knexStub().join().join().leftJoin.withArgs('transferDuplicateCheck AS tdc', 'tdc.transferId', 'spc.settlementTransferId').callCount, 1)
          test.equal(knexStub().join().join().leftJoin().select.withArgs('spc.*', 'pc.currencyId').callCount, 1)
          test.equal(knexStub().join().join().leftJoin().select().where.withArgs('spc.settlementId', settlementId).callCount, 1)
          test.equal(knexStub().join().join().leftJoin().select().where().where.withArgs('spcsc.settlementStateId', enums.settlementStates.PS_TRANSFERS_RECORDED).callCount, 1)
          test.equal(knexStub().join().join().leftJoin().select().where().where().whereNotNull.withArgs('spc.settlementTransferId').callCount, 1)
          test.equal(knexStub().join().join().leftJoin().select().where().where().whereNotNull().whereNull.withArgs('tdc.transferId').callCount, 1)
          test.equal(knexStub().join().join().leftJoin().select().where().where().whereNotNull().whereNull().transacting.withArgs(trxStub).callCount, 1)

          test.equal(knexStub.withArgs('transferDuplicateCheck').callCount, 3)
          test.equal(knexStub.withArgs('transfer').callCount, 3)
          test.equal(knexStub.withArgs('participantCurrency AS pc1').callCount, 3)
          test.equal(knexStub.withArgs('transferParticipant').callCount, 6)
          test.equal(knexStub.withArgs('transferStateChange').callCount, 3)
          test.equal(knexStub().insert.callCount, 15)

          test.end()
        } catch (err) {
          logger.error(`settlementTransfersPrepare failed with error - ${err}`)
          test.fail()
          test.end()
        }
      })

      await settlementTransfersPrepareTest.test('throw error if any insert fails', async test => {
        try {
          const settlementId = 1
          const transactionTimestamp = new Date().toISOString().replace(/[TZ]/g, ' ').trim()
          const trxStub = sandbox.stub()

          const knexStub = sandbox.stub()
          sandbox.stub(Db, 'getKnex').returns(knexStub)
          knexStub.returns({
            join: sandbox.stub().returns({
              join: sandbox.stub().returns({
                leftJoin: sandbox.stub().returns({
                  select: sandbox.stub().returns({
                    where: sandbox.stub().returns({
                      where: sandbox.stub().returns({
                        whereNotNull: sandbox.stub().returns({
                          whereNull: sandbox.stub().returns({
                            transacting: sandbox.stub().returns(
                              Promise.resolve(stubData.settlementTransfersPrepare.settlementTransferList)
                            )
                          })
                        })
                      })
                    })
                  })
                })
              })
            }),
            insert: sandbox.stub().returns({
              transacting: sandbox.stub()
            })
          })
          await SettlementFacade.settlementTransfersPrepare(settlementId, transactionTimestamp, enums, trxStub)
          test.fail('Error not thrown!')
          test.end()
        } catch (err) {
          logger.error(`settlementTransfersPrepare failed with error - ${err}`)
          test.pass('Error thrown')
          test.end()
        }
      })

      await settlementTransfersPrepareTest.test('make transfer prepare in a new transaction and commit it when called outside of a transaction', async test => {
        try {
          const settlementId = 1
          const transactionTimestamp = new Date().toISOString().replace(/[TZ]/g, ' ').trim()

          const knexStub = sandbox.stub()
          sandbox.stub(Db, 'getKnex').returns(knexStub)
          const trxStub = sandbox.stub()
          knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
          trxStub.commit = sandbox.stub()

          knexStub.returns({
            join: sandbox.stub().returns({
              join: sandbox.stub().returns({
                leftJoin: sandbox.stub().returns({
                  select: sandbox.stub().returns({
                    where: sandbox.stub().returns({
                      where: sandbox.stub().returns({
                        whereNotNull: sandbox.stub().returns({
                          whereNull: sandbox.stub().returns({
                            transacting: sandbox.stub().returns(
                              Promise.resolve(stubData.settlementTransfersPrepare.settlementTransferList)
                            )
                          })
                        })
                      })
                    })
                  })
                })
              })
            }),
            insert: sandbox.stub().returns({
              transacting: sandbox.stub()
            })
          })

          const context = sandbox.stub()
          context.on = sandbox.stub().returns({
            andOn: sandbox.stub().returns({
              andOn: sandbox.stub().returns({
                andOn: sandbox.stub()
              })
            })
          })
          const participantCurrencyJoinStub = sandbox.stub().callsArgOn(1, context)
          knexStub.withArgs('participantCurrency AS pc1').returns({
            join: participantCurrencyJoinStub.returns({
              select: sandbox.stub().returns({
                where: sandbox.stub().returns({
                  first: sandbox.stub().returns({
                    transacting: sandbox.stub().returns(
                      Promise.resolve({ settlementAccountId: 1 })
                    )
                  })
                })
              })
            })
          })

          const result = await SettlementFacade.settlementTransfersPrepare(settlementId, transactionTimestamp, enums)
          test.equal(result, 0, 'Result for successful operation returned')
          test.end()
        } catch (err) {
          logger.error(`settlementTransfersPrepare failed with error - ${err}`)
          test.fail()
          test.end()
        }
      })

      await settlementTransfersPrepareTest.test('throw error and rollback when called outside of a transaction', async test => {
        try {
          const settlementId = 1
          const transactionTimestamp = new Date().toISOString().replace(/[TZ]/g, ' ').trim()

          const knexStub = sandbox.stub()
          sandbox.stub(Db, 'getKnex').returns(knexStub)
          const trxStub = sandbox.stub()
          knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
          trxStub.rollback = sandbox.stub()

          knexStub.returns({
            join: sandbox.stub().returns({
              join: sandbox.stub().returns({
                leftJoin: sandbox.stub().returns({
                  select: sandbox.stub().returns({
                    where: sandbox.stub().returns({
                      where: sandbox.stub().returns({
                        whereNotNull: sandbox.stub().returns({
                          whereNull: sandbox.stub().returns({
                            transacting: sandbox.stub().returns(
                              Promise.resolve(stubData.settlementTransfersPrepare.settlementTransferList)
                            )
                          })
                        })
                      })
                    })
                  })
                })
              })
            }),
            insert: sandbox.stub().returns({
              transacting: sandbox.stub().throws(new Error('Insert failed'))
            })
          })
          await SettlementFacade.settlementTransfersPrepare(settlementId, transactionTimestamp, enums)
          test.fail('Error not thrown!')
          test.end()
        } catch (err) {
          logger.error(`settlementTransfersPrepare failed with error - ${err}`)
          test.pass('Error thrown')
          test.end()
        }
      })

      await settlementTransfersPrepareTest.end()
    } catch (err) {
      logger.error(`settlementFacadeTest failed with error - ${err}`)
      settlementTransfersPrepareTest.fail()
      settlementTransfersPrepareTest.end()
    }
  })

  await settlementFacadeTest.test('settlementTransfersReserve should', async settlementTransfersReserveTest => {
    try {
      await settlementTransfersReserveTest.test('throw error if database is not available', async test => {
        try {
          const settlementId = 1
          const transactionTimestamp = new Date().toISOString().replace(/[TZ]/g, ' ').trim()
          const trxStub = sandbox.stub()

          const knexStub = sandbox.stub().throws(new Error('Database unavailable'))
          sandbox.stub(Db, 'getKnex').returns(knexStub)
          sandbox.stub(Utility, 'produceGeneralMessage').returns()

          await SettlementFacade.settlementTransfersReserve(settlementId, transactionTimestamp, 1, enums, trxStub)
          test.fail('Error not thrown!')
          test.end()
        } catch (err) {
          logger.error(`settlementTransfersReserve failed with error - ${err}`)
          test.pass('Error thrown')
          test.end()
        }
      })

      await settlementTransfersReserveTest.test('make transfer commit when called from within a transaction', async test => {
        try {
          const settlementId = 1
          const transactionTimestamp = new Date().toISOString().replace(/[TZ]/g, ' ').trim()
          const trxStub = sandbox.stub()

          const knexStub = sandbox.stub()
          knexStub.raw = sandbox.stub()
          sandbox.stub(Db, 'getKnex').returns(knexStub)
          const context = sandbox.stub()
          context.on = sandbox.stub().returns({
            andOn: sandbox.stub()
          })
          const join1Stub = sandbox.stub().callsArgOn(1, context)
          const join2Stub = sandbox.stub().callsArgOn(1, context)
          const leftJoin1Stub = sandbox.stub().callsArgOn(1, context)
          const join3Stub = sandbox.stub().callsArgOn(1, context)
          const join4Stub = sandbox.stub().callsArgOn(1, context)
          knexStub.returns({
            join: join1Stub.returns({
              join: join2Stub.returns({
                leftJoin: leftJoin1Stub.returns({
                  join: join3Stub.returns({
                    join: sandbox.stub().returns({
                      join: sandbox.stub().returns({
                        join: join4Stub.returns({
                          select: sandbox.stub().returns({
                            where: sandbox.stub().returns({
                              whereNull: sandbox.stub().returns({
                                transacting: sandbox.stub().returns(
                                  Promise.resolve(
                                    stubData.settlementTransfersReserve.settlementTransferList
                                  )
                                )
                              })
                            })
                          })
                        })
                      })
                    })
                  })
                })
              })
            }),
            insert: sandbox.stub().returns({
              transacting: sandbox.stub()
            })
          })
          knexStub.withArgs('participantPosition').returns({
            select: sandbox.stub().returns({
              where: sandbox.stub().returns({
                first: sandbox.stub().returns({
                  transacting: sandbox.stub().returns({
                    forUpdate: sandbox.stub().returns(
                      Promise.resolve({
                        dfspPositionId: 1,
                        dfspPositionValue: 0,
                        dfspReservedValue: 0
                      })
                    )
                  })
                })
              })
            }),
            update: sandbox.stub().returns({
              where: sandbox.stub().returns({
                transacting: sandbox.stub()
              })
            })
          })
          knexStub.withArgs('participantPositionChange').returns({
            select: sandbox.stub().returns({
              where: sandbox.stub().returns({
                orderBy: sandbox.stub().returns({
                  first: sandbox.stub().returns({
                    transacting: sandbox.stub()
                  })
                })
              })
            }),
            insert: sandbox.stub().returns({
              transacting: sandbox.stub()
            })
          })
          knexStub.withArgs('participantLimit').returns({
            select: sandbox.stub().returns({
              where: sandbox.stub().returns({
                andWhere: sandbox.stub().returns({
                  first: sandbox.stub().returns({
                    transacting: sandbox.stub().returns({
                      forUpdate: sandbox.stub().returns(
                        Promise.resolve({ netDebitCap: 1000 })
                      )
                    })
                  })
                })
              })
            })
          })
          ParticipantFacade.adjustLimits = sandbox.stub()

          sandbox.stub(Utility, 'produceGeneralMessage').returns()

          const result = await SettlementFacade.settlementTransfersReserve(settlementId, transactionTimestamp, 1, enums, trxStub)
          test.equal(result, 0, 'Result for successful operation returned')
          test.equal(knexStub.withArgs('settlementParticipantCurrency AS spc').callCount, 1)
          test.equal(knexStub.withArgs('transferStateChange').callCount, 3)
          test.equal(knexStub.withArgs('participantPosition').callCount, 8)
          test.equal(knexStub.withArgs('participantLimit').callCount, 2)
          test.equal(knexStub.withArgs('participantPosition').callCount, 8)
          test.equal(knexStub.withArgs('transferFulfilment').callCount, 0)
          test.equal(knexStub.withArgs('participantPositionChange').callCount, 5)

          test.end()
        } catch (err) {
          logger.error(`settlementTransfersReserve failed with error - ${err}`)
          test.fail()
          test.end()
        }
      })

      await settlementTransfersReserveTest.test('make transfer commit when called from within a transaction without liquidity check', async test => {
        try {
          const settlementId = 1
          const transactionTimestamp = new Date().toISOString().replace(/[TZ]/g, ' ').trim()
          const trxStub = sandbox.stub()

          const knexStub = sandbox.stub()
          knexStub.raw = sandbox.stub()
          sandbox.stub(Db, 'getKnex').returns(knexStub)
          const context = sandbox.stub()
          context.on = sandbox.stub().returns({
            andOn: sandbox.stub()
          })
          const join1Stub = sandbox.stub().callsArgOn(1, context)
          const join2Stub = sandbox.stub().callsArgOn(1, context)
          const leftJoin1Stub = sandbox.stub().callsArgOn(1, context)
          const join3Stub = sandbox.stub().callsArgOn(1, context)
          const join4Stub = sandbox.stub().callsArgOn(1, context)
          knexStub.returns({
            join: join1Stub.returns({
              join: join2Stub.returns({
                leftJoin: leftJoin1Stub.returns({
                  join: join3Stub.returns({
                    join: sandbox.stub().returns({
                      join: sandbox.stub().returns({
                        join: join4Stub.returns({
                          select: sandbox.stub().returns({
                            where: sandbox.stub().returns({
                              whereNull: sandbox.stub().returns({
                                transacting: sandbox.stub().returns(
                                  Promise.resolve(
                                    stubData.settlementTransfersReserve.settlementTransferList
                                  )
                                )
                              })
                            })
                          })
                        })
                      })
                    })
                  })
                })
              })
            }),
            insert: sandbox.stub().returns({
              transacting: sandbox.stub()
            })
          })
          knexStub.withArgs('participantPosition').returns({
            select: sandbox.stub().returns({
              where: sandbox.stub().returns({
                first: sandbox.stub().returns({
                  transacting: sandbox.stub().returns({
                    forUpdate: sandbox.stub().returns(
                      Promise.resolve({
                        dfspPositionId: 1,
                        dfspPositionValue: 0,
                        dfspReservedValue: 0
                      })
                    )
                  })
                })
              })
            }),
            update: sandbox.stub().returns({
              where: sandbox.stub().returns({
                transacting: sandbox.stub()
              })
            })
          })
          knexStub.withArgs('participantPositionChange').returns({
            select: sandbox.stub().returns({
              where: sandbox.stub().returns({
                orderBy: sandbox.stub().returns({
                  first: sandbox.stub().returns({
                    transacting: sandbox.stub()
                  })
                })
              })
            }),
            insert: sandbox.stub().returns({
              transacting: sandbox.stub()
            })
          })
          knexStub.withArgs('participantLimit').returns({
            select: sandbox.stub().returns({
              where: sandbox.stub().returns({
                andWhere: sandbox.stub().returns({
                  first: sandbox.stub().returns({
                    transacting: sandbox.stub().returns({
                      forUpdate: sandbox.stub().returns(
                        Promise.resolve({ netDebitCap: 1000 })
                      )
                    })
                  })
                })
              })
            })
          })

          sandbox.stub(Utility, 'produceGeneralMessage').returns()

          const result = await SettlementFacade.settlementTransfersReserve(settlementId, transactionTimestamp, 0, enums, trxStub)
          test.equal(result, 0, 'Result for successful operation returned')
          test.equal(knexStub.withArgs('settlementParticipantCurrency AS spc').callCount, 1)
          test.equal(knexStub.withArgs('transferStateChange').callCount, 3)
          test.equal(knexStub.withArgs('participantPosition').callCount, 8)
          test.equal(knexStub.withArgs('participantLimit').callCount, 0)
          test.equal(knexStub.withArgs('participantPosition').callCount, 8)
          test.equal(knexStub.withArgs('transferFulfilment').callCount, 0)
          test.equal(knexStub.withArgs('participantPositionChange').callCount, 4)

          test.end()
        } catch (err) {
          logger.error(`settlementTransfersReserve failed with error - ${err}`)
          test.fail()
          test.end()
        }
      })

      await settlementTransfersReserveTest.test('throw error if insert fails', async test => {
        try {
          const settlementId = 1
          const transactionTimestamp = new Date().toISOString().replace(/[TZ]/g, ' ').trim()
          const trxStub = sandbox.stub()

          const knexStub = sandbox.stub()
          knexStub.raw = sandbox.stub()
          sandbox.stub(Db, 'getKnex').returns(knexStub)
          const context = sandbox.stub()
          context.on = sandbox.stub().returns({
            andOn: sandbox.stub()
          })
          const join1Stub = sandbox.stub().callsArgOn(1, context)
          const join2Stub = sandbox.stub().callsArgOn(1, context)
          const leftJoin1Stub = sandbox.stub().callsArgOn(1, context)
          const join3Stub = sandbox.stub().callsArgOn(1, context)
          const join4Stub = sandbox.stub().callsArgOn(1, context)
          knexStub.returns({
            join: join1Stub.returns({
              join: join2Stub.returns({
                leftJoin: leftJoin1Stub.returns({
                  join: join3Stub.returns({
                    join: sandbox.stub().returns({
                      join: sandbox.stub().returns({
                        join: join4Stub.returns({
                          select: sandbox.stub().returns({
                            where: sandbox.stub().returns({
                              whereNull: sandbox.stub().returns({
                                transacting: sandbox.stub().returns(
                                  Promise.resolve(
                                    stubData.settlementTransfersReserve.settlementTransferList
                                  )
                                )
                              })
                            })
                          })
                        })
                      })
                    })
                  })
                })
              })
            }),
            insert: sandbox.stub().returns({
              transacting: sandbox.stub().throws(new Error('Insert failed'))
            })
          })
          knexStub.withArgs('participantPosition').returns({
            select: sandbox.stub().returns({
              where: sandbox.stub().returns({
                first: sandbox.stub().returns({
                  transacting: sandbox.stub().returns({
                    forUpdate: sandbox.stub().returns(
                      Promise.resolve({
                        dfspPositionId: 1,
                        dfspPositionValue: 0,
                        dfspReservedValue: 0
                      })
                    )
                  })
                })
              })
            }),
            update: sandbox.stub().returns({
              where: sandbox.stub().returns({
                transacting: sandbox.stub()
              })
            })
          })
          knexStub.withArgs('participantPositionChange').returns({
            select: sandbox.stub().returns({
              where: sandbox.stub().returns({
                orderBy: sandbox.stub().returns({
                  first: sandbox.stub().returns({
                    transacting: sandbox.stub()
                  })
                })
              })
            }),
            insert: sandbox.stub().returns({
              transacting: sandbox.stub()
            })
          })
          knexStub.withArgs('participantLimit').returns({
            select: sandbox.stub().returns({
              where: sandbox.stub().returns({
                andWhere: sandbox.stub().returns({
                  first: sandbox.stub().returns({
                    transacting: sandbox.stub().returns({
                      forUpdate: sandbox.stub().returns(
                        Promise.resolve({ netDebitCap: 1000 })
                      )
                    })
                  })
                })
              })
            })
          })

          sandbox.stub(Utility, 'produceGeneralMessage').returns()

          await SettlementFacade.settlementTransfersReserve(settlementId, transactionTimestamp, 1, enums, trxStub)
          test.fail('Error not thrown!')
          test.end()
        } catch (err) {
          logger.error(`settlementTransfersReserve failed with error - ${err}`)
          test.pass('Error thrown')
          test.end()
        }
      })

      await settlementTransfersReserveTest.test('make transfer commit in a new transaction and commit it when called from outside of a transaction', async test => {
        try {
          const settlementId = 1
          const transactionTimestamp = new Date().toISOString().replace(/[TZ]/g, ' ').trim()

          const knexStub = sandbox.stub()
          sandbox.stub(Db, 'getKnex').returns(knexStub)
          const trxStub = sandbox.stub()
          knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
          trxStub.commit = sandbox.stub()

          knexStub.raw = sandbox.stub()
          const context = sandbox.stub()
          context.on = sandbox.stub().returns({
            andOn: sandbox.stub()
          })
          const join1Stub = sandbox.stub().callsArgOn(1, context)
          const join2Stub = sandbox.stub().callsArgOn(1, context)
          const leftJoin1Stub = sandbox.stub().callsArgOn(1, context)
          const join3Stub = sandbox.stub().callsArgOn(1, context)
          const join4Stub = sandbox.stub().callsArgOn(1, context)
          knexStub.returns({
            join: join1Stub.returns({
              join: join2Stub.returns({
                leftJoin: leftJoin1Stub.returns({
                  join: join3Stub.returns({
                    join: sandbox.stub().returns({
                      join: sandbox.stub().returns({
                        join: join4Stub.returns({
                          select: sandbox.stub().returns({
                            where: sandbox.stub().returns({
                              whereNull: sandbox.stub().returns({
                                transacting: sandbox.stub().returns(
                                  Promise.resolve(
                                    stubData.settlementTransfersReserve.settlementTransferList
                                  )
                                )
                              })
                            })
                          })
                        })
                      })
                    })
                  })
                })
              })
            }),
            insert: sandbox.stub().returns({
              transacting: sandbox.stub()
            })
          })
          knexStub.withArgs('participantPosition').returns({
            select: sandbox.stub().returns({
              where: sandbox.stub().returns({
                first: sandbox.stub().returns({
                  transacting: sandbox.stub().returns({
                    forUpdate: sandbox.stub().returns(
                      Promise.resolve({
                        dfspPositionId: 1,
                        dfspPositionValue: 800,
                        dfspReservedValue: 0
                      })
                    )
                  })
                })
              })
            }),
            update: sandbox.stub().returns({
              where: sandbox.stub().returns({
                transacting: sandbox.stub()
              })
            })
          })
          knexStub.withArgs('participantPositionChange').returns({
            select: sandbox.stub().returns({
              where: sandbox.stub().returns({
                orderBy: sandbox.stub().returns({
                  first: sandbox.stub().returns({
                    transacting: sandbox.stub()
                  })
                })
              })
            }),
            insert: sandbox.stub().returns({
              transacting: sandbox.stub()
            })
          })
          knexStub.withArgs('participantLimit').returns({
            select: sandbox.stub().returns({
              where: sandbox.stub().returns({
                andWhere: sandbox.stub().returns({
                  first: sandbox.stub().returns({
                    transacting: sandbox.stub().returns({
                      forUpdate: sandbox.stub().returns(
                        Promise.resolve({ netDebitCap: 1000 })
                      )
                    })
                  })
                })
              })
            })
          })

          sandbox.stub(Utility, 'produceGeneralMessage').returns()

          const result = await SettlementFacade.settlementTransfersReserve(settlementId, transactionTimestamp, 1, enums)
          test.equal(result, 0, 'Result for successful operation returned')
          test.end()
        } catch (err) {
          logger.error(`settlementTransfersReserve failed with error - ${err}`)
          test.fail()
          test.end()
        }
      })

      await settlementTransfersReserveTest.test('throw error and rollback when called outside of a transaction', async test => {
        try {
          const settlementId = 1
          const transactionTimestamp = new Date().toISOString().replace(/[TZ]/g, ' ').trim()

          const knexStub = sandbox.stub()
          sandbox.stub(Db, 'getKnex').returns(knexStub)
          const trxStub = sandbox.stub()
          knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
          trxStub.rollback = sandbox.stub()

          knexStub.raw = sandbox.stub()
          const context = sandbox.stub()
          context.on = sandbox.stub().returns({
            andOn: sandbox.stub()
          })
          const join1Stub = sandbox.stub().callsArgOn(1, context)
          const join2Stub = sandbox.stub().callsArgOn(1, context)
          const leftJoin1Stub = sandbox.stub().callsArgOn(1, context)
          const join3Stub = sandbox.stub().callsArgOn(1, context)
          const join4Stub = sandbox.stub().callsArgOn(1, context)
          knexStub.returns({
            join: join1Stub.returns({
              join: join2Stub.returns({
                leftJoin: leftJoin1Stub.returns({
                  join: join3Stub.returns({
                    join: sandbox.stub().returns({
                      join: sandbox.stub().returns({
                        join: join4Stub.returns({
                          select: sandbox.stub().returns({
                            where: sandbox.stub().returns({
                              whereNull: sandbox.stub().returns({
                                transacting: sandbox.stub().returns(
                                  Promise.resolve(
                                    stubData.settlementTransfersReserve.settlementTransferList
                                  )
                                )
                              })
                            })
                          })
                        })
                      })
                    })
                  })
                })
              })
            }),
            insert: sandbox.stub().returns({
              transacting: sandbox.stub().throws(new Error('Insert failed'))
            })
          })
          knexStub.withArgs('participantPosition').returns({
            select: sandbox.stub().returns({
              where: sandbox.stub().returns({
                first: sandbox.stub().returns({
                  transacting: sandbox.stub().returns({
                    forUpdate: sandbox.stub().returns(
                      Promise.resolve({
                        participantPositionId: 1,
                        positionValue: 800,
                        reservedValue: 0
                      })
                    )
                  })
                })
              })
            }),
            update: sandbox.stub().returns({
              where: sandbox.stub().returns({
                transacting: sandbox.stub()
              })
            })
          })
          knexStub.withArgs('participantLimit').returns({
            select: sandbox.stub().returns({
              where: sandbox.stub().returns({
                andWhere: sandbox.stub().returns({
                  first: sandbox.stub().returns({
                    transacting: sandbox.stub().returns({
                      forUpdate: sandbox.stub().returns(
                        Promise.resolve({ netDebitCap: 1000 })
                      )
                    })
                  })
                })
              })
            })
          })

          await SettlementFacade.settlementTransfersReserve(settlementId, transactionTimestamp, 1, enums)
          test.fail('Error not thrown!')
          test.end()
        } catch (err) {
          logger.error(`settlementTransfersReserve failed with error - ${err}`)
          test.pass('Error thrown')
          test.end()
        }
      })

      await settlementTransfersReserveTest.end()
    } catch (err) {
      logger.error(`settlementFacadeTest failed with error - ${err}`)
      settlementTransfersReserveTest.fail()
      settlementTransfersReserveTest.end()
    }
  })

  await settlementFacadeTest.test('settlementTransfersAbort should', async settlementTransfersAbortTest => {
    try {
      await settlementTransfersAbortTest.test('throw error if database is not available', async test => {
        try {
          const settlementId = 1
          const transactionTimestamp = new Date().toISOString().replace(/[TZ]/g, ' ').trim()
          const trxStub = sandbox.stub()

          const knexStub = sandbox.stub().throws(new Error('Database unavailable'))
          sandbox.stub(Db, 'getKnex').returns(knexStub)

          await SettlementFacade.settlementTransfersAbort(settlementId, transactionTimestamp, enums, trxStub)
          test.fail('Error not thrown!')
          test.end()
        } catch (err) {
          logger.error(`settlementTransfersAbort failed with error - ${err}`)
          test.pass('Error thrown')
          test.end()
        }
      })

      await settlementTransfersAbortTest.test('make transfer commit when called from within a transaction', async test => {
        try {
          const settlementId = 1
          const transactionTimestamp = new Date().toISOString().replace(/[TZ]/g, ' ').trim()
          const trxStub = sandbox.stub()

          const knexStub = sandbox.stub()
          knexStub.raw = sandbox.stub()
          sandbox.stub(Db, 'getKnex').returns(knexStub)
          const context = sandbox.stub()
          context.on = sandbox.stub().returns({
            andOn: sandbox.stub()
          })
          const join1Stub = sandbox.stub().callsArgOn(1, context)
          const leftJoin1Stub = sandbox.stub().callsArgOn(1, context)
          const leftJoin2Stub = sandbox.stub().callsArgOn(1, context)
          const join2Stub = sandbox.stub().callsArgOn(1, context)
          const join3Stub = sandbox.stub().callsArgOn(1, context)
          knexStub.returns({
            join: join1Stub.returns({
              leftJoin: sandbox.stub().returns({
                leftJoin: leftJoin1Stub.returns({
                  leftJoin: sandbox.stub().returns({
                    leftJoin: leftJoin2Stub.returns({
                      join: join2Stub.returns({
                        join: sandbox.stub().returns({
                          join: sandbox.stub().returns({
                            join: join3Stub.returns({
                              select: sandbox.stub().returns({
                                where: sandbox.stub().returns({
                                  whereNull: sandbox.stub().returns({
                                    transacting: sandbox.stub().returns(
                                      Promise.resolve(
                                        stubData.settlementTransfersAbort.settlementTransferList
                                      )
                                    )
                                  })
                                })
                              })
                            })
                          })
                        })
                      })
                    })
                  })

                })
              })
            }),
            insert: sandbox.stub().returns({
              transacting: sandbox.stub()
            })
          })
          knexStub.withArgs('participantPosition').returns({
            select: sandbox.stub().returns({
              where: sandbox.stub().returns({
                first: sandbox.stub().returns({
                  transacting: sandbox.stub().returns({
                    forUpdate: sandbox.stub().returns(
                      Promise.resolve({
                        dfspPositionId: 1,
                        dfspPositionValue: 0,
                        dfspAbortedValue: 0
                      })
                    )
                  })
                })
              })
            }),
            update: sandbox.stub().returns({
              where: sandbox.stub().returns({
                transacting: sandbox.stub()
              })
            })
          })
          knexStub.withArgs('participantPositionChange').returns({
            select: sandbox.stub().returns({
              where: sandbox.stub().returns({
                orderBy: sandbox.stub().returns({
                  first: sandbox.stub().returns({
                    transacting: sandbox.stub()
                  })
                })
              })
            }),
            insert: sandbox.stub().returns({
              transacting: sandbox.stub()
            })
          })
          knexStub.withArgs('participantLimit').returns({
            select: sandbox.stub().returns({
              where: sandbox.stub().returns({
                andWhere: sandbox.stub().returns({
                  first: sandbox.stub().returns({
                    transacting: sandbox.stub().returns({
                      forUpdate: sandbox.stub().returns(
                        Promise.resolve({ netDebitCap: 1000 })
                      )
                    })
                  })
                })
              })
            })
          })
          ParticipantFacade.adjustLimits = sandbox.stub()

          sandbox.stub(Utility, 'produceGeneralMessage').returns()

          const result = await SettlementFacade.settlementTransfersAbort(settlementId, transactionTimestamp, enums, trxStub)
          test.equal(result, 0, 'Result for successful operation returned')
          test.equal(knexStub.withArgs('settlementParticipantCurrency AS spc').callCount, 1)
          test.equal(knexStub.withArgs('transferStateChange').callCount, 6)
          test.equal(knexStub.withArgs('participantPosition').callCount, 8)
          test.equal(knexStub.withArgs('participantPosition').callCount, 8)
          test.equal(knexStub.withArgs('transferFulfilment').callCount, 0)
          test.equal(knexStub.withArgs('participantPositionChange').callCount, 4)

          test.end()
        } catch (err) {
          logger.error(`settlementTransfersAbort failed with error - ${err}`)
          test.fail()
          test.end()
        }
      })

      await settlementTransfersAbortTest.test('throw error if insert fails', async test => {
        try {
          const settlementId = 1
          const transactionTimestamp = new Date().toISOString().replace(/[TZ]/g, ' ').trim()
          const trxStub = sandbox.stub()

          const knexStub = sandbox.stub()
          knexStub.raw = sandbox.stub()
          sandbox.stub(Db, 'getKnex').returns(knexStub)
          const context = sandbox.stub()
          context.on = sandbox.stub().returns({
            andOn: sandbox.stub()
          })
          const join1Stub = sandbox.stub().callsArgOn(1, context)
          const join2Stub = sandbox.stub().callsArgOn(1, context)
          const leftJoin1Stub = sandbox.stub().callsArgOn(1, context)
          const join3Stub = sandbox.stub().callsArgOn(1, context)
          const join4Stub = sandbox.stub().callsArgOn(1, context)
          knexStub.returns({
            join: join1Stub.returns({
              leftJoin: join2Stub.returns({
                leftJoin: leftJoin1Stub.returns({
                  join: join3Stub.returns({
                    join: sandbox.stub().returns({
                      join: sandbox.stub().returns({
                        join: join4Stub.returns({
                          select: sandbox.stub().returns({
                            where: sandbox.stub().returns({
                              whereNull: sandbox.stub().returns({
                                transacting: sandbox.stub().returns(
                                  Promise.resolve(
                                    stubData.settlementTransfersAbort.settlementTransferList
                                  )
                                )
                              })
                            })
                          })
                        })
                      })
                    })
                  })
                })
              })
            }),
            insert: sandbox.stub().returns({
              transacting: sandbox.stub().throws(new Error('Insert failed'))
            })
          })
          knexStub.withArgs('participantPosition').returns({
            select: sandbox.stub().returns({
              where: sandbox.stub().returns({
                first: sandbox.stub().returns({
                  transacting: sandbox.stub().returns({
                    forUpdate: sandbox.stub().returns(
                      Promise.resolve({
                        dfspPositionId: 1,
                        dfspPositionValue: 0,
                        dfspAbortedValue: 0
                      })
                    )
                  })
                })
              })
            }),
            update: sandbox.stub().returns({
              where: sandbox.stub().returns({
                transacting: sandbox.stub()
              })
            })
          })
          knexStub.withArgs('participantPositionChange').returns({
            select: sandbox.stub().returns({
              where: sandbox.stub().returns({
                orderBy: sandbox.stub().returns({
                  first: sandbox.stub().returns({
                    transacting: sandbox.stub()
                  })
                })
              })
            }),
            insert: sandbox.stub().returns({
              transacting: sandbox.stub()
            })
          })
          knexStub.withArgs('participantLimit').returns({
            select: sandbox.stub().returns({
              where: sandbox.stub().returns({
                andWhere: sandbox.stub().returns({
                  first: sandbox.stub().returns({
                    transacting: sandbox.stub().returns({
                      forUpdate: sandbox.stub().returns(
                        Promise.resolve({ netDebitCap: 1000 })
                      )
                    })
                  })
                })
              })
            })
          })

          await SettlementFacade.settlementTransfersAbort(settlementId, transactionTimestamp, enums, trxStub)
          test.fail('Error not thrown!')
          test.end()
        } catch (err) {
          logger.error(`settlementTransfersAbort failed with error - ${err}`)
          test.pass('Error thrown')
          test.end()
        }
      })

      await settlementTransfersAbortTest.test('make transfer commit in a new transaction and commit it when called from outside of a transaction', async test => {
        try {
          const settlementId = 1
          const transactionTimestamp = new Date().toISOString().replace(/[TZ]/g, ' ').trim()

          const knexStub = sandbox.stub()
          sandbox.stub(Db, 'getKnex').returns(knexStub)
          const trxStub = sandbox.stub()
          knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
          trxStub.commit = sandbox.stub()

          knexStub.raw = sandbox.stub()
          const context = sandbox.stub()
          context.on = sandbox.stub().returns({
            andOn: sandbox.stub()
          })
          const join1Stub = sandbox.stub().callsArgOn(1, context)
          const leftJoin1Stub = sandbox.stub().callsArgOn(1, context)
          const leftJoin2Stub = sandbox.stub().callsArgOn(1, context)
          const join2Stub = sandbox.stub().callsArgOn(1, context)
          const join3Stub = sandbox.stub().callsArgOn(1, context)
          knexStub.returns({
            join: join1Stub.returns({
              leftJoin: sandbox.stub().returns({
                leftJoin: leftJoin1Stub.returns({
                  leftJoin: sandbox.stub().returns({
                    leftJoin: leftJoin2Stub.returns({
                      join: join2Stub.returns({
                        join: sandbox.stub().returns({
                          join: sandbox.stub().returns({
                            join: join3Stub.returns({
                              select: sandbox.stub().returns({
                                where: sandbox.stub().returns({
                                  whereNull: sandbox.stub().returns({
                                    transacting: sandbox.stub().returns(
                                      Promise.resolve(
                                        stubData.settlementTransfersAbort.settlementTransferList
                                      )
                                    )
                                  })
                                })
                              })
                            })
                          })
                        })
                      })
                    })
                  })

                })
              })
            }),
            insert: sandbox.stub().returns({
              transacting: sandbox.stub()
            })
          })
          knexStub.withArgs('participantPosition').returns({
            select: sandbox.stub().returns({
              where: sandbox.stub().returns({
                first: sandbox.stub().returns({
                  transacting: sandbox.stub().returns({
                    forUpdate: sandbox.stub().returns(
                      Promise.resolve({
                        dfspPositionId: 1,
                        dfspPositionValue: 800,
                        dfspAbortedValue: 0
                      })
                    )
                  })
                })
              })
            }),
            update: sandbox.stub().returns({
              where: sandbox.stub().returns({
                transacting: sandbox.stub()
              })
            })
          })
          knexStub.withArgs('participantPositionChange').returns({
            select: sandbox.stub().returns({
              where: sandbox.stub().returns({
                orderBy: sandbox.stub().returns({
                  first: sandbox.stub().returns({
                    transacting: sandbox.stub()
                  })
                })
              })
            }),
            insert: sandbox.stub().returns({
              transacting: sandbox.stub()
            })
          })
          knexStub.withArgs('participantLimit').returns({
            select: sandbox.stub().returns({
              where: sandbox.stub().returns({
                andWhere: sandbox.stub().returns({
                  first: sandbox.stub().returns({
                    transacting: sandbox.stub().returns({
                      forUpdate: sandbox.stub().returns(
                        Promise.resolve({ netDebitCap: 1000 })
                      )
                    })
                  })
                })
              })
            })
          })

          sandbox.stub(Utility, 'produceGeneralMessage').returns()

          const result = await SettlementFacade.settlementTransfersAbort(settlementId, transactionTimestamp, enums)
          test.equal(result, 0, 'Result for successful operation returned')
          test.end()
        } catch (err) {
          logger.error(`settlementTransfersAbort failed with error - ${err}`)
          test.fail()
          test.end()
        }
      })

      await settlementTransfersAbortTest.test('throw error and rollback when called outside of a transaction', async test => {
        try {
          const settlementId = 1
          const transactionTimestamp = new Date().toISOString().replace(/[TZ]/g, ' ').trim()

          const knexStub = sandbox.stub()
          sandbox.stub(Db, 'getKnex').returns(knexStub)
          const trxStub = sandbox.stub()
          knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
          trxStub.rollback = sandbox.stub()

          knexStub.raw = sandbox.stub()
          const context = sandbox.stub()
          context.on = sandbox.stub().returns({
            andOn: sandbox.stub()
          })
          const join1Stub = sandbox.stub().callsArgOn(1, context)
          const leftJoin1Stub = sandbox.stub().callsArgOn(1, context)
          const leftJoin2Stub = sandbox.stub().callsArgOn(1, context)
          const join2Stub = sandbox.stub().callsArgOn(1, context)
          const join3Stub = sandbox.stub().callsArgOn(1, context)
          knexStub.returns({
            join: join1Stub.returns({
              leftJoin: sandbox.stub().returns({
                leftJoin: leftJoin1Stub.returns({
                  leftJoin: sandbox.stub().returns({
                    leftJoin: leftJoin2Stub.returns({
                      join: join2Stub.returns({
                        join: sandbox.stub().returns({
                          join: sandbox.stub().returns({
                            join: join3Stub.returns({
                              select: sandbox.stub().returns({
                                where: sandbox.stub().returns({
                                  whereNull: sandbox.stub().returns({
                                    transacting: sandbox.stub().returns(
                                      Promise.resolve(
                                        stubData.settlementTransfersAbort.settlementTransferList
                                      )
                                    )
                                  })
                                })
                              })
                            })
                          })
                        })
                      })
                    })
                  })

                })
              })
            }),
            insert: sandbox.stub().returns({
              transacting: sandbox.stub().throws(new Error('Insert failed'))
            })
          })
          knexStub.withArgs('participantPosition').returns({
            select: sandbox.stub().returns({
              where: sandbox.stub().returns({
                first: sandbox.stub().returns({
                  transacting: sandbox.stub().returns({
                    forUpdate: sandbox.stub().returns(
                      Promise.resolve({
                        participantPositionId: 1,
                        positionValue: 800,
                        reservedValue: 0
                      })
                    )
                  })
                })
              })
            }),
            update: sandbox.stub().returns({
              where: sandbox.stub().returns({
                transacting: sandbox.stub()
              })
            })
          })
          knexStub.withArgs('participantLimit').returns({
            select: sandbox.stub().returns({
              where: sandbox.stub().returns({
                andWhere: sandbox.stub().returns({
                  first: sandbox.stub().returns({
                    transacting: sandbox.stub().returns({
                      forUpdate: sandbox.stub().returns(
                        Promise.resolve({ netDebitCap: 1000 })
                      )
                    })
                  })
                })
              })
            })
          })

          await SettlementFacade.settlementTransfersAbort(settlementId, transactionTimestamp, enums)
          test.fail('Error not thrown!')
          test.end()
        } catch (err) {
          logger.error(`settlementTransfersAbort failed with error - ${err}`)
          test.pass('Error thrown')
          test.end()
        }
      })

      await settlementTransfersAbortTest.test('throw error and rollback when called from a transaction', async test => {
        try {
          const settlementId = 1
          const transactionTimestamp = new Date().toISOString().replace(/[TZ]/g, ' ').trim()

          const knexStub = sandbox.stub()
          sandbox.stub(Db, 'getKnex').returns(knexStub)
          const trxStub = sandbox.stub()
          knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
          trxStub.rollback = sandbox.stub()

          knexStub.raw = sandbox.stub()
          const context = sandbox.stub()
          context.on = sandbox.stub().returns({
            andOn: sandbox.stub()
          })
          const join1Stub = sandbox.stub().callsArgOn(1, context)
          const leftJoin1Stub = sandbox.stub().callsArgOn(1, context)
          const leftJoin2Stub = sandbox.stub().callsArgOn(1, context)
          const join2Stub = sandbox.stub().callsArgOn(1, context)
          const join3Stub = sandbox.stub().callsArgOn(1, context)
          knexStub.returns({
            join: join1Stub.returns({
              leftJoin: sandbox.stub().returns({
                leftJoin: leftJoin1Stub.returns({
                  leftJoin: sandbox.stub().returns({
                    leftJoin: leftJoin2Stub.returns({
                      join: join2Stub.returns({
                        join: sandbox.stub().returns({
                          join: sandbox.stub().returns({
                            join: join3Stub.returns({
                              select: sandbox.stub().returns({
                                where: sandbox.stub().returns({
                                  whereNull: sandbox.stub().returns({
                                    transacting: sandbox.stub().returns(
                                      Promise.resolve(
                                        stubData.settlementTransfersAbort.settlementTransferList
                                      )
                                    )
                                  })
                                })
                              })
                            })
                          })
                        })
                      })
                    })
                  })

                })
              })
            }),
            insert: sandbox.stub().returns({
              transacting: sandbox.stub().throws(new Error('Insert failed'))
            })
          })
          knexStub.withArgs('participantPosition').returns({
            select: sandbox.stub().returns({
              where: sandbox.stub().returns({
                first: sandbox.stub().returns({
                  transacting: sandbox.stub().returns({
                    forUpdate: sandbox.stub().returns(
                      Promise.resolve({
                        participantPositionId: 1,
                        positionValue: 800,
                        reservedValue: 0
                      })
                    )
                  })
                })
              })
            }),
            update: sandbox.stub().returns({
              where: sandbox.stub().returns({
                transacting: sandbox.stub()
              })
            })
          })
          knexStub.withArgs('participantLimit').returns({
            select: sandbox.stub().returns({
              where: sandbox.stub().returns({
                andWhere: sandbox.stub().returns({
                  first: sandbox.stub().returns({
                    transacting: sandbox.stub().returns({
                      forUpdate: sandbox.stub().returns(
                        Promise.resolve({ netDebitCap: 1000 })
                      )
                    })
                  })
                })
              })
            })
          })

          await SettlementFacade.settlementTransfersAbort(settlementId, transactionTimestamp, enums, trxStub)
          test.fail('Error not thrown!')
          test.end()
        } catch (err) {
          logger.error(`settlementTransfersAbort failed with error - ${err}`)
          test.pass('Error thrown')
          test.end()
        }
      })

      await settlementTransfersAbortTest.end()
    } catch (err) {
      logger.error(`settlementFacadeTest failed with error - ${err}`)
      settlementTransfersAbortTest.fail()
      settlementTransfersAbortTest.end()
    }
  })

  await settlementFacadeTest.test('settlementTransferCommit should', async settlementTransfersCommitTest => {
    try {
      await settlementTransfersCommitTest.test('throw error if database is not available', async test => {
        try {
          const settlementId = 1
          const transactionTimestamp = new Date().toISOString().replace(/[TZ]/g, ' ').trim()
          const trxStub = sandbox.stub()

          const knexStub = sandbox.stub().throws(new Error('Database unavailable'))
          sandbox.stub(Db, 'getKnex').returns(knexStub)

          await SettlementFacade.settlementTransfersCommit(settlementId, transactionTimestamp, enums, trxStub)
          test.fail('Error not thrown!')
          test.end()
        } catch (err) {
          logger.error(`settlementTransfersCommit failed with error - ${err}`)
          test.pass('Error thrown')
          test.end()
        }
      })

      await settlementTransfersCommitTest.test('make transfer commit when called from within a transaction', async test => {
        try {
          const settlementId = 1
          const transactionTimestamp = new Date().toISOString().replace(/[TZ]/g, ' ').trim()
          const trxStub = sandbox.stub()

          const knexStub = sandbox.stub()
          knexStub.raw = sandbox.stub()
          sandbox.stub(Db, 'getKnex').returns(knexStub)
          const context = sandbox.stub()
          context.on = sandbox.stub().returns({
            andOn: sandbox.stub()
          })
          const join1Stub = sandbox.stub().callsArgOn(1, context)
          const join2Stub = sandbox.stub().callsArgOn(1, context)
          const leftJoin1Stub = sandbox.stub().callsArgOn(1, context)
          const join3Stub = sandbox.stub().callsArgOn(1, context)
          const join4Stub = sandbox.stub().callsArgOn(1, context)
          knexStub.returns({
            join: join1Stub.returns({
              join: join2Stub.returns({
                leftJoin: leftJoin1Stub.returns({
                  join: join3Stub.returns({
                    join: sandbox.stub().returns({
                      join: sandbox.stub().returns({
                        join: join4Stub.returns({
                          select: sandbox.stub().returns({
                            where: sandbox.stub().returns({
                              whereNull: sandbox.stub().returns({
                                transacting: sandbox.stub().returns(
                                  Promise.resolve(
                                    stubData.settlementTransfersCommit.settlementTransferList
                                  )
                                )
                              })
                            })
                          })
                        })
                      })
                    })
                  })
                })
              })
            }),
            insert: sandbox.stub().returns({
              transacting: sandbox.stub()
            })
          })
          knexStub.withArgs('participantPosition').returns({
            select: sandbox.stub().returns({
              where: sandbox.stub().returns({
                first: sandbox.stub().returns({
                  transacting: sandbox.stub().returns({
                    forUpdate: sandbox.stub().returns(
                      Promise.resolve({
                        participantPositionId: 1,
                        positionValue: 800,
                        reservedValue: 0
                      })
                    )
                  })
                })
              })
            }),
            update: sandbox.stub().returns({
              where: sandbox.stub().returns({
                transacting: sandbox.stub()
              })
            })
          })
          knexStub.withArgs('participantLimit').returns({
            select: sandbox.stub().returns({
              where: sandbox.stub().returns({
                andWhere: sandbox.stub().returns({
                  first: sandbox.stub().returns({
                    transacting: sandbox.stub().returns({
                      forUpdate: sandbox.stub().returns(
                        Promise.resolve({ netDebitCap: 1000 })
                      )
                    })
                  })
                })
              })
            })
          })
          ParticipantFacade.adjustLimits = sandbox.stub()
          sandbox.stub(Utility, 'produceGeneralMessage').returns()

          const result = await SettlementFacade.settlementTransfersCommit(settlementId, transactionTimestamp, enums, trxStub)
          test.equal(result, 0, 'Result for successful operation returned')
          test.equal(knexStub.withArgs('settlementParticipantCurrency AS spc').callCount, 1)
          test.equal(knexStub.withArgs('participantPosition').callCount, 4)
          test.equal(knexStub.withArgs('participantPosition').callCount, 4)
          test.equal(knexStub.withArgs('transferFulfilment').callCount, 2)
          test.equal(knexStub.withArgs('transferStateChange').callCount, 4)
          test.equal(knexStub.withArgs('participantPositionChange').callCount, 2)

          test.end()
        } catch (err) {
          logger.error(`settlementTransfersCommit failed with error - ${err}`)
          test.fail()
          test.end()
        }
      })

      await settlementTransfersCommitTest.test('throw error if insert fails', async test => {
        try {
          const settlementId = 1
          const transactionTimestamp = new Date().toISOString().replace(/[TZ]/g, ' ').trim()
          const trxStub = sandbox.stub()

          const knexStub = sandbox.stub()
          knexStub.raw = sandbox.stub()
          sandbox.stub(Db, 'getKnex').returns(knexStub)
          const context = sandbox.stub()
          context.on = sandbox.stub().returns({
            andOn: sandbox.stub()
          })
          const join1Stub = sandbox.stub().callsArgOn(1, context)
          const join2Stub = sandbox.stub().callsArgOn(1, context)
          const leftJoin1Stub = sandbox.stub().callsArgOn(1, context)
          const join3Stub = sandbox.stub().callsArgOn(1, context)
          const join4Stub = sandbox.stub().callsArgOn(1, context)
          knexStub.returns({
            join: join1Stub.returns({
              join: join2Stub.returns({
                leftJoin: leftJoin1Stub.returns({
                  join: join3Stub.returns({
                    join: sandbox.stub().returns({
                      join: sandbox.stub().returns({
                        join: join4Stub.returns({
                          select: sandbox.stub().returns({
                            where: sandbox.stub().returns({
                              whereNull: sandbox.stub().returns({
                                transacting: sandbox.stub().returns(
                                  Promise.resolve(
                                    stubData.settlementTransfersCommit.settlementTransferList
                                  )
                                )
                              })
                            })
                          })
                        })
                      })
                    })
                  })
                })
              })
            }),
            insert: sandbox.stub().returns({
              transacting: sandbox.stub().throws(new Error('Insert failed'))
            })
          })
          knexStub.withArgs('participantPosition').returns({
            select: sandbox.stub().returns({
              where: sandbox.stub().returns({
                first: sandbox.stub().returns({
                  transacting: sandbox.stub().returns({
                    forUpdate: sandbox.stub().returns(
                      Promise.resolve({
                        participantPositionId: 1,
                        positionValue: 800,
                        reservedValue: 0
                      })
                    )
                  })
                })
              })
            }),
            update: sandbox.stub().returns({
              where: sandbox.stub().returns({
                transacting: sandbox.stub()
              })
            })
          })
          knexStub.withArgs('participantLimit').returns({
            select: sandbox.stub().returns({
              where: sandbox.stub().returns({
                andWhere: sandbox.stub().returns({
                  first: sandbox.stub().returns({
                    transacting: sandbox.stub().returns({
                      forUpdate: sandbox.stub().returns(
                        Promise.resolve({ netDebitCap: 1000 })
                      )
                    })
                  })
                })
              })
            })
          })

          await SettlementFacade.settlementTransfersCommit(settlementId, transactionTimestamp, enums, trxStub)
          test.fail('Error not thrown!')
          test.end()
        } catch (err) {
          logger.error(`settlementTransfersCommit failed with error - ${err}`)
          test.pass('Error thrown')
          test.end()
        }
      })

      await settlementTransfersCommitTest.test('make transfer commit in a new transaction and commit it when called from outside of a transaction', async test => {
        try {
          const settlementId = 1
          const transactionTimestamp = new Date().toISOString().replace(/[TZ]/g, ' ').trim()

          const knexStub = sandbox.stub()
          sandbox.stub(Db, 'getKnex').returns(knexStub)
          const trxStub = sandbox.stub()
          knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
          trxStub.commit = sandbox.stub()

          knexStub.raw = sandbox.stub()
          const context = sandbox.stub()
          context.on = sandbox.stub().returns({
            andOn: sandbox.stub()
          })
          const join1Stub = sandbox.stub().callsArgOn(1, context)
          const join2Stub = sandbox.stub().callsArgOn(1, context)
          const leftJoin1Stub = sandbox.stub().callsArgOn(1, context)
          const join3Stub = sandbox.stub().callsArgOn(1, context)
          const join4Stub = sandbox.stub().callsArgOn(1, context)
          knexStub.returns({
            join: join1Stub.returns({
              join: join2Stub.returns({
                leftJoin: leftJoin1Stub.returns({
                  join: join3Stub.returns({
                    join: sandbox.stub().returns({
                      join: sandbox.stub().returns({
                        join: join4Stub.returns({
                          select: sandbox.stub().returns({
                            where: sandbox.stub().returns({
                              whereNull: sandbox.stub().returns({
                                transacting: sandbox.stub().returns(
                                  Promise.resolve(
                                    stubData.settlementTransfersCommit.settlementTransferList
                                  )
                                )
                              })
                            })
                          })
                        })
                      })
                    })
                  })
                })
              })
            }),
            insert: sandbox.stub().returns({
              transacting: sandbox.stub()
            })
          })
          knexStub.withArgs('participantPosition').returns({
            select: sandbox.stub().returns({
              where: sandbox.stub().returns({
                first: sandbox.stub().returns({
                  transacting: sandbox.stub().returns({
                    forUpdate: sandbox.stub().returns(
                      Promise.resolve({
                        participantPositionId: 1,
                        positionValue: 800,
                        reservedValue: 0
                      })
                    )
                  })
                })
              })
            }),
            update: sandbox.stub().returns({
              where: sandbox.stub().returns({
                transacting: sandbox.stub()
              })
            })
          })
          knexStub.withArgs('participantLimit').returns({
            select: sandbox.stub().returns({
              where: sandbox.stub().returns({
                andWhere: sandbox.stub().returns({
                  first: sandbox.stub().returns({
                    transacting: sandbox.stub().returns({
                      forUpdate: sandbox.stub().returns(
                        Promise.resolve({ netDebitCap: 1000 })
                      )
                    })
                  })
                })
              })
            })
          })

          sandbox.stub(Utility, 'produceGeneralMessage').returns()

          const result = await SettlementFacade.settlementTransfersCommit(settlementId, transactionTimestamp, enums)
          test.equal(result, 0, 'Result for successful operation returned')
          test.end()
        } catch (err) {
          logger.error(`settlementTransfersCommit failed with error - ${err}`)
          test.fail()
          test.end()
        }
      })

      await settlementTransfersCommitTest.test('throw error and rollback when called outside of a transaction', async test => {
        try {
          const settlementId = 1
          const transactionTimestamp = new Date().toISOString().replace(/[TZ]/g, ' ').trim()

          const knexStub = sandbox.stub()
          sandbox.stub(Db, 'getKnex').returns(knexStub)
          const trxStub = sandbox.stub()
          knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
          trxStub.rollback = sandbox.stub()

          knexStub.raw = sandbox.stub()
          const context = sandbox.stub()
          context.on = sandbox.stub().returns({
            andOn: sandbox.stub()
          })
          const join1Stub = sandbox.stub().callsArgOn(1, context)
          const join2Stub = sandbox.stub().callsArgOn(1, context)
          const leftJoin1Stub = sandbox.stub().callsArgOn(1, context)
          const join3Stub = sandbox.stub().callsArgOn(1, context)
          const join4Stub = sandbox.stub().callsArgOn(1, context)
          knexStub.returns({
            join: join1Stub.returns({
              join: join2Stub.returns({
                leftJoin: leftJoin1Stub.returns({
                  join: join3Stub.returns({
                    join: sandbox.stub().returns({
                      join: sandbox.stub().returns({
                        join: join4Stub.returns({
                          select: sandbox.stub().returns({
                            where: sandbox.stub().returns({
                              whereNull: sandbox.stub().returns({
                                transacting: sandbox.stub().returns(
                                  Promise.resolve(
                                    stubData.settlementTransfersCommit.settlementTransferList
                                  )
                                )
                              })
                            })
                          })
                        })
                      })
                    })
                  })
                })
              })
            }),
            insert: sandbox.stub().returns({
              transacting: sandbox.stub().throws(new Error('Insert failed'))
            })
          })
          knexStub.withArgs('participantPosition').returns({
            select: sandbox.stub().returns({
              where: sandbox.stub().returns({
                first: sandbox.stub().returns({
                  transacting: sandbox.stub().returns({
                    forUpdate: sandbox.stub().returns(
                      Promise.resolve({
                        participantPositionId: 1,
                        positionValue: 800,
                        reservedValue: 0
                      })
                    )
                  })
                })
              })
            }),
            update: sandbox.stub().returns({
              where: sandbox.stub().returns({
                transacting: sandbox.stub()
              })
            })
          })
          knexStub.withArgs('participantLimit').returns({
            select: sandbox.stub().returns({
              where: sandbox.stub().returns({
                andWhere: sandbox.stub().returns({
                  first: sandbox.stub().returns({
                    transacting: sandbox.stub().returns({
                      forUpdate: sandbox.stub().returns(
                        Promise.resolve({ netDebitCap: 1000 })
                      )
                    })
                  })
                })
              })
            })
          })

          await SettlementFacade.settlementTransfersCommit(settlementId, transactionTimestamp, enums)
          test.fail('Error not thrown!')
          test.end()
        } catch (err) {
          logger.error(`settlementTransfersCommit failed with error - ${err}`)
          test.pass('Error thrown')
          test.end()
        }
      })

      await settlementTransfersCommitTest.end()
    } catch (err) {
      logger.error(`settlementFacadeTest failed with error - ${err}`)
      settlementTransfersCommitTest.fail()
      settlementTransfersCommitTest.end()
    }
  })

  await settlementFacadeTest.test('putById should', async putByIdTest => {
    try {
      await putByIdTest.test('throw error if settlement is not found', async test => {
        try {
          sandbox.stub(Db, 'getKnex')
          const knexStub = sandbox.stub()
          const trxStub = sandbox.stub()
          trxStub.commit = sandbox.stub()
          knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)

          Db.getKnex.returns(knexStub)
          knexStub.returns({
            join: sandbox.stub().returns({
              join: sandbox.stub().returns({
                select: sandbox.stub().returns({
                  where: sandbox.stub().returns({
                    first: sandbox.stub().returns({
                      transacting: sandbox.stub().returns({
                        forUpdate: sandbox.stub().returns(
                          Promise.resolve(undefined)
                        )
                      })
                    })
                  })
                })
              })
            })
          })

          await SettlementFacade.putById(1, payload.putById[0], enums)
          test.fail('Error not thrown!')
          test.end()
        } catch (err) {
          test.ok(err instanceof FSPIOPError)
          test.equal(err.message, 'Settlement not found', 'error message matched')
          logger.error(`putById failed with error - ${err}`)
          test.end()
        }
      })

      await putByIdTest.test('process payload as defined in specification', async test => {
        try {
          sandbox.stub(Db, 'getKnex')
          const knexStub = sandbox.stub()
          const trxStub = sandbox.stub()
          trxStub.commit = sandbox.stub()
          knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)

          Db.getKnex.returns(knexStub)
          knexStub.returns({
            join: sandbox.stub().returns({
              join: sandbox.stub().returns({
                select: sandbox.stub().returns({
                  where: sandbox.stub().returns({
                    first: sandbox.stub().returns({
                      transacting: sandbox.stub().returns({
                        forUpdate: sandbox.stub().returns(
                          Promise.resolve(stubData.putById[0].settlementData)
                        )
                      })
                    }),
                    transacting: sandbox.stub().returns({
                      forUpdate: sandbox.stub().returns(
                        Promise.resolve(stubData.putById[0].windowsList)
                      )
                    })
                  })
                })
              }),
              leftJoin: sandbox.stub().returns({
                select: sandbox.stub().returns({
                  where: sandbox.stub().returns({
                    whereNotNull: sandbox.stub().returns({
                      whereNull: sandbox.stub().returns({
                        transacting: sandbox.stub().returns(
                          Promise.resolve(stubData.putById[0].settlementTransferList)
                        )
                      })
                    })
                  })
                })
              })
            }),
            leftJoin: sandbox.stub().returns({
              join: sandbox.stub().returns({
                select: sandbox.stub().returns({
                  where: sandbox.stub().returns({
                    transacting: sandbox.stub().returns({
                      forUpdate: sandbox.stub().returns(
                        Promise.resolve(stubData.putById[0].settlementAccountList)
                      )
                    })
                  })
                })
              })
            }),
            select: sandbox.stub().returns({
              distinct: sandbox.stub().returns({
                where: sandbox.stub().returns({
                  transacting: sandbox.stub().returns({
                    forUpdate: sandbox.stub().returns(
                      Promise.resolve(stubData.putById[0].windowsAccountsList)
                    )
                  })
                })
              })
            }),
            insert: sandbox.stub().returns({
              transacting: sandbox.stub().returns(
                Promise.resolve([21, 22, 23])
              )
            }),
            where: sandbox.stub().returns({
              update: sandbox.stub().returns({
                transacting: sandbox.stub().returns(
                  Promise.resolve()
                )
              })
            }),
            transacting: sandbox.stub().returns({
              join: sandbox.stub().returns({
                join: sandbox.stub().returns({
                  join: sandbox.stub().returns({
                    join: sandbox.stub().returns({
                      join: sandbox.stub().returns({
                        whereIn: sandbox.stub().returns({
                          where: sandbox.stub().returns({
                            distinct: sandbox.stub().returns({
                              orderBy: sandbox.stub().returns(stubData.putById[0].processedContent)
                            })
                          })
                        })
                      })
                    })
                  })
                })
              })
            })
          })
          SettlementFacade.settlementTransfersPrepare = sandbox.stub()
          SettlementFacade.settlementTransfersReserve = sandbox.stub()
          SettlementFacade.settlementTransfersCommit = sandbox.stub()

          const result = await SettlementFacade.putById(1, payload.putById[0], enums)
          test.ok(result, 'Result returned')
          test.equal(knexStub.callCount, 9, 'Knex called 9 times')
          test.equal(result.state, 'PENDING_SETTLEMENT', 'Settlement should remain in PENDING_SETTLEMENT state')
          test.equal(result.settlementWindows.length, 2, 'Exactly two settlement windows are expected to be affected')
          test.equal(result.participants.length, 2, 'Two participants are affected')
          test.equal(result.participants[0].accounts.length, 6, 'Six accounts for first participant are affected')
          test.equal(result.participants[1].accounts.length, 1, 'One account for second participant is affected')
          test.equal(result.participants[0].accounts[0].id, 11, 'First account processed has id 11')
          test.equal(result.participants[0].accounts[0].errorInformation.errorDescription, 'Generic client error - Account not found', 'First account returns error "Account not found"')
          test.equal(result.participants[0].accounts[1].id, 1, 'Second account processed has id 1')
          test.equal(result.participants[0].accounts[1].state, 'PS_TRANSFERS_RECORDED', 'Second account is PS_TRANSFERS_RECORDED')
          test.equal(result.participants[0].accounts[2].id, 2, 'Third account processed has id 2')
          test.equal(result.participants[0].accounts[2].state, 'PS_TRANSFERS_RECORDED', 'Third account is PS_TRANSFERS_RECORDED')
          test.equal(result.participants[0].accounts[3].id, 1, 'Fourth account processed has id 1')
          test.equal(result.participants[0].accounts[3].errorInformation.errorDescription, 'Generic client error - Account already processed once', 'Fourth account returns error "Account already processed once"')
          test.equal(result.participants[0].accounts[4].id, 3, 'Fifth account processed has id 3')
          test.equal(result.participants[0].accounts[4].state, 'SETTLED', 'Fifth account state remains SETTLED')
          test.equal(result.participants[0].accounts[5].id, 4, 'Sixth account processed has id 4')
          test.equal(result.participants[0].accounts[5].errorInformation.errorDescription, 'Generic client error - State change not allowed', 'Fourth account returns error "State change not allowed"')
          test.equal(result.participants[1].accounts[0].id, 5, 'First account processed for second participant has id 5')
          test.equal(result.participants[1].accounts[0].errorInformation.errorDescription, 'Generic client error - Participant and account mismatch', 'First account processed for second participant "Participant and account mismatch"')
          test.end()
        } catch (err) {
          logger.error(`putById failed with error - ${err}`)
          test.fail()
          test.end()
        }
      })

      await putByIdTest.test('process to PS_TRANSFERS_RESERVED from PS_TRANSFERS_RECORDED', async test => {
        try {
          sandbox.stub(Db, 'getKnex')
          const knexStub = sandbox.stub()
          const trxStub = sandbox.stub()
          trxStub.commit = sandbox.stub()
          knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)

          Db.getKnex.returns(knexStub)
          knexStub.returns({
            join: sandbox.stub().returns({
              join: sandbox.stub().returns({
                select: sandbox.stub().returns({
                  where: sandbox.stub().returns({
                    first: sandbox.stub().returns({
                      transacting: sandbox.stub().returns({
                        forUpdate: sandbox.stub().returns(
                          Promise.resolve(stubData.putById[1].settlementData)
                        )
                      })
                    }),
                    transacting: sandbox.stub().returns({
                      forUpdate: sandbox.stub().returns(
                        Promise.resolve(stubData.putById[1].windowsList)
                      )
                    })
                  })
                })
              }),
              leftJoin: sandbox.stub().returns({
                select: sandbox.stub().returns({
                  where: sandbox.stub().returns({
                    whereNotNull: sandbox.stub().returns({
                      whereNull: sandbox.stub().returns({
                        transacting: sandbox.stub().returns(
                          Promise.resolve(stubData.putById[1].settlementTransferList)
                        )
                      })
                    })
                  })
                })
              })
            }),
            leftJoin: sandbox.stub().returns({
              join: sandbox.stub().returns({
                select: sandbox.stub().returns({
                  where: sandbox.stub().returns({
                    transacting: sandbox.stub().returns({
                      forUpdate: sandbox.stub().returns(
                        Promise.resolve(stubData.putById[1].settlementAccountList)
                      )
                    })
                  })
                })
              })
            }),
            select: sandbox.stub().returns({
              distinct: sandbox.stub().returns({
                where: sandbox.stub().returns({
                  transacting: sandbox.stub().returns({
                    forUpdate: sandbox.stub().returns(
                      Promise.resolve(stubData.putById[1].windowsAccountsList)
                    )
                  })
                })
              })
            }),
            insert: sandbox.stub().returns({
              transacting: sandbox.stub().returns(
                Promise.resolve([21, 22, 23])
              )
            }),
            where: sandbox.stub().returns({
              update: sandbox.stub().returns({
                transacting: sandbox.stub().returns(
                  Promise.resolve()
                )
              })
            }),
            transacting: sandbox.stub().returns({
              join: sandbox.stub().returns({
                join: sandbox.stub().returns({
                  join: sandbox.stub().returns({
                    join: sandbox.stub().returns({
                      join: sandbox.stub().returns({
                        whereIn: sandbox.stub().returns({
                          where: sandbox.stub().returns({
                            distinct: sandbox.stub().returns({
                              orderBy: sandbox.stub().returns(stubData.putById[1].processedContent)
                            })
                          })
                        })
                      })
                    })
                  })
                })
              })
            })
          })
          SettlementFacade.settlementTransfersPrepare = sandbox.stub()
          SettlementFacade.settlementTransfersReserve = sandbox.stub()
          SettlementFacade.settlementTransfersCommit = sandbox.stub()

          const result = await SettlementFacade.putById(1, payload.putById[1], enums)
          test.ok(result, 'Result returned')
          test.end()
        } catch (err) {
          logger.error(`putById failed with error - ${err}`)
          test.fail()
          test.end()
        }
      })

      await putByIdTest.test('process to PS_TRANSFERS_COMMITTED from PS_TRANSFERS_RESERVED', async test => {
        try {
          sandbox.stub(Db, 'getKnex')
          const knexStub = sandbox.stub()
          const trxStub = sandbox.stub()
          trxStub.commit = sandbox.stub()
          knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)

          Db.getKnex.returns(knexStub)
          knexStub.returns({
            join: sandbox.stub().returns({
              join: sandbox.stub().returns({
                select: sandbox.stub().returns({
                  where: sandbox.stub().returns({
                    first: sandbox.stub().returns({
                      transacting: sandbox.stub().returns({
                        forUpdate: sandbox.stub().returns(
                          Promise.resolve(stubData.putById[2].settlementData)
                        )
                      })
                    }),
                    transacting: sandbox.stub().returns({
                      forUpdate: sandbox.stub().returns(
                        Promise.resolve(stubData.putById[2].windowsList)
                      )
                    })
                  })
                })
              }),
              leftJoin: sandbox.stub().returns({
                select: sandbox.stub().returns({
                  where: sandbox.stub().returns({
                    whereNotNull: sandbox.stub().returns({
                      whereNull: sandbox.stub().returns({
                        transacting: sandbox.stub().returns(
                          Promise.resolve(stubData.putById[2].settlementTransferList)
                        )
                      })
                    })
                  })
                })
              })
            }),
            leftJoin: sandbox.stub().returns({
              join: sandbox.stub().returns({
                select: sandbox.stub().returns({
                  where: sandbox.stub().returns({
                    transacting: sandbox.stub().returns({
                      forUpdate: sandbox.stub().returns(
                        Promise.resolve(stubData.putById[2].settlementAccountList)
                      )
                    })
                  })
                })
              })
            }),
            select: sandbox.stub().returns({
              distinct: sandbox.stub().returns({
                where: sandbox.stub().returns({
                  transacting: sandbox.stub().returns({
                    forUpdate: sandbox.stub().returns(
                      Promise.resolve(stubData.putById[2].windowsAccountsList)
                    )
                  })
                })
              })
            }),
            insert: sandbox.stub().returns({
              transacting: sandbox.stub().returns(
                Promise.resolve([21, 22, 23])
              )
            }),
            where: sandbox.stub().returns({
              update: sandbox.stub().returns({
                transacting: sandbox.stub().returns(
                  Promise.resolve()
                )
              })
            }),
            transacting: sandbox.stub().returns({
              join: sandbox.stub().returns({
                join: sandbox.stub().returns({
                  join: sandbox.stub().returns({
                    join: sandbox.stub().returns({
                      join: sandbox.stub().returns({
                        whereIn: sandbox.stub().returns({
                          where: sandbox.stub().returns({
                            distinct: sandbox.stub().returns({
                              orderBy: sandbox.stub().returns(stubData.putById[2].processedContent)
                            })
                          })
                        })
                      })
                    })
                  })
                })
              })
            })
          })
          SettlementFacade.settlementTransfersPrepare = sandbox.stub()
          SettlementFacade.settlementTransfersReserve = sandbox.stub()
          SettlementFacade.settlementTransfersCommit = sandbox.stub()

          const result = await SettlementFacade.putById(1, payload.putById[2], enums)
          test.ok(result, 'Result returned')
          test.end()
        } catch (err) {
          logger.error(`putById failed with error - ${err}`)
          test.fail()
          test.end()
        }
      })

      await putByIdTest.test('SETTLE settlement state when all accounts are SETTLED', async test => {
        try {
          sandbox.stub(Db, 'getKnex')
          const knexStub = sandbox.stub()
          const trxStub = sandbox.stub()
          trxStub.commit = sandbox.stub()
          knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)

          Db.getKnex.returns(knexStub)
          knexStub.returns({
            join: sandbox.stub().returns({
              join: sandbox.stub().returns({
                select: sandbox.stub().returns({
                  where: sandbox.stub().returns({
                    first: sandbox.stub().returns({
                      transacting: sandbox.stub().returns({
                        forUpdate: sandbox.stub().returns(
                          Promise.resolve(stubData.putById[3].settlementData)
                        )
                      })
                    }),
                    transacting: sandbox.stub().returns({
                      forUpdate: sandbox.stub().returns(
                        Promise.resolve(stubData.putById[3].windowsList)
                      )
                    })
                  })
                })
              }),
              leftJoin: sandbox.stub().returns({
                select: sandbox.stub().returns({
                  where: sandbox.stub().returns({
                    whereNotNull: sandbox.stub().returns({
                      whereNull: sandbox.stub().returns({
                        transacting: sandbox.stub().returns(
                          Promise.resolve(stubData.putById[3].settlementTransferList)
                        )
                      })
                    })
                  })
                })
              })
            }),
            leftJoin: sandbox.stub().returns({
              join: sandbox.stub().returns({
                select: sandbox.stub().returns({
                  where: sandbox.stub().returns({
                    transacting: sandbox.stub().returns({
                      forUpdate: sandbox.stub().returns(
                        Promise.resolve(stubData.putById[3].settlementAccountList)
                      )
                    })
                  })
                })
              })
            }),
            select: sandbox.stub().returns({
              distinct: sandbox.stub().returns({
                where: sandbox.stub().returns({
                  transacting: sandbox.stub().returns({
                    forUpdate: sandbox.stub().returns(
                      Promise.resolve(stubData.putById[3].windowsAccountsList)
                    )
                  })
                })
              })
            }),
            insert: sandbox.stub().returns({
              transacting: sandbox.stub().returns(
                Promise.resolve([21, 22, 23])
              )
            }),
            where: sandbox.stub().returns({
              update: sandbox.stub().returns({
                transacting: sandbox.stub().returns(
                  Promise.resolve()
                )
              })
            }),
            transacting: sandbox.stub().returns({
              join: sandbox.stub().returns({
                join: sandbox.stub().returns({
                  join: sandbox.stub().returns({
                    join: sandbox.stub().returns({
                      join: sandbox.stub().returns({
                        whereIn: sandbox.stub().returns({
                          where: sandbox.stub().returns({
                            distinct: sandbox.stub().returns({
                              orderBy: sandbox.stub().returns(stubData.putById[3].processedContent)
                            })
                          })
                        })
                      })
                    })
                  })
                }),
                whereIn: sandbox.stub().returns({
                  whereNot: sandbox.stub().returns({
                    distinct: sandbox.stub().returns(stubData.putById[3].unsettledWindows)
                  })
                })
              }),
              where: sandbox.stub().returns({
                whereIn: sandbox.stub().returns({
                  update: sandbox.stub(),
                  distinct: sandbox.stub().returns(stubData.putById[3].scaContentToCheck)
                }),
                update: sandbox.stub().returns({
                  transacting: sandbox.stub().returns(
                    Promise.resolve()
                  )
                })
              }),
              whereIn: sandbox.stub().returns({
                whereNot: sandbox.stub().returns({
                  distinct: sandbox.stub().returns(stubData.putById[3].unsettledContent)
                }),
                distinct: sandbox.stub().returns(stubData.putById[3].windowsToCheck)
              }),
              insert: sandbox.stub().returns(
                Promise.resolve([21, 22, 23])
              )
            })
          })
          SettlementFacade.settlementTransfersPrepare = sandbox.stub()
          SettlementFacade.settlementTransfersReserve = sandbox.stub()
          SettlementFacade.settlementTransfersCommit = sandbox.stub()

          const result = await SettlementFacade.putById(1, payload.putById[3], enums)
          test.ok(result, 'Result returned')
          test.end()
        } catch (err) {
          logger.error(`putById failed with error - ${err}`)
          test.fail()
          test.end()
        }
      })

      await putByIdTest.test('PENDING_SETTLEMENT to PS_TRANSFERS_RECORDED', async test => {
        try {
          sandbox.stub(Db, 'getKnex')
          const knexStub = sandbox.stub()
          const trxStub = sandbox.stub()
          trxStub.commit = sandbox.stub()
          knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)

          Db.getKnex.returns(knexStub)
          knexStub.returns({
            join: sandbox.stub().returns({
              join: sandbox.stub().returns({
                select: sandbox.stub().returns({
                  where: sandbox.stub().returns({
                    first: sandbox.stub().returns({
                      transacting: sandbox.stub().returns({
                        forUpdate: sandbox.stub().returns(
                          Promise.resolve(stubData.putById[4].settlementData)
                        )
                      })
                    }),
                    transacting: sandbox.stub().returns({
                      forUpdate: sandbox.stub().returns(
                        Promise.resolve(stubData.putById[4].windowsList)
                      )
                    })
                  })
                })
              }),
              leftJoin: sandbox.stub().returns({
                select: sandbox.stub().returns({
                  where: sandbox.stub().returns({
                    whereNotNull: sandbox.stub().returns({
                      whereNull: sandbox.stub().returns({
                        transacting: sandbox.stub().returns(
                          Promise.resolve(stubData.putById[4].settlementTransferList)
                        )
                      })
                    })
                  })
                })
              })
            }),
            leftJoin: sandbox.stub().returns({
              join: sandbox.stub().returns({
                select: sandbox.stub().returns({
                  where: sandbox.stub().returns({
                    transacting: sandbox.stub().returns({
                      forUpdate: sandbox.stub().returns(
                        Promise.resolve(stubData.putById[4].settlementAccountList)
                      )
                    })
                  })
                })
              })
            }),
            select: sandbox.stub().returns({
              distinct: sandbox.stub().returns({
                where: sandbox.stub().returns({
                  transacting: sandbox.stub().returns({
                    forUpdate: sandbox.stub().returns(
                      Promise.resolve(stubData.putById[4].windowsAccountsList)
                    )
                  })
                })
              })
            }),
            insert: sandbox.stub().returns({
              transacting: sandbox.stub().returns(
                Promise.resolve([21, 22, 23])
              )
            }),
            where: sandbox.stub().returns({
              update: sandbox.stub().returns({
                transacting: sandbox.stub().returns(
                  Promise.resolve()
                )
              })
            }),
            transacting: sandbox.stub().returns({
              join: sandbox.stub().returns({
                join: sandbox.stub().returns({
                  join: sandbox.stub().returns({
                    join: sandbox.stub().returns({
                      join: sandbox.stub().returns({
                        whereIn: sandbox.stub().returns({
                          where: sandbox.stub().returns({
                            distinct: sandbox.stub().returns({
                              orderBy: sandbox.stub().returns(stubData.putById[4].processedContent)
                            })
                          })
                        })
                      })
                    })
                  })
                })
              })
            })
          })
          SettlementFacade.settlementTransfersPrepare = sandbox.stub()
          SettlementFacade.settlementTransfersReserve = sandbox.stub()
          SettlementFacade.settlementTransfersCommit = sandbox.stub()

          const result = await SettlementFacade.putById(1, payload.putById[4], enums)
          test.ok(result, 'Result returned')
          test.end()
        } catch (err) {
          logger.error(`putById failed with error - ${err}`)
          test.fail()
          test.end()
        }
      })

      await putByIdTest.test('SETTLING settlement state when not all accounts are SETTLED', async test => {
        try {
          sandbox.stub(Db, 'getKnex')
          const knexStub = sandbox.stub()
          const trxStub = sandbox.stub()
          trxStub.commit = sandbox.stub()
          knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)

          Db.getKnex.returns(knexStub)
          knexStub.returns({
            join: sandbox.stub().returns({
              join: sandbox.stub().returns({
                select: sandbox.stub().returns({
                  where: sandbox.stub().returns({
                    first: sandbox.stub().returns({
                      transacting: sandbox.stub().returns({
                        forUpdate: sandbox.stub().returns(
                          Promise.resolve(stubData.putById[5].settlementData)
                        )
                      })
                    }),
                    transacting: sandbox.stub().returns({
                      forUpdate: sandbox.stub().returns(
                        Promise.resolve(stubData.putById[5].windowsList)
                      )
                    })
                  })
                })
              }),
              leftJoin: sandbox.stub().returns({
                select: sandbox.stub().returns({
                  where: sandbox.stub().returns({
                    whereNotNull: sandbox.stub().returns({
                      whereNull: sandbox.stub().returns({
                        transacting: sandbox.stub().returns(
                          Promise.resolve(stubData.putById[5].settlementTransferList)
                        )
                      })
                    })
                  })
                })
              })
            }),
            leftJoin: sandbox.stub().returns({
              join: sandbox.stub().returns({
                select: sandbox.stub().returns({
                  where: sandbox.stub().returns({
                    transacting: sandbox.stub().returns({
                      forUpdate: sandbox.stub().returns(
                        Promise.resolve(stubData.putById[5].settlementAccountList)
                      )
                    })
                  })
                })
              })
            }),
            select: sandbox.stub().returns({
              distinct: sandbox.stub().returns({
                where: sandbox.stub().returns({
                  transacting: sandbox.stub().returns({
                    forUpdate: sandbox.stub().returns(
                      Promise.resolve(stubData.putById[5].windowsAccountsList)
                    )
                  })
                })
              })
            }),
            insert: sandbox.stub().returns({
              transacting: sandbox.stub().returns(
                Promise.resolve([21, 22, 23])
              )
            }),
            where: sandbox.stub().returns({
              update: sandbox.stub().returns({
                transacting: sandbox.stub().returns(
                  Promise.resolve()
                )
              })
            }),
            transacting: sandbox.stub().returns({
              join: sandbox.stub().returns({
                join: sandbox.stub().returns({
                  join: sandbox.stub().returns({
                    join: sandbox.stub().returns({
                      join: sandbox.stub().returns({
                        whereIn: sandbox.stub().returns({
                          where: sandbox.stub().returns({
                            distinct: sandbox.stub().returns({
                              orderBy: sandbox.stub().returns(stubData.putById[3].processedContent)
                            })
                          })
                        })
                      })
                    })
                  })
                }),
                whereIn: sandbox.stub().returns({
                  whereNot: sandbox.stub().returns({
                    distinct: sandbox.stub().returns(stubData.putById[3].unsettledWindows)
                  })
                })
              }),
              where: sandbox.stub().returns({
                whereIn: sandbox.stub().returns({
                  update: sandbox.stub(),
                  distinct: sandbox.stub().returns(stubData.putById[3].scaContentToCheck)
                }),
                update: sandbox.stub().returns({
                  transacting: sandbox.stub().returns(
                    Promise.resolve()
                  )
                })
              }),
              whereIn: sandbox.stub().returns({
                whereNot: sandbox.stub().returns({
                  distinct: sandbox.stub().returns(stubData.putById[3].unsettledContent)
                }),
                distinct: sandbox.stub().returns(stubData.putById[3].windowsToCheck)
              }),
              insert: sandbox.stub().returns(
                Promise.resolve([21, 22, 23])
              )
            })
          })
          SettlementFacade.settlementTransfersPrepare = sandbox.stub()
          SettlementFacade.settlementTransfersReserve = sandbox.stub()
          SettlementFacade.settlementTransfersCommit = sandbox.stub()

          const result = await SettlementFacade.putById(1, payload.putById[5], enums)
          test.ok(result, 'Result returned')
          test.end()
        } catch (err) {
          logger.error(`putById failed with error - ${err}`)
          test.fail()
          test.end()
        }
      })

      await putByIdTest.test('throw error and rollback if database is unavailable', async test => {
        try {
          sandbox.stub(Db, 'getKnex')
          const knexStub = sandbox.stub()
          const trxStub = sandbox.stub()
          trxStub.commit = sandbox.stub()

          Db.getKnex.returns(knexStub)
          knexStub.returns({
            transaction: sandbox.stub().callsArgWith(0, trxStub),
            join: sandbox.stub().returns({
              select: sandbox.stub().returns({
                where: sandbox.stub().returns({
                  first: sandbox.stub().returns({
                    transacting: sandbox.stub().returns({
                      forUpdate: sandbox.stub().returns(
                        Promise.reject(new Error('Database unavailable!'))
                      )
                    })
                  })
                })
              })
            })
          })

          await SettlementFacade.putById(1, payload.putById[0], enums)
          test.fail('Error is not thrown!')
          test.end()
        } catch (err) {
          logger.error(`putById failed with error - ${err}`)
          test.ok('Error is thrown as expected')
          test.end()
        }
      })

      await putByIdTest.end()
    } catch (err) {
      logger.error(`settlementFacadeTest failed with error - ${err}`)
      putByIdTest.fail()
      putByIdTest.end()
    }
  })

  await settlementFacadeTest.test('abortById should', async abortByIdTest => {
    try {
      await abortByIdTest.test('throw error if settlement not found', async test => {
        try {
          const settlementId = 1
          sandbox.stub(Db, 'getKnex')
          const knexStub = sandbox.stub()
          const trxStub = sandbox.stub().returns(Promise.resolve({}))
          trxStub.commit = sandbox.stub()
          knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)

          Db.getKnex.returns(knexStub)
          sandbox.stub(SettlementFacade, 'getById')
          SettlementFacade.getById.returns()

          await SettlementFacade.abortById({ settlementId }, {}, enums)
          test.fail('Error not thrown!')
          test.end()
        } catch (err) {
          logger.error(`abortById failed with error - ${err}`)
          test.ok('Error thrown')
          test.end()
        }
      })

      await abortByIdTest.test('throw error if state change is not allowed - PS_TRANSFERS_COMMITTED', async test => {
        try {
          const settlementId = 1
          const settlementResultStub = { id: 1, state: 'PS_TRANSFERS_COMMITTED' }
          sandbox.stub(Db, 'getKnex')
          const knexStub = sandbox.stub()
          const trxStub = sandbox.stub().returns(Promise.resolve({}))
          trxStub.commit = sandbox.stub()
          knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)

          Db.getKnex.returns(knexStub)
          sandbox.stub(SettlementFacade, 'getById')
          SettlementFacade.getById.returns(settlementResultStub)

          await SettlementFacade.abortById({ settlementId }, {}, enums)
          test.fail('Error not thrown!')
          test.end()
        } catch (err) {
          logger.error(`abortById failed with error - ${err}`)
          test.ok('Error thrown')
          test.end()
        }
      })

      await abortByIdTest.test('throw error if state change is not allowed - SETTLING', async test => {
        try {
          const settlementId = 1
          const settlementResultStub = { id: 1, state: 'SETTLING' }

          sandbox.stub(Db, 'getKnex')
          const knexStub = sandbox.stub()
          const trxStub = sandbox.stub().returns(Promise.resolve({}))
          trxStub.commit = sandbox.stub()
          knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)

          Db.getKnex.returns(knexStub)
          sandbox.stub(SettlementFacade, 'getById')
          SettlementFacade.getById.returns(settlementResultStub)

          await SettlementFacade.abortById({ settlementId }, {}, enums)
          test.fail('Error not thrown!')
          test.end()
        } catch (err) {
          logger.error(`abortById failed with error - ${err}`)
          test.ok('Error thrown')
          test.end()
        }
      })

      await abortByIdTest.test('throw error if state change is not allowed - SETTLED', async test => {
        try {
          const settlementId = 1
          const settlementResultStub = { id: 1, state: 'SETTLED' }

          sandbox.stub(Db, 'getKnex')
          const knexStub = sandbox.stub()
          const trxStub = sandbox.stub().returns(Promise.resolve({}))
          trxStub.commit = sandbox.stub()
          knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)

          Db.getKnex.returns(knexStub)
          sandbox.stub(SettlementFacade, 'getById')
          SettlementFacade.getById.returns(settlementResultStub)

          await SettlementFacade.abortById({ settlementId }, {}, enums)
          test.fail('Error not thrown!')
          test.end()
        } catch (err) {
          logger.error(`abortById failed with error - ${err}`)
          test.ok('Error thrown')
          test.end()
        }
      })

      await abortByIdTest.test('record additional reason on settlement level when already ABORTED', async test => {
        try {
          const settlementId = 1
          const payload = {
            reason: 'Additional abort reason',
            state: 'ABORTED'
          }
          const resultMock = {
            id: settlementId,
            state: payload.state,
            reason: payload.reason
          }
          const settlementResultStub = { id: 1, state: 'ABORTED' }

          sandbox.stub(Db, 'getKnex')
          const knexStub = sandbox.stub()
          const trxStub = sandbox.stub().returns(Promise.resolve({}))
          trxStub.commit = sandbox.stub()
          knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
          sandbox.stub(SettlementFacade, 'settlementTransfersAbort')

          Db.getKnex.returns(knexStub)
          sandbox.stub(SettlementFacade, 'getById')
          SettlementFacade.getById.returns(settlementResultStub)

          knexStub.returns({
            leftJoin: sandbox.stub().returns({
              join: sandbox.stub().returns({
                select: sandbox.stub().returns({
                  where: sandbox.stub().returns({
                    transacting: sandbox.stub().returns({
                      forUpdate: sandbox.stub().returns(Promise.resolve([]))
                    })
                  })
                })
              })
            }),
            join: sandbox.stub().returns({
              join: sandbox.stub().returns({
                select: sandbox.stub().returns({
                  where: sandbox.stub().returns({
                    transacting: sandbox.stub().returns({
                      forUpdate: sandbox.stub().returns(Promise.resolve([]))
                    })
                  })
                })
              })
            }),
            insert: sandbox.stub().returns({
              transacting: sandbox.stub().returns({})
            }),
            where: sandbox.stub().returns({
              update: sandbox.stub().returns({
                transacting: sandbox.stub().returns({})
              })
            })
          })

          const result = await SettlementFacade.abortById(settlementId, payload, enums)
          test.deepEqual(result, resultMock)
          test.end()
        } catch (err) {
          logger.error(`abortById failed with error - ${err}`)
          test.fail()
          test.end()
        }
      })

      await abortByIdTest.test('throw error if one or more accounts are PS_TRANSFERS_COMMITTED', async test => {
        try {
          const settlementId = 1
          const payload = {
            reason: 'Abort reason text',
            state: 'ABORTED'
          }
          const settlementResultStub = { id: 1, state: 'PS_TRANSFERS_RESERVED' }

          sandbox.stub(Db, 'getKnex')
          const knexStub = sandbox.stub()
          const trxStub = sandbox.stub().returns(Promise.resolve({}))
          trxStub.commit = sandbox.stub()
          knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)

          Db.getKnex.returns(knexStub)
          sandbox.stub(SettlementFacade, 'getById')
          SettlementFacade.getById.returns(settlementResultStub)

          knexStub.returns({
            join: sandbox.stub().returns({
              where: sandbox.stub().returns({
                where: sandbox.stub().returns({
                  first: sandbox.stub().returns(1)
                })
              })
            })
          })

          await SettlementFacade.abortById(settlementId, payload, enums)
          test.fail('Error not thrown!')
          test.end()
        } catch (err) {
          logger.error(`abortById failed with error - ${err}`)
          test.ok('Error thrown')
          test.end()
        }
      })

      await abortByIdTest.test('abort settlement from PS_TRANSFERS_RESERVED', async test => {
        try {
          const settlementId = 1
          const payload = {
            reason: 'Abort reason text',
            state: 'ABORTED'
          }
          const resultMock = {
            id: settlementId,
            state: payload.state,
            reason: payload.reason
          }
          const settlementResultMock = { id: 1, state: 'PS_TRANSFERS_RESERVED' }
          const settlementAccountListMock = [{
            participantId: 2,
            participantCurrencyId: 3,
            reason: 'text',
            netAmount: 100,
            currencyId: 'USD',
            key: 1
          }]
          const windowsListMock = [{
            settlementWindowId: 1,
            settlementWindowStateId: 'PENDING_SETTLEMENT',
            reason: 'text',
            createdDate: new Date()
          }]

          sandbox.stub(Db, 'getKnex')
          const knexStub = sandbox.stub()
          const trxStub = sandbox.stub().returns(Promise.resolve({}))
          trxStub.commit = sandbox.stub()
          knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)

          Db.getKnex.returns(knexStub)
          sandbox.stub(SettlementFacade, 'getById')
          SettlementFacade.getById.returns(settlementResultMock)

          knexStub.returns({
            join: sandbox.stub().returns({
              where: sandbox.stub().returns({
                where: sandbox.stub().returns({
                  first: sandbox.stub()
                })
              }),
              join: sandbox.stub().returns({
                select: sandbox.stub().returns({
                  where: sandbox.stub().returns({
                    transacting: sandbox.stub().returns({
                      forUpdate: sandbox.stub().returns(windowsListMock)
                    })
                  })
                })
              })
            }),
            leftJoin: sandbox.stub().returns({
              join: sandbox.stub().returns({
                select: sandbox.stub().returns({
                  where: sandbox.stub().returns({
                    transacting: sandbox.stub().returns({
                      forUpdate: sandbox.stub().returns(settlementAccountListMock)
                    })
                  })
                })
              })
            }),
            insert: sandbox.stub().returns({
              transacting: sandbox.stub().returns([1])
            }),
            where: sandbox.stub().returns({
              update: sandbox.stub().returns({
                transacting: sandbox.stub()
              })
            })
          })
          sandbox.stub(SettlementFacade, 'settlementTransfersAbort')

          const result = await SettlementFacade.abortById(settlementId, payload, enums)
          test.deepEqual(result, resultMock)
          test.end()
        } catch (err) {
          logger.error(`abortById failed with error - ${err}`)
          test.fail()
          test.end()
        }
      })

      await abortByIdTest.test('throw error and rollback in case of error during abort settlement from PS_TRANSFERS_RECORDED', async test => {
        try {
          const settlementId = 1
          const payload = {
            reason: 'Abort reason text',
            state: 'ABORTED'
          }
          const settlementResultMock = { id: 1, state: 'PS_TRANSFERS_RECORDED' }
          const settlementAccountListMock = [{
            participantId: 2,
            participantCurrencyId: 3,
            reason: 'text',
            netAmount: 100,
            currencyId: 'USD',
            key: 1
          }]
          const windowsListMock = [{
            settlementWindowId: 1,
            settlementWindowStateId: 'PENDING_SETTLEMENT',
            reason: 'text',
            createdDate: new Date()
          }]

          sandbox.stub(Db, 'getKnex')
          const knexStub = sandbox.stub()
          const trxStub = sandbox.stub().returns(Promise.resolve({}))
          trxStub.commit = sandbox.stub()
          knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)

          Db.getKnex.returns(knexStub)
          sandbox.stub(SettlementFacade, 'getById')
          SettlementFacade.getById.returns(settlementResultMock)

          knexStub.returns({
            join: sandbox.stub().returns({
              where: sandbox.stub().returns({
                where: sandbox.stub().returns({
                  first: sandbox.stub()
                })
              }),
              join: sandbox.stub().returns({
                select: sandbox.stub().returns({
                  where: sandbox.stub().returns({
                    transacting: sandbox.stub().returns({
                      forUpdate: sandbox.stub().returns(windowsListMock)
                    })
                  })
                })
              })
            }),
            leftJoin: sandbox.stub().returns({
              join: sandbox.stub().returns({
                select: sandbox.stub().returns({
                  where: sandbox.stub().returns({
                    transacting: sandbox.stub().returns({
                      forUpdate: sandbox.stub().returns(settlementAccountListMock)
                    })
                  })
                })
              })
            }),
            insert: sandbox.stub().returns({
              transacting: sandbox.stub().returns([1])
            }),
            where: sandbox.stub().returns({
              update: sandbox.stub().returns({
                transacting: sandbox.stub().throws(new Error())
              })
            })
          })

          trxStub.rollback = sandbox.stub()
          knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
          sandbox.stub(SettlementFacade, 'settlementTransfersAbort')

          await SettlementFacade.abortById(settlementId, payload, enums)
          test.fail('Error not thrown!')
          test.end()
        } catch (err) {
          logger.error(`abortById failed with error - ${err}`)
          test.pass('Error thrown after rollback')
          test.end()
        }
      })

      await abortByIdTest.end()
    } catch (err) {
      logger.error(`settlementFacadeTest failed with error - ${err}`)
      abortByIdTest.fail()
      abortByIdTest.end()
    }
  })

  await settlementFacadeTest.test('getById should', async getByIdTest => {
    try {
      await getByIdTest.test('retrieve settlement data by id', async test => {
        try {
          const settlementId = 1
          const settlementResultStub = { id: 1 }

          Db.settlement = { query: sandbox.stub() }
          const builderStub = sandbox.stub()
          Db.settlement.query.callsArgWith(0, builderStub)
          builderStub.join = sandbox.stub()
          const selectStub = sandbox.stub()
          const whereStub = sandbox.stub()
          const firstStub = sandbox.stub()
          builderStub.join.returns({
            select: selectStub.returns({
              where: whereStub.returns({
                first: firstStub
              })
            })
          })
          Db.settlement.query.returns(Promise.resolve(settlementResultStub))

          await SettlementFacade.getById({ settlementId })
          test.ok(builderStub.join.withArgs('settlementStateChange AS ssc',
            'ssc.settlementStateChangeId',
            'settlement.currentStateChangeId').calledOnce)
          test.ok(whereStub.withArgs('settlement.settlementId', settlementId).calledOnce)
          test.ok(firstStub.calledOnce)
          test.end()
        } catch (err) {
          logger.error(`getById failed with error - ${err}`)
          test.fail()
          test.end()
        }
      })

      await getByIdTest.test('throw error if query is wrong', async test => {
        try {
          const settlementId = 1
          Db.settlement = { query: sandbox.stub() }
          const builderStub = sandbox.stub()
          Db.settlement.query.callsArgWith(0, builderStub)
          await SettlementFacade.getById({ settlementId })
          test.fail('Error not thrown!')
          test.end()
        } catch (err) {
          logger.error(`getById failed with error - ${err}`)
          test.pass('Error thrown')
          test.end()
        }
      })

      await getByIdTest.end()
    } catch (err) {
      logger.error(`settlementFacadeTest failed with error - ${err}`)
      getByIdTest.fail()
      getByIdTest.end()
    }
  })

  await settlementFacadeTest.test('getByParams should', async getByParamsTest => {
    try {
      await getByParamsTest.test('retrieve settlement data by params', async test => {
        try {
          const state = 'PENDING_SETTLEMENT'
          const fromDateTime = new Date() - 3600
          const toDateTime = new Date()
          const currency = 'USD'
          const settlementWindowId = 1
          const fromSettlementWindowDateTime = new Date() - 3600
          const toSettlementWindowDateTime = new Date()
          const participantId = 1
          const accountId = 1
          const query = { state, fromDateTime, toDateTime, currency, settlementWindowId, fromSettlementWindowDateTime, toSettlementWindowDateTime, participantId, accountId }

          Db.settlement = { query: sandbox.stub() }
          const builderStub = sandbox.stub()
          Db.settlement.query.callsArgWith(0, builderStub)
          builderStub.innerJoin = sandbox.stub()
          const context = sandbox.stub()
          context.on = sandbox.stub()
          context.on.returns({
            andOn: sandbox.stub()
          })

          builderStub.innerJoin.returns({
            innerJoin: sandbox.stub().returns({
              innerJoin: sandbox.stub().returns({
                innerJoin: sandbox.stub().returns({
                  innerJoin: sandbox.stub().returns({
                    innerJoin: sandbox.stub().returns({
                      innerJoin: sandbox.stub().returns({
                        innerJoin: sandbox.stub().returns({
                          distinct: sandbox.stub().returns({
                            select: sandbox.stub().returns({
                              where: sandbox.stub()
                            })
                          })
                        })
                      })
                    })
                  })
                })
              })
            })
          })
          Db.settlement.query.returns(Promise.resolve({ id: 1 }))
          const res1 = await SettlementFacade.getByParams(query)
          Db.settlement.query.returns(Promise.resolve({ id: 2 }))
          const res2 = await SettlementFacade.getByParams({})
          test.equal(res1.id, 1, 'First query returns settlement id 1')
          test.equal(res2.id, 2, 'Second query returns settlement id 2')
          test.equal(Db.settlement.query.callCount, 2, 'settlement query by params executed twice')
          test.end()
        } catch (err) {
          logger.error(`getByParams failed with error - ${err}`)
          test.fail()
          test.end()
        }
      })

      await getByParamsTest.test('throw error if query is wrong', async test => {
        try {
          const settlementWindowId = 1
          Db.settlement = { query: sandbox.stub() }
          const builderStub = sandbox.stub()
          Db.settlement.query.callsArgWith(0, builderStub)
          await SettlementFacade.getByParams({ settlementWindowId })
          test.fail('Error not thrown!')
          test.end()
        } catch (err) {
          logger.error(`getByParams failed with error - ${err}`)
          test.pass('Error thrown')
          test.end()
        }
      })

      await getByParamsTest.end()
    } catch (err) {
      logger.error(`settlementFacadeTest failed with error - ${err}`)
      getByParamsTest.fail()
      getByParamsTest.end()
    }
  })

  await settlementFacadeTest.test('triggerSettlementEvent should', async triggerSettlementEventTest => {
    try {
      await triggerSettlementEventTest.test('create new settlement', async test => {
        try {
          const insertedSettlementId = [1]
          sandbox.stub(Db, 'getKnex')
          const knexStub = sandbox.stub()
          const trxStub = sandbox.stub()
          trxStub.commit = sandbox.stub()
          knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
          Db.getKnex.returns(knexStub)
          knexStub.returns({
            insert: sandbox.stub().returns({
              transacting: sandbox.stub().returns(
                Promise.resolve(stubData.triggerSettlementEvent.settlementId)
              )
            }),
            select: sandbox.stub().returns({
              where: sandbox.stub().returns({
                transacting: sandbox.stub().returns(
                  Promise.resolve(stubData.triggerSettlementEvent.settlementParticipantCurrencyList)
                )
              }),
              whereIn: sandbox.stub().returns({
                transacting: sandbox.stub().returns(
                  Promise.resolve(stubData.triggerSettlementEvent.settlementParticipantCurrencyStateChangeIdList)
                )
              })
            }),
            transacting: sandbox.stub().returns({
              where: sandbox.stub().returns({
                update: sandbox.stub()
              }),
              select: sandbox.stub().returns({
                whereIn: sandbox.stub().returns({
                  andWhere: sandbox.stub().returns(
                    Promise.resolve(stubData.triggerSettlementEvent.settlementWindowStateChangeIdList)
                  )
                })
              }),
              insert: sandbox.stub().returns(insertedSettlementId),
              join: sandbox.stub().returns({
                join: sandbox.stub().returns({
                  join: sandbox.stub().returns({
                    whereRaw: sandbox.stub().returns({
                      where: sandbox.stub().returns({
                        where: sandbox.stub().returns({
                          whereIn: sandbox.stub().returns({
                            whereIn: sandbox.stub().returns(stubData.triggerSettlementEvent.swcIdList)
                          })
                        })
                      })
                    })
                  })
                }),
                whereIn: sandbox.stub().returns({
                  whereIn: sandbox.stub().returns({
                    select: sandbox.stub().returns(stubData.triggerSettlementEvent.windowsStateToBeUpdatedIdList)
                  })
                })
              }),
              whereIn: sandbox.stub().returns({
                update: sandbox.stub()
              })
            })
          })
          knexStub.batchInsert = sandbox.stub().returns({
            transacting: sandbox.stub()
          })
          knexStub.raw = sandbox.stub()
          const context1 = sandbox.stub()
          const context2 = sandbox.stub()
          const context3 = sandbox.stub()
          context2.on = sandbox.stub().returns({
            on: sandbox.stub()
          })
          const join1Stub = sandbox.stub().callsArgOn(1, context2)
          context3.on = sandbox.stub()
          const join2Stub = sandbox.stub().callsArgOn(1, context3)
          context1.from = sandbox.stub().returns({
            join: sandbox.stub().returns({
              join: join1Stub.returns({
                join: join2Stub.returns({
                  where: sandbox.stub().returns({
                    groupBy: sandbox.stub().returns({
                      select: sandbox.stub().returns({
                        sum: sandbox.stub()
                      })
                    })
                  })
                })
              })
            }),
            whereRaw: sandbox.stub().returns({
              groupBy: sandbox.stub().returns({
                select: sandbox.stub().returns({
                  sum: sandbox.stub()
                })
              })
            })
          })
          const insertStub = sandbox.stub().callsArgOn(0, context1)
          knexStub.from = sandbox.stub().returns({
            insert: insertStub.returns({
              transacting: sandbox.stub()
            })
          })
          const settlementModel = 'DEFERRED_NET'

          const settlementId = await SettlementFacade.triggerSettlementEvent(payload.triggerSettlementEvent, settlementModel, enums)
          test.equal(settlementId, insertedSettlementId[0], 'settlementId returned')
          test.equal(knexStub.callCount, 14, 'Knex called 14 times')
          test.end()
        } catch (err) {
          logger.error(`triggerSettlementEvent failed with error - ${err}`)
          test.fail()
          test.end()
        }
      })

      await triggerSettlementEventTest.test('throw error if settlement insert fails', async test => {
        try {
          sandbox.stub(Db, 'getKnex')
          const knexStub = sandbox.stub()
          const trxStub = sandbox.stub()
          trxStub.commit = sandbox.stub()
          knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
          Db.getKnex.returns(knexStub)
          knexStub.returns({
            insert: sandbox.stub().returns({
              transacting: sandbox.stub().throws(
                new Error('settlement insert failure')
              )
            })
          })

          await SettlementFacade.triggerSettlementEvent(payload.triggerSettlementEvent)
          test.fail('Error not thrown!')
          test.end()
        } catch (err) {
          logger.error(`triggerSettlementEvent failed with error - ${err}`)
          test.pass('Error thrown')
          test.end()
        }
      })

      await triggerSettlementEventTest.end()
    } catch (err) {
      logger.error(`settlementFacadeTest failed with error - ${err}`)
      triggerSettlementEventTest.fail()
      triggerSettlementEventTest.end()
    }
  })

  await settlementFacadeTest.test('settlementParticipantCurrency.getByListOfIds should', async getByListOfIdsTest => {
    try {
      await getByListOfIdsTest.test('retrieve settlementParticipantCurrency data by listOfIds', async test => {
        try {
          const listOfIds = [1]
          Db.settlementParticipantCurrency = { query: sandbox.stub() }
          const builderStub = sandbox.stub()
          Db.settlementParticipantCurrency.query.callsArgWith(0, builderStub)
          builderStub.leftJoin = sandbox.stub()
          const leftJoin2Stub = sandbox.stub()
          const selectStub = sandbox.stub()
          const whereInStub = sandbox.stub()
          builderStub.leftJoin.returns({
            leftJoin: leftJoin2Stub.returns({
              select: selectStub.returns({
                whereIn: whereInStub
              })
            })
          })
          await SettlementFacade.settlementParticipantCurrency.getByListOfIds(listOfIds)
          test.ok(builderStub.leftJoin.withArgs('participantCurrency AS pc', 'pc.participantCurrencyId', 'settlementParticipantCurrency.participantCurrencyId').calledOnce)
          test.ok(leftJoin2Stub.withArgs('participant as p', 'p.participantCurrencyId', 'pc.participantCurrencyId').calledOnce)
          test.ok(selectStub.withArgs(
            'settlementParticipantCurrency.netAmount as amount',
            'pc.currencyId as currency',
            'p.participantId as participant').calledOnce)
          test.ok(whereInStub.withArgs('settlementWindow.settlementWindowId', listOfIds).calledOnce)
          test.end()
        } catch (err) {
          logger.error(`getByListOfIds failed with error - ${err}`)
          test.fail()
          test.end()
        }
      })

      await getByListOfIdsTest.test('throw error if query is wrong', async test => {
        try {
          const listOfIds = [1]
          Db.settlementParticipantCurrency = { query: sandbox.stub() }
          const builderStub = sandbox.stub()
          Db.settlementParticipantCurrency.query.callsArgWith(0, builderStub)
          await SettlementFacade.settlementParticipantCurrency.getByListOfIds(listOfIds)
          test.fail('Error not thrown!')
          test.end()
        } catch (err) {
          logger.error(`getByListOfIds failed with error - ${err}`)
          test.pass('Error thrown')
          test.end()
        }
      })

      await getByListOfIdsTest.end()
    } catch (err) {
      logger.error(`settlementFacadeTest failed with error - ${err}`)
      getByListOfIdsTest.fail()
      getByListOfIdsTest.end()
    }
  })

  await settlementFacadeTest.test('settlementParticipantCurrency.getAccountsInSettlementByIds should', async getAccountsInSettlementByIdsTest => {
    try {
      await getAccountsInSettlementByIdsTest.test('retrieve accounts in settlement data by ids', async test => {
        try {
          const params = { settlementId: 1, participantId: 1 }
          Db.settlementParticipantCurrency = { query: sandbox.stub() }
          const builderStub = sandbox.stub()
          Db.settlementParticipantCurrency.query.callsArgWith(0, builderStub)
          builderStub.join = sandbox.stub()
          const selectStub = sandbox.stub()
          const whereStub = sandbox.stub()
          const andWhereStub = sandbox.stub()
          builderStub.join.returns({
            select: selectStub.returns({
              where: whereStub.returns({
                andWhere: andWhereStub
              })
            })
          })
          await SettlementFacade.settlementParticipantCurrency.getAccountsInSettlementByIds(params)
          test.ok(builderStub.join.withArgs('participantCurrency AS pc', 'pc.participantCurrencyId', 'settlementParticipantCurrency.participantCurrencyId').calledOnce)
          test.ok(selectStub.withArgs('settlementParticipantCurrencyId').calledOnce)
          test.ok(whereStub.withArgs({ settlementId: params.settlementId }).calledOnce)
          test.ok(andWhereStub.withArgs('pc.participantId', params.participantId).calledOnce)
          test.end()
        } catch (err) {
          logger.error(`getAccountsInSettlementByIds failed with error - ${err}`)
          test.fail()
          test.end()
        }
      })

      await getAccountsInSettlementByIdsTest.test('throw error if query is wrong', async test => {
        try {
          const params = { settlementId: 1, participantId: 1 }
          Db.settlementParticipantCurrency = { query: sandbox.stub() }
          const builderStub = sandbox.stub()
          Db.settlementParticipantCurrency.query.callsArgWith(0, builderStub)
          await SettlementFacade.settlementParticipantCurrency.getAccountsInSettlementByIds(params)
          test.fail('Error not thrown!')
          test.end()
        } catch (err) {
          logger.error(`getAccountsInSettlementByIds failed with error - ${err}`)
          test.pass('Error thrown')
          test.end()
        }
      })

      await getAccountsInSettlementByIdsTest.end()
    } catch (err) {
      logger.error(`settlementFacadeTest failed with error - ${err}`)
      getAccountsInSettlementByIdsTest.fail()
      getAccountsInSettlementByIdsTest.end()
    }
  })

  await settlementFacadeTest.test('settlementParticipantCurrency.getParticipantCurrencyBySettlementId should', async getParticipantCurrencyBySettlementIdTest => {
    try {
      await getParticipantCurrencyBySettlementIdTest.test('retrieve participant currency data by settlement id', async test => {
        try {
          const params = { settlementId: 1 }
          Db.settlementParticipantCurrency = { query: sandbox.stub() }
          const builderStub = sandbox.stub()
          Db.settlementParticipantCurrency.query.callsArgWith(0, builderStub)
          builderStub.leftJoin = sandbox.stub()
          const joinStub = sandbox.stub()
          const selectStub = sandbox.stub()
          const whereStub = sandbox.stub()
          builderStub.leftJoin.returns({
            join: joinStub.returns({
              select: selectStub.returns({
                where: whereStub
              })
            })
          })
          await SettlementFacade.settlementParticipantCurrency.getParticipantCurrencyBySettlementId(params)
          test.ok(builderStub.leftJoin.withArgs('settlementParticipantCurrencyStateChange AS spcsc', 'spcsc.settlementParticipantCurrencyStateChangeId', 'settlementParticipantCurrency.currentStateChangeId').calledOnce)
          test.ok(joinStub.withArgs('participantCurrency AS pc', 'pc.participantCurrencyId', 'settlementParticipantCurrency.participantCurrencyId').calledOnce)
          test.ok(selectStub.withArgs('pc.participantId AS id',
            'settlementParticipantCurrency.participantCurrencyId AS participantCurrencyId',
            'spcsc.settlementStateId AS state',
            'spcsc.reason AS reason',
            'settlementParticipantCurrency.netAmount AS netAmount',
            'pc.currencyId AS currency',
            'settlementParticipantCurrency.settlementParticipantCurrencyId AS key').calledOnce)
          test.ok(whereStub.withArgs(params).calledOnce)
          test.end()
        } catch (err) {
          logger.error(`getParticipantCurrencyBySettlementId failed with error - ${err}`)
          test.fail()
          test.end()
        }
      })

      await getParticipantCurrencyBySettlementIdTest.test('throw error if query is wrong', async test => {
        try {
          const params = { settlementId: 1 }
          Db.settlementParticipantCurrency = { query: sandbox.stub() }
          const builderStub = sandbox.stub()
          Db.settlementParticipantCurrency.query.callsArgWith(0, builderStub)
          await SettlementFacade.settlementParticipantCurrency.getParticipantCurrencyBySettlementId(params)
          test.fail('Error not thrown!')
          test.end()
        } catch (err) {
          logger.error(`getParticipantCurrencyBySettlementId failed with error - ${err}`)
          test.pass('Error thrown')
          test.end()
        }
      })

      await getParticipantCurrencyBySettlementIdTest.end()
    } catch (err) {
      logger.error(`settlementFacadeTest failed with error - ${err}`)
      getParticipantCurrencyBySettlementIdTest.fail()
      getParticipantCurrencyBySettlementIdTest.end()
    }
  })

  await settlementFacadeTest.test('settlementParticipantCurrency.getSettlementAccountById should', async getSettlementAccountByIdTest => {
    try {
      await getSettlementAccountByIdTest.test('retrieve account by id', async test => {
        try {
          const settlementParticipantCurrencyId = 1
          Db.settlementParticipantCurrency = { query: sandbox.stub() }
          const builderStub = sandbox.stub()
          Db.settlementParticipantCurrency.query.callsArgWith(0, builderStub)
          builderStub.join = sandbox.stub()
          const joinStub = sandbox.stub()
          const selectStub = sandbox.stub()
          const whereStub = sandbox.stub()
          builderStub.join.returns({
            join: joinStub.returns({
              select: selectStub.returns({
                where: whereStub
              })
            })
          })
          await SettlementFacade.settlementParticipantCurrency.getSettlementAccountById(settlementParticipantCurrencyId)
          test.ok(builderStub.join.withArgs('settlementParticipantCurrencyStateChange AS spcsc', 'spcsc.settlementParticipantCurrencyStateChangeId', 'settlementParticipantCurrency.currentStateChangeId').calledOnce)
          test.ok(joinStub.withArgs('participantCurrency AS pc', 'pc.participantCurrencyId', 'settlementParticipantCurrency.participantCurrencyId').calledOnce)
          test.ok(selectStub.withArgs(
            'pc.participantId AS id',
            'settlementParticipantCurrency.participantCurrencyId',
            'spcsc.settlementStateId AS state',
            'spcsc.reason AS reason',
            'settlementParticipantCurrency.netAmount as netAmount',
            'pc.currencyId AS currency').calledOnce)
          test.ok(whereStub.withArgs('settlementParticipantCurrency.settlementParticipantCurrencyId', settlementParticipantCurrencyId).calledOnce)
          test.end()
        } catch (err) {
          logger.error(`getSettlementAccountById failed with error - ${err}`)
          test.fail()
          test.end()
        }
      })

      await getSettlementAccountByIdTest.test('throw error if query is wrong', async test => {
        try {
          const params = { settlementId: 1 }
          Db.settlementParticipantCurrency = { query: sandbox.stub() }
          const builderStub = sandbox.stub()
          Db.settlementParticipantCurrency.query.callsArgWith(0, builderStub)
          await SettlementFacade.settlementParticipantCurrency.getSettlementAccountById(params)
          test.fail('Error not thrown!')
          test.end()
        } catch (err) {
          logger.error(`getSettlementAccountById failed with error - ${err}`)
          test.pass('Error thrown')
          test.end()
        }
      })

      await getSettlementAccountByIdTest.end()
    } catch (err) {
      logger.error(`settlementFacadeTest failed with error - ${err}`)
      getSettlementAccountByIdTest.fail()
      getSettlementAccountByIdTest.end()
    }
  })

  await settlementFacadeTest.test('settlementParticipantCurrency.getSettlementAccountsByListOfIds should', async getSettlementAccountsByListOfIdsTest => {
    try {
      await getSettlementAccountsByListOfIdsTest.test('retrieve accounts by list of ids', async test => {
        try {
          const settlementParticipantCurrencyIdList = [1]
          Db.settlementParticipantCurrency = { query: sandbox.stub() }
          const builderStub = sandbox.stub()
          Db.settlementParticipantCurrency.query.callsArgWith(0, builderStub)
          builderStub.join = sandbox.stub()
          const joinStub = sandbox.stub()
          const selectStub = sandbox.stub()
          const whereInStub = sandbox.stub()
          builderStub.join.returns({
            join: joinStub.returns({
              select: selectStub.returns({
                whereIn: whereInStub
              })
            })
          })
          await SettlementFacade.settlementParticipantCurrency.getSettlementAccountsByListOfIds(settlementParticipantCurrencyIdList)
          test.ok(builderStub.join.withArgs('settlementParticipantCurrencyStateChange AS spcsc', 'spcsc.settlementParticipantCurrencyStateChangeId', 'settlementParticipantCurrency.currentStateChangeId').calledOnce)
          test.ok(joinStub.withArgs('participantCurrency AS pc', 'pc.participantCurrencyId', 'settlementParticipantCurrency.participantCurrencyId').calledOnce)
          test.ok(selectStub.withArgs(
            'pc.participantId AS id',
            'settlementParticipantCurrency.participantCurrencyId',
            'spcsc.settlementStateId AS state',
            'spcsc.reason AS reason',
            'settlementParticipantCurrency.netAmount as netAmount',
            'pc.currencyId AS currency').calledOnce)
          test.ok(whereInStub.withArgs('settlementParticipantCurrency.settlementParticipantCurrencyId', settlementParticipantCurrencyIdList).calledOnce)
          test.end()
        } catch (err) {
          logger.error(`getSettlementAccountsByListOfIds failed with error - ${err}`)
          test.fail()
          test.end()
        }
      })

      await getSettlementAccountsByListOfIdsTest.test('throw error if query is wrong', async test => {
        try {
          const settlementParticipantCurrencyIdList = { settlementId: 1 }
          Db.settlementParticipantCurrency = { query: sandbox.stub() }
          const builderStub = sandbox.stub()
          Db.settlementParticipantCurrency.query.callsArgWith(0, builderStub)
          await SettlementFacade.settlementParticipantCurrency.getSettlementAccountsByListOfIds(settlementParticipantCurrencyIdList)
          test.fail('Error not thrown!')
          test.end()
        } catch (err) {
          logger.error(`getSettlementAccountsByListOfIds failed with error - ${err}`)
          test.pass('Error thrown')
          test.end()
        }
      })

      await getSettlementAccountsByListOfIdsTest.end()
    } catch (err) {
      logger.error(`settlementFacadeTest failed with error - ${err}`)
      getSettlementAccountsByListOfIdsTest.fail()
      getSettlementAccountsByListOfIdsTest.end()
    }
  })

  await settlementFacadeTest.test('settlementSettlementWindow.getWindowsBySettlementIdAndAccountId should', async getWindowsBySettlementIdAndAccountIdTest => {
    try {
      await getWindowsBySettlementIdAndAccountIdTest.test('retrieve settlement window by settlement id and account id', async test => {
        try {
          const params = { settlementId: 1, accountId: 1 }
          Db.settlementSettlementWindow = { query: sandbox.stub() }
          const builderStub = sandbox.stub()
          Db.settlementSettlementWindow.query.callsArgWith(0, builderStub)
          builderStub.join = sandbox.stub()
          const join2Stub = sandbox.stub()
          const context = sandbox.stub()
          context.on = sandbox.stub()
          const on2Stub = sandbox.stub()
          context.on.returns({
            on: on2Stub
          })
          const join3Stub = sandbox.stub()
          join3Stub.callsArgOn(1, context)
          const distinctStub = sandbox.stub()
          const selectStub = sandbox.stub()
          const whereStub = sandbox.stub()
          builderStub.join.returns({
            join: join2Stub.returns({
              join: join3Stub.returns({
                distinct: distinctStub.returns({
                  select: selectStub.returns({
                    where: whereStub
                  })
                })
              })
            })
          })
          await SettlementFacade.settlementSettlementWindow.getWindowsBySettlementIdAndAccountId(params)
          test.ok(builderStub.join.withArgs('settlementWindow', 'settlementWindow.settlementWindowId', 'settlementSettlementWindow.settlementWindowId').calledOnce)
          test.ok(join2Stub.withArgs('settlementWindowStateChange AS swsc', 'swsc.settlementWindowStateChangeId', 'settlementWindow.currentStateChangeId').calledOnce)
          test.equal(join3Stub.getCall(0).args[0], 'settlementTransferParticipant AS stp')
          test.ok(context.on.withArgs('stp.settlementWindowId', 'settlementWindow.settlementWindowId').calledOnce)
          test.ok(on2Stub.withArgs('stp.participantCurrencyId', params.accountId).calledOnce)
          test.ok(distinctStub.withArgs(
            'settlementWindow.settlementWindowId as id',
            'swsc.settlementWindowStateId as state',
            'swsc.reason as reason',
            'settlementWindow.createdDate as createdDate',
            'swsc.createdDate as changedDate').calledOnce)
          test.ok(selectStub.calledOnce)
          test.ok(whereStub.withArgs('settlementSettlementWindow.settlementId', params.settlementId).calledOnce)
          test.end()
        } catch (err) {
          logger.error(`getWindowsBySettlementIdAndAccountId failed with error - ${err}`)
          test.fail()
          test.end()
        }
      })

      await getWindowsBySettlementIdAndAccountIdTest.test('throw error if query is wrong', async test => {
        try {
          const params = { settlementId: 1 }
          Db.settlementSettlementWindow = { query: sandbox.stub() }
          const builderStub = sandbox.stub()
          Db.settlementSettlementWindow.query.callsArgWith(0, builderStub)
          await SettlementFacade.settlementSettlementWindow.getWindowsBySettlementIdAndAccountId(params)
          test.fail('Error not thrown!')
          test.end()
        } catch (err) {
          logger.error(`getWindowsBySettlementIdAndAccountId failed with error - ${err}`)
          test.pass('Error thrown')
          test.end()
        }
      })

      await getWindowsBySettlementIdAndAccountIdTest.end()
    } catch (err) {
      logger.error(`settlementFacadeTest failed with error - ${err}`)
      getWindowsBySettlementIdAndAccountIdTest.fail()
      getWindowsBySettlementIdAndAccountIdTest.end()
    }
  })

  await settlementFacadeTest.test('settlementSettlementWindow.getWindowsBySettlementIdAndParticipantId should', async getWindowsBySettlementIdAndParticipantIdTest => {
    try {
      await getWindowsBySettlementIdAndParticipantIdTest.test('retrieve settlement window by settlement id and account id', async test => {
        try {
          const params = { settlementId: 1, accountId: 1 }
          const enums = { ledgerAccountTypes: { POSITION: 1 } }
          Db.settlementSettlementWindow = { query: sandbox.stub() }
          const builderStub = sandbox.stub()
          Db.settlementSettlementWindow.query.callsArgWith(0, builderStub)
          builderStub.join = sandbox.stub()
          const join2Stub = sandbox.stub()
          const context = sandbox.stub()
          context.on = sandbox.stub()
          const onInStub = sandbox.stub()
          context.on.returns({
            onIn: onInStub
          })
          Db.participantCurrency = { find: sandbox.stub().returns([{ participantCurrencyId: 1 }]) }
          const join3Stub = sandbox.stub()
          join3Stub.callsArgOn(1, context)
          const distinctStub = sandbox.stub()
          const selectStub = sandbox.stub()
          const whereStub = sandbox.stub()
          builderStub.join.returns({
            join: join2Stub.returns({
              join: join3Stub.returns({
                distinct: distinctStub.returns({
                  select: selectStub.returns({
                    where: whereStub
                  })
                })
              })
            })
          })
          await SettlementFacade.settlementSettlementWindow.getWindowsBySettlementIdAndParticipantId(params, enums)
          test.ok(builderStub.join.withArgs('settlementWindow', 'settlementWindow.settlementWindowId', 'settlementSettlementWindow.settlementWindowId').calledOnce)
          test.ok(join2Stub.withArgs('settlementWindowStateChange AS swsc', 'swsc.settlementWindowStateChangeId', 'settlementWindow.currentStateChangeId').calledOnce)
          test.equal(join3Stub.getCall(0).args[0], 'settlementTransferParticipant AS stp')
          test.ok(context.on.withArgs('stp.settlementWindowId', 'settlementWindow.settlementWindowId').calledOnce)
          test.equal(onInStub.getCall(0).args[0], 'stp.participantCurrencyId')
          test.ok(distinctStub.withArgs(
            'settlementWindow.settlementWindowId as id',
            'swsc.settlementWindowStateId as state',
            'swsc.reason as reason',
            'settlementWindow.createdDate as createdDate',
            'swsc.createdDate as changedDate').calledOnce)
          test.ok(selectStub.calledOnce)
          test.ok(whereStub.withArgs('settlementSettlementWindow.settlementId', params.settlementId).calledOnce)
          test.end()
        } catch (err) {
          logger.error(`getWindowsBySettlementIdAndParticipantId failed with error - ${err}`)
          test.fail()
          test.end()
        }
      })

      await getWindowsBySettlementIdAndParticipantIdTest.test('throw error if query is wrong', async test => {
        try {
          const params = { settlementId: 1 }
          const enums = { ledgerAccountTypes: { POSITION: 1 } }
          Db.settlementSettlementWindow = { query: sandbox.stub() }
          const builderStub = sandbox.stub()
          Db.settlementSettlementWindow.query.callsArgWith(0, builderStub)
          await SettlementFacade.settlementSettlementWindow.getWindowsBySettlementIdAndParticipantId(params, enums)
          test.fail('Error not thrown!')
          test.end()
        } catch (err) {
          logger.error(`getWindowsBySettlementIdAndParticipantId failed with error - ${err}`)
          test.pass('Error thrown')
          test.end()
        }
      })

      await getWindowsBySettlementIdAndParticipantIdTest.end()
    } catch (err) {
      logger.error(`settlementFacadeTest failed with error - ${err}`)
      getWindowsBySettlementIdAndParticipantIdTest.fail()
      getWindowsBySettlementIdAndParticipantIdTest.end()
    }
  })

  await settlementFacadeTest.end()
})
