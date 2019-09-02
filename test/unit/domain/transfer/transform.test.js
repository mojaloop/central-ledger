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

 * Shashikant Hirugade <shashikant.hirugade@modusbox.com>
 --------------
 ******/

'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const Uuid = require('uuid4')
const TransformService = require('../../../../src/domain/transfer/transform')
const Util = require('@mojaloop/central-services-shared').Util

Test('Transform Service', transformTest => {
  let sandbox

  transformTest.beforeEach(t => {
    sandbox = Sinon.createSandbox()
    // sandbox.stub(TransferObjectTransform)
    t.end()
  })

  transformTest.afterEach(t => {
    sandbox.restore()
    t.end()
  })

  transformTest.test('toTransfer should', toTransferTest => {
    toTransferTest.test('return result for isTransferReadModel', async (test) => {
      try {
        const completedTransfer = {
          transferId: 'b51ec534-ee48-4575-b6a9-ead2955b8999',
          payerFsp: 'dfsp1',
          payeeFsp: 'dfsp2',
          currency: 'USD',
          amount: 433.88,
          ilpPacket: 'AYIBgQAAAAAAAASwNGxldmVsb25lLmRmc3AxLm1lci45T2RTOF81MDdqUUZERmZlakgyOVc4bXFmNEpLMHlGTFGCAUBQU0svMS4wCk5vbmNlOiB1SXlweUYzY3pYSXBFdzVVc05TYWh3CkVuY3J5cHRpb246IG5vbmUKUGF5bWVudC1JZDogMTMyMzZhM2ItOGZhOC00MTYzLTg0NDctNGMzZWQzZGE5OGE3CgpDb250ZW50LUxlbmd0aDogMTM1CkNvbnRlbnQtVHlwZTogYXBwbGljYXRpb24vanNvbgpTZW5kZXItSWRlbnRpZmllcjogOTI4MDYzOTEKCiJ7XCJmZWVcIjowLFwidHJhbnNmZXJDb2RlXCI6XCJpbnZvaWNlXCIsXCJkZWJpdE5hbWVcIjpcImFsaWNlIGNvb3BlclwiLFwiY3JlZGl0TmFtZVwiOlwibWVyIGNoYW50XCIsXCJkZWJpdElkZW50aWZpZXJcIjpcIjkyODA2MzkxXCJ9IgA',
          condition: 'YlK5TZyhflbXaDRPtR5zhCu8FrbgvrQwwmzuH0iQ0AI',
          expiration: '2016-05-24T08:38:08.699-04:00',
          extensionList: [
            {
              key: 'key1',
              value: 'value1'
            }
          ],
          transferState: 'COMMIT',
          completedTimestamp: '2016-06-24T08:38:08.699-04:00',
          fulfilment: 'adlcfFFpGkn3dDRPtR5zhCu8FrbgvrQwwmzuH0iQ0AI',
          expirationDate: '2016-06-24T09:38:08.699-04:00',
          isTransferReadModel: true
        }

        const expected = {
          amount: {
            amount: '433.88',
            currency: 'USD'
          },
          completedTimestamp:
            '2016-06-24T08:38:08.699-04:00',
          condition: 'YlK5TZyhflbXaDRPtR5zhCu8FrbgvrQwwmzuH0iQ0AI',
          expiration: '2016-06-24T09:38:08.699-04:00',
          extensionList: { extension: [{ key: 'key1', value: 'value1' }] },
          fulfilment: 'adlcfFFpGkn3dDRPtR5zhCu8FrbgvrQwwmzuH0iQ0AI',
          ilpPacket: 'AYIBgQAAAAAAAASwNGxldmVsb25lLmRmc3AxLm1lci45T2RTOF81MDdqUUZERmZlakgyOVc4bXFmNEpLMHlGTFGCAUBQU0svMS4wCk5vbmNlOiB1SXlweUYzY3pYSXBFdzVVc05TYWh3CkVuY3J5cHRpb246IG5vbmUKUGF5bWVudC1JZDogMTMyMzZhM2ItOGZhOC00MTYzLTg0NDctNGMzZWQzZGE5OGE3CgpDb250ZW50LUxlbmd0aDogMTM1CkNvbnRlbnQtVHlwZTogYXBwbGljYXRpb24vanNvbgpTZW5kZXItSWRlbnRpZmllcjogOTI4MDYzOTEKCiJ7XCJmZWVcIjowLFwidHJhbnNmZXJDb2RlXCI6XCJpbnZvaWNlXCIsXCJkZWJpdE5hbWVcIjpcImFsaWNlIGNvb3BlclwiLFwiY3JlZGl0TmFtZVwiOlwibWVyIGNoYW50XCIsXCJkZWJpdElkZW50aWZpZXJcIjpcIjkyODA2MzkxXCJ9IgA',
          transferId: 'b51ec534-ee48-4575-b6a9-ead2955b8999',
          transferState: 'COMMIT'
        }

        const result = TransformService.toTransfer(completedTransfer)
        test.deepEqual(result, expected, 'Results Match')
        test.end()
      } catch (e) {
        test.fail('Error Thrown')
        test.end()
      }
    })

    toTransferTest.test('return result for isTransferReadModel', async (test) => {
      try {
        const completedTransfer = {
          transferId: 'b51ec534-ee48-4575-b6a9-ead2955b8999',
          payerFsp: 'dfsp1',
          payeeFsp: 'dfsp2',
          currency: 'USD',
          amount: '433.88',
          ilpPacket: 'AYIBgQAAAAAAAASwNGxldmVsb25lLmRmc3AxLm1lci45T2RTOF81MDdqUUZERmZlakgyOVc4bXFmNEpLMHlGTFGCAUBQU0svMS4wCk5vbmNlOiB1SXlweUYzY3pYSXBFdzVVc05TYWh3CkVuY3J5cHRpb246IG5vbmUKUGF5bWVudC1JZDogMTMyMzZhM2ItOGZhOC00MTYzLTg0NDctNGMzZWQzZGE5OGE3CgpDb250ZW50LUxlbmd0aDogMTM1CkNvbnRlbnQtVHlwZTogYXBwbGljYXRpb24vanNvbgpTZW5kZXItSWRlbnRpZmllcjogOTI4MDYzOTEKCiJ7XCJmZWVcIjowLFwidHJhbnNmZXJDb2RlXCI6XCJpbnZvaWNlXCIsXCJkZWJpdE5hbWVcIjpcImFsaWNlIGNvb3BlclwiLFwiY3JlZGl0TmFtZVwiOlwibWVyIGNoYW50XCIsXCJkZWJpdElkZW50aWZpZXJcIjpcIjkyODA2MzkxXCJ9IgA',
          condition: 'YlK5TZyhflbXaDRPtR5zhCu8FrbgvrQwwmzuH0iQ0AI',
          expiration: '2016-05-24T08:38:08.699-04:00',
          extensionList: {
            key: 'key1',
            value: 'value1'
          },
          transferState: 'COMMIT',
          completedTimestamp: '2016-06-24T08:38:08.699-04:00',
          fulfilment: 'adlcfFFpGkn3dDRPtR5zhCu8FrbgvrQwwmzuH0iQ0AI',
          expirationDate: '2016-06-24T09:38:08.699-04:00',
          isTransferReadModel: true
        }

        const expected = {
          amount: {
            amount: '433.88',
            currency: 'USD'
          },
          completedTimestamp:
            '2016-06-24T08:38:08.699-04:00',
          condition: 'YlK5TZyhflbXaDRPtR5zhCu8FrbgvrQwwmzuH0iQ0AI',
          expiration: '2016-06-24T09:38:08.699-04:00',
          extensionList: { extension: { key: 'key1', value: 'value1' } },
          fulfilment: 'adlcfFFpGkn3dDRPtR5zhCu8FrbgvrQwwmzuH0iQ0AI',
          ilpPacket: 'AYIBgQAAAAAAAASwNGxldmVsb25lLmRmc3AxLm1lci45T2RTOF81MDdqUUZERmZlakgyOVc4bXFmNEpLMHlGTFGCAUBQU0svMS4wCk5vbmNlOiB1SXlweUYzY3pYSXBFdzVVc05TYWh3CkVuY3J5cHRpb246IG5vbmUKUGF5bWVudC1JZDogMTMyMzZhM2ItOGZhOC00MTYzLTg0NDctNGMzZWQzZGE5OGE3CgpDb250ZW50LUxlbmd0aDogMTM1CkNvbnRlbnQtVHlwZTogYXBwbGljYXRpb24vanNvbgpTZW5kZXItSWRlbnRpZmllcjogOTI4MDYzOTEKCiJ7XCJmZWVcIjowLFwidHJhbnNmZXJDb2RlXCI6XCJpbnZvaWNlXCIsXCJkZWJpdE5hbWVcIjpcImFsaWNlIGNvb3BlclwiLFwiY3JlZGl0TmFtZVwiOlwibWVyIGNoYW50XCIsXCJkZWJpdElkZW50aWZpZXJcIjpcIjkyODA2MzkxXCJ9IgA',
          transferId: 'b51ec534-ee48-4575-b6a9-ead2955b8999',
          transferState: 'COMMIT'
        }

        const result = TransformService.toTransfer(completedTransfer)
        test.deepEqual(result, expected, 'Results Match')
        test.end()
      } catch (e) {
        test.fail('Error Thrown')
        test.end()
      }
    })

    toTransferTest.test('return result for isSaveTransferPrepared', async (test) => {
      try {
        const preparedTransfer = {
          transferRecord: {
            transferId: 'b51ec534-ee48-4575-b6a9-ead2955b8999',
            currencyId: 'USD',
            amount: 100,
            ilpCondition: 'YlK5TZyhflbXaDRPtR5zhCu8FrbgvrQwwmzuH0iQ0AI',
            expirationDate: '2016-06-24T09:38:08.699-04:00'
          },
          payeeTransferParticipantRecord: {
            name: 'dfsp1'
          },
          payerTransferParticipantRecord: {
            name: 'dfsp2'
          },
          transferStateChangeRecord: {
            transferStateId: 'PREPARED',
            createdDate: '2016-06-24T09:38:08.699-04:00'
          },
          ilpPacketRecord: {
            value: 'AYIBgQAAAAAAAASwNGxldmVsb25lLmRmc3AxLm1lci45T2RTOF81MDdqUUZERmZlakgyOVc4bXFmNEpLMHlGTFGCAUBQU0svMS4wCk5vbmNlOiB1SXlweUYzY3pYSXBFdzVVc05TYWh3CkVuY3J5cHRpb246IG5vbmUKUGF5bWVudC1JZDogMTMyMzZhM2ItOGZhOC00MTYzLTg0NDctNGMzZWQzZGE5OGE3CgpDb250ZW50LUxlbmd0aDogMTM1CkNvbnRlbnQtVHlwZTogYXBwbGljYXRpb24vanNvbgpTZW5kZXItSWRlbnRpZmllcjogOTI4MDYzOTEKCiJ7XCJmZWVcIjowLFwidHJhbnNmZXJDb2RlXCI6XCJpbnZvaWNlXCIsXCJkZWJpdE5hbWVcIjpcImFsaWNlIGNvb3BlclwiLFwiY3JlZGl0TmFtZVwiOlwibWVyIGNoYW50XCIsXCJkZWJpdElkZW50aWZpZXJcIjpcIjkyODA2MzkxXCJ9IgA'
          },
          transferExtensionsRecordList: null,
          isSaveTransferPrepared: true
        }
        const expected = {
          amount: {
            amount: '100.00',
            currency: 'USD'
          },
          completedTimestamp: '2016-06-24T09:38:08.699-04:00',
          condition: 'YlK5TZyhflbXaDRPtR5zhCu8FrbgvrQwwmzuH0iQ0AI',
          expiration: '2016-06-24T09:38:08.699-04:00',
          ilpPacket: 'AYIBgQAAAAAAAASwNGxldmVsb25lLmRmc3AxLm1lci45T2RTOF81MDdqUUZERmZlakgyOVc4bXFmNEpLMHlGTFGCAUBQU0svMS4wCk5vbmNlOiB1SXlweUYzY3pYSXBFdzVVc05TYWh3CkVuY3J5cHRpb246IG5vbmUKUGF5bWVudC1JZDogMTMyMzZhM2ItOGZhOC00MTYzLTg0NDctNGMzZWQzZGE5OGE3CgpDb250ZW50LUxlbmd0aDogMTM1CkNvbnRlbnQtVHlwZTogYXBwbGljYXRpb24vanNvbgpTZW5kZXItSWRlbnRpZmllcjogOTI4MDYzOTEKCiJ7XCJmZWVcIjowLFwidHJhbnNmZXJDb2RlXCI6XCJpbnZvaWNlXCIsXCJkZWJpdE5hbWVcIjpcImFsaWNlIGNvb3BlclwiLFwiY3JlZGl0TmFtZVwiOlwibWVyIGNoYW50XCIsXCJkZWJpdElkZW50aWZpZXJcIjpcIjkyODA2MzkxXCJ9IgA',
          transferId: 'b51ec534-ee48-4575-b6a9-ead2955b8999',
          transferState: 'PREPARED'
        }

        const result = TransformService.toTransfer(preparedTransfer)
        test.deepEqual(result, expected, 'Results Match')
        test.end()
      } catch (e) {
        test.fail('Error Thrown')
        test.end()
      }
    })

    toTransferTest.test('return result for savePayeeTransferResponseExecuted', async (test) => {
      try {
        const transferId = Uuid()
        const executedTransfer = {
          transferFulfilmentRecord: {
            transferId,
            ilpFulfilment: 'YlK5TZyhflbXaDRPtR5zhCu8FrbgvrQwwmzuH0iQ0AI',
            completedDate: '2016-06-24T09:38:08.699-04:00'
          },
          transferStateChangeRecord: {
            transferId,
            transferStateId: 'COMMITTED',
            createdDate: '2016-06-24T09:38:08.699-04:00'
          },
          transferExtensionRecordsList: [
            {
              key: 'key1',
              value: 'value1'
            }
          ],
          savePayeeTransferResponseExecuted: true
        }

        const expected = {
          transferId,
          transferState: 'COMMITTED',
          completedTimestamp: '2016-06-24T09:38:08.699-04:00',
          fulfilment: 'YlK5TZyhflbXaDRPtR5zhCu8FrbgvrQwwmzuH0iQ0AI',
          extensionList: [{ key: 'key1', value: 'value1' }]
        }

        const result = TransformService.toTransfer(executedTransfer)
        test.deepEqual(result, expected, 'Results match after first call')

        const executedTransfer2 = Util.clone(executedTransfer)

        delete executedTransfer2.transferFulfilmentRecord.completedDate
        const result2 = TransformService.toTransfer(executedTransfer2)
        test.deepEqual(result2, expected, 'Results match after second call')

        test.end()
      } catch (e) {
        test.fail('Error Thrown')
        test.end()
      }
    })

    toTransferTest.test('throw error', async (test) => {
      try {
        const invalidTransfer = {}
        TransformService.toTransfer(invalidTransfer)
        test.fail('should throw')
        test.end()
      } catch (e) {
        test.ok(e instanceof Error)
        test.end()
      }
    })

    toTransferTest.end()
  })

  transformTest.test('toFulfil should', toFulfilTest => {
    toFulfilTest.test('return result for a COMMITTED fulfilment', async (test) => {
      try {
        const completedTransfer = {
          transferId: 'b51ec534-ee48-4575-b6a9-ead2955b8999',
          payerFsp: 'dfsp1',
          payeeFsp: 'dfsp2',
          currency: 'USD',
          amount: 433.88,
          ilpPacket: 'AYIBgQAAAAAAAASwNGxldmVsb25lLmRmc3AxLm1lci45T2RTOF81MDdqUUZERmZlakgyOVc4bXFmNEpLMHlGTFGCAUBQU0svMS4wCk5vbmNlOiB1SXlweUYzY3pYSXBFdzVVc05TYWh3CkVuY3J5cHRpb246IG5vbmUKUGF5bWVudC1JZDogMTMyMzZhM2ItOGZhOC00MTYzLTg0NDctNGMzZWQzZGE5OGE3CgpDb250ZW50LUxlbmd0aDogMTM1CkNvbnRlbnQtVHlwZTogYXBwbGljYXRpb24vanNvbgpTZW5kZXItSWRlbnRpZmllcjogOTI4MDYzOTEKCiJ7XCJmZWVcIjowLFwidHJhbnNmZXJDb2RlXCI6XCJpbnZvaWNlXCIsXCJkZWJpdE5hbWVcIjpcImFsaWNlIGNvb3BlclwiLFwiY3JlZGl0TmFtZVwiOlwibWVyIGNoYW50XCIsXCJkZWJpdElkZW50aWZpZXJcIjpcIjkyODA2MzkxXCJ9IgA',
          condition: 'YlK5TZyhflbXaDRPtR5zhCu8FrbgvrQwwmzuH0iQ0AI',
          expiration: '2016-05-24T08:38:08.699-04:00',
          extensionList: [
            {
              key: 'key1',
              value: 'value1'
            }
          ],
          transferState: 'COMMITTED',
          transferStateEnumeration: 'COMMITTED',
          completedTimestamp: '2016-06-24T08:38:08.699-04:00',
          fulfilment: 'adlcfFFpGkn3dDRPtR5zhCu8FrbgvrQwwmzuH0iQ0AI',
          expirationDate: '2016-06-24T09:38:08.699-04:00',
          isTransferReadModel: true
        }

        const expected = {
          fulfilment: 'adlcfFFpGkn3dDRPtR5zhCu8FrbgvrQwwmzuH0iQ0AI',
          completedTimestamp: '2016-06-24T08:38:08.699-04:00',
          transferState: 'COMMITTED',
          extensionList: [
            {
              key: 'key1',
              value: 'value1'
            }
          ]
        }

        const result = TransformService.toFulfil(completedTransfer)
        test.deepEqual(result, expected, 'Results Match')
        test.end()
      } catch (e) {
        test.fail('Error Thrown')
        test.end()
      }
    })

    toFulfilTest.test('return result for a ABORTED fulfilment', async (test) => {
      try {
        const completedTransfer = {
          transferId: 'b51ec534-ee48-4575-b6a9-ead2955b8999',
          payerFsp: 'dfsp1',
          payeeFsp: 'dfsp2',
          currency: 'USD',
          amount: 433.88,
          ilpPacket: 'AYIBgQAAAAAAAASwNGxldmVsb25lLmRmc3AxLm1lci45T2RTOF81MDdqUUZERmZlakgyOVc4bXFmNEpLMHlGTFGCAUBQU0svMS4wCk5vbmNlOiB1SXlweUYzY3pYSXBFdzVVc05TYWh3CkVuY3J5cHRpb246IG5vbmUKUGF5bWVudC1JZDogMTMyMzZhM2ItOGZhOC00MTYzLTg0NDctNGMzZWQzZGE5OGE3CgpDb250ZW50LUxlbmd0aDogMTM1CkNvbnRlbnQtVHlwZTogYXBwbGljYXRpb24vanNvbgpTZW5kZXItSWRlbnRpZmllcjogOTI4MDYzOTEKCiJ7XCJmZWVcIjowLFwidHJhbnNmZXJDb2RlXCI6XCJpbnZvaWNlXCIsXCJkZWJpdE5hbWVcIjpcImFsaWNlIGNvb3BlclwiLFwiY3JlZGl0TmFtZVwiOlwibWVyIGNoYW50XCIsXCJkZWJpdElkZW50aWZpZXJcIjpcIjkyODA2MzkxXCJ9IgA',
          condition: 'YlK5TZyhflbXaDRPtR5zhCu8FrbgvrQwwmzuH0iQ0AI',
          expiration: '2016-05-24T08:38:08.699-04:00',
          extensionList: [],
          transferState: 'ABORTED',
          transferStateEnumeration: 'ABORTED',
          completedTimestamp: '2016-06-24T08:38:08.699-04:00',
          fulfilment: 'adlcfFFpGkn3dDRPtR5zhCu8FrbgvrQwwmzuH0iQ0AI',
          expirationDate: '2016-06-24T09:38:08.699-04:00',
          isTransferReadModel: true
        }

        const expected = {
          fulfilment: 'adlcfFFpGkn3dDRPtR5zhCu8FrbgvrQwwmzuH0iQ0AI',
          completedTimestamp: '2016-06-24T08:38:08.699-04:00',
          transferState: 'ABORTED'
        }

        const result = TransformService.toFulfil(completedTransfer)
        test.deepEqual(result, expected, 'Results Match')
        test.end()
      } catch (e) {
        test.fail('Error Thrown')
        test.end()
      }
    })

    toFulfilTest.test('throw error', async (test) => {
      try {
        const invalidTransfer = {}
        TransformService.toFulfil(invalidTransfer)
        test.fail('should throw')
        test.end()
      } catch (e) {
        test.ok(e instanceof Error)
        test.end()
      }
    })

    toFulfilTest.end()
  })

  transformTest.end()
})
