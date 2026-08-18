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
 * Valentin Genev <valentin.genev@modusbox.com>
 * Lazola Lucas <lazola.lucas@modusbox.com>
 --------------
 ******/

'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const { logger } = require('../../../../../src/settlement/shared/logger')
const SettlementWindowService = require('../../../../../src/settlement/domain/settlementWindow')
const SettlementWindowModel = require('../../../../../src/settlement/models/settlementWindow')
const SettlementWindowContentModel = require('../../../../../src/settlement/models/settlementWindowContent')
const Producer = require('@mojaloop/central-services-stream').Util.Producer

Test('SettlementWindowService', async (settlementWindowServiceTest) => {
  let sandbox

  settlementWindowServiceTest.beforeEach(test => {
    sandbox = Sinon.createSandbox()
    sandbox.stub(Producer, 'produceMessage')
    test.end()
  })

  settlementWindowServiceTest.afterEach(test => {
    sandbox.restore()
    test.end()
  })

  await settlementWindowServiceTest.test('getById should', async getByIdTest => {
    try {
      const params = { settlementWindowId: 1 }
      const enums = {}
      const options = { logger }
      const settlementWindowMock = { settlementWindowId: 1, content: { id: 11 } }
      const settlementWindowContentMock = { id: 11 }

      await getByIdTest.test('return settlement window', async test => {
        try {
          SettlementWindowContentModel.getBySettlementWindowId = sandbox.stub().returns(settlementWindowContentMock)
          SettlementWindowModel.getById = sandbox.stub().returns(settlementWindowMock)

          const result = await SettlementWindowService.getById(params, enums, options)
          test.ok(result, 'Result returned')
          test.ok(SettlementWindowModel.getById.withArgs(params).calledOnce, 'SettlementWindowModel.getById with args ... called once')

          SettlementWindowModel.getById = sandbox.stub().returns()
          try {
            await SettlementWindowService.getById(params, enums)
            test.fail('Error expected, but not thrown!')
          } catch (err) {
            test.ok(err instanceof Error, `Error ${err.message} thrown`)
            test.ok(SettlementWindowModel.getById.withArgs(params).calledOnce, 'SettlementWindowModel.getById with args ... called once')
          }
          test.end()
        } catch (err) {
          logger.error(`getByIdTest failed with error - ${err}`)
          test.fail()
          test.end()
        }
      })

      await getByIdTest.end()
    } catch (err) {
      logger.error(`settlementWindowServiceTest failed with error - ${err}`)
      getByIdTest.fail()
      getByIdTest.end()
    }
  })

  await settlementWindowServiceTest.test('getById should throw an error if no settlement window content is undefined', async getByIdTest => {
    try {
      const params = { settlementWindowId: 1 }
      const enums = {}
      const settlementWindowMock = { settlementWindowId: 1, content: { id: 11 } }

      await getByIdTest.test('Throw an error when settlement window content is undefined', async test => {
        try {
          SettlementWindowContentModel.getBySettlementWindowId = sandbox.stub().returns(undefined)
          SettlementWindowModel.getById = sandbox.stub().returns(settlementWindowMock)
          try {
            await SettlementWindowService.getById(params, enums)
            test.fail('Error expected, but not thrown!')
          } catch (err) {
            test.equal(err.message, 'No records for settlementWidowContentId : 1 found')
          }
          test.end()
        } catch (err) {
          logger.error(`getByIdTest failed with error - ${err}`)
          test.fail()
          test.end()
        }
      })

      await getByIdTest.end()
    } catch (err) {
      logger.error(`settlementWindowServiceTest failed with error - ${err}`)
      getByIdTest.fail()
      getByIdTest.end()
    }
  })

  await settlementWindowServiceTest.test('getById should throw an error if no settlement window content is found', async getByIdTest => {
    try {
      const params = { settlementWindowId: 1 }
      const enums = {}
      const settlementWindowMock = { settlementWindowId: 1, content: { } }
      const settlementWindowContentMock = []

      await getByIdTest.test('Throw an error when settlement window content is undefined', async test => {
        try {
          SettlementWindowContentModel.getBySettlementId = sandbox.stub().returns(settlementWindowContentMock)
          SettlementWindowModel.getById = sandbox.stub().returns(settlementWindowMock)
          try {
            await SettlementWindowService.getById(params, enums)
            test.pass('Error expected, but not thrown!')
          } catch (err) {
            test.equal(err.message, 'No records for settlementWidowContentId : 1 found')
          }
          test.end()
        } catch (err) {
          logger.error(`getByIdTest failed with error - ${err}`)
          test.fail()
          test.end()
        }
      })

      await getByIdTest.end()
    } catch (err) {
      logger.error(`settlementWindowServiceTest failed with error - ${err}`)
      getByIdTest.fail()
      getByIdTest.end()
    }
  })

  await settlementWindowServiceTest.test('getByParams should', async getByParamsTest => {
    try {
      let params = { query: { participantId: 1, state: 'PENDING_SETTLEMENT' } }
      const enums = {}
      const options = { logger }
      const settlementWindowsMock = [{ settlementWindowId: 1 }, { settlementWindowId: 2 }]
      const settlementWindowMock = { settlementWindowId: 1, content: { id: 11 } }
      const settlementWindowContentMock = { id: 11 }

      await getByParamsTest.test('return settlement windows', async test => {
        try {
          SettlementWindowContentModel.getBySettlementWindowId = sandbox.stub().returns(settlementWindowContentMock)
          SettlementWindowModel.getById = sandbox.stub().returns(settlementWindowMock)
          SettlementWindowModel.getByParams = sandbox.stub().returns(settlementWindowsMock)
          const result = await SettlementWindowService.getByParams(params, enums, options)
          test.ok(result, 'Result returned')
          test.ok(SettlementWindowModel.getByParams.withArgs(params, enums).calledOnce, 'SettlementWindowModel.getByParams with args ... called once')

          SettlementWindowModel.getByParams = sandbox.stub().returns()
          try {
            await SettlementWindowService.getByParams(params, enums)
            test.fail('Error expected, but not thrown!')
          } catch (err) {
            test.ok(err instanceof Error, `Error "${err.message}" thrown as expected`)
            test.ok(SettlementWindowModel.getByParams.withArgs(params, enums).calledOnce, 'SettlementWindowModel.getByParams with args ... called once')
          }

          params = { query: {} }
          try {
            await SettlementWindowService.getByParams(params, enums)
            test.fail('Error expected, but not thrown!')
          } catch (err) {
            test.pass(`Error "${err.message.substr(0, 50)} ..." thrown as expected`)
          }

          test.end()
        } catch (err) {
          logger.error(`getByParamsTest failed with error - ${err}`)
          test.fail()
          test.end()
        }
      })

      await getByParamsTest.end()
    } catch (err) {
      logger.error(`settlementWindowServiceTest failed with error - ${err}`)
      getByParamsTest.fail()
      getByParamsTest.end()
    }
  })

  await settlementWindowServiceTest.test('getByParams should fail when no content is found', async getByParamsTest => {
    try {
      let params = { query: { participantId: 1, state: 'PENDING_SETTLEMENT' } }
      const enums = {}
      const options = { logger }
      const settlementWindowsMock = [{ settlementWindowId: 1 }, { settlementWindowId: 2 }]
      const settlementWindowMock = { settlementWindowId: 1, content: { id: 11 } }

      await getByParamsTest.test('return settlement windows', async test => {
        try {
          SettlementWindowContentModel.getBySettlementWindowId = sandbox.stub().returns(undefined)
          SettlementWindowModel.getById = sandbox.stub().returns(settlementWindowMock)
          SettlementWindowModel.getByParams = sandbox.stub().returns(settlementWindowsMock)
          try {
            await SettlementWindowService.getByParams(params, enums, options)
            test.fail('Error expected, but not thrown!')
          } catch (err) {
            test.equal(err.message, 'No records for settlementWidowContentId : 1 found')
          }
          SettlementWindowModel.getByParams = sandbox.stub().returns()
          try {
            await SettlementWindowService.getByParams(params, enums)
            test.fail('Error expected, but not thrown!')
          } catch (err) {
            test.ok(err instanceof Error, `Error "${err.message}" thrown as expected`)
            test.ok(SettlementWindowModel.getByParams.withArgs(params, enums).calledOnce, 'SettlementWindowModel.getByParams with args ... called once')
          }

          params = { query: {} }
          try {
            await SettlementWindowService.getByParams(params, enums)
            test.fail('Error expected, but not thrown!')
          } catch (err) {
            test.pass(`Error "${err.message.substr(0, 50)} ..." thrown as expected`)
          }

          test.end()
        } catch (err) {
          logger.error(`getByParamsTest failed with error - ${err}`)
          test.fail()
          test.end()
        }
      })

      await getByParamsTest.end()
    } catch (err) {
      logger.error(`settlementWindowServiceTest failed with error - ${err}`)
      getByParamsTest.fail()
      getByParamsTest.end()
    }
  })

  await settlementWindowServiceTest.test('process should', async processTest => {
    try {
      const params = { id: 1, request: { headers: { testHeader: 'testHeader' } } }
      const enums = {}
      const options = { logger }
      const settlementWindowIdMock = 1
      const settlementWindowMock = { settlementWindowId: settlementWindowIdMock, state: 'PROCESSING' }
      // Producer.produceMessage = sandbox.stub()

      await processTest.test('process settlement window and return it', async test => {
        try {
          SettlementWindowModel.process = sandbox.stub().returns(settlementWindowIdMock)

          SettlementWindowModel.getById = sandbox.stub().returns(settlementWindowMock)

          const result = await SettlementWindowService.process(params, enums, options)
          test.ok(result, 'Result returned')
          test.ok(SettlementWindowModel.process.withArgs(params, enums).calledOnce, 'SettlementWindowModel.process with args ... called once')
          test.ok(SettlementWindowModel.getById.withArgs({ settlementWindowId: settlementWindowIdMock }, enums).calledOnce, 'SettlementWindowModel.getById with args ... called once')

          SettlementWindowModel.process = sandbox.stub().throws(new Error('Error occurred'))
          try {
            await SettlementWindowService.process(params, enums)
            test.fail('Error expected, but not thrown!')
          } catch (err) {
            test.equal(err.message, 'Error occurred', `Error "${err.message}" thrown as expected`)
            test.ok(SettlementWindowModel.process.withArgs(params, enums).calledOnce, 'SettlementWindowModel.process with args ... called once')
          }

          test.end()
        } catch (err) {
          logger.error(`processTest failed with error - ${err}`)
          test.fail()
          test.end()
        }
      })

      await processTest.end()
    } catch (err) {
      logger.error(`settlementWindowServiceTest failed with error - ${err}`)
      processTest.fail()
      processTest.end()
    }
  })

  await settlementWindowServiceTest.test('close should', async processTest => {
    try {
      const settlementWindowIdMock = 1
      const settlementWindowMock = { settlementWindowId: settlementWindowIdMock, state: 'PROCESSING' }
      // Producer.produceMessage = sandbox.stub()

      await processTest.test('close settlement window and return it', async test => {
        try {
          SettlementWindowModel.close = sandbox.stub().returns(settlementWindowIdMock)
          SettlementWindowModel.getById = sandbox.stub().returns(settlementWindowMock)

          const result = await SettlementWindowService.close(settlementWindowIdMock, '')
          test.ok(result, 'Result returned')
          test.end()
        } catch (err) {
          logger.error(`processTest failed with error - ${err}`)
          test.fail()
          test.end()
        }
      })
      await processTest.end()
    } catch (err) {
      logger.error(`settlementWindowServiceTest failed with error - ${err}`)
      processTest.fail()
      processTest.end()
    }
  })

  await settlementWindowServiceTest.end()
})
