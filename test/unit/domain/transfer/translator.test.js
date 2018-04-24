'use strict'

const Test = require('tape')
const Uuid = require('uuid4')
const UrlParser = require('../../../../src/lib/urlparser')
const TransferTranslator = require('../../../../src/domain/transfer/translator')
const Fixtures = require('../../../fixtures')

const executionCondition = 'ni:///sha-256;47DEQpj8HBSa-_TImW-5JCeuQeRkm5NMpJWZG3hSuFU?fpt=preimage-sha-256&cost=0'

Test('TransferTranslator', transferTranslatorTest => {
  transferTranslatorTest.test('toTransfer should', function (toTransferTest) {
    toTransferTest.test('translate an argument containing a "id" field', function (t) {
      const from = {
        'id': '3a2a1d9e-8640-4d2d-b06c-84f2cd613209',
        'ledger': 'http://central-ledger',
        'credits': [
          {
            'participant': 'http://central-ledger/participants/bob',
            'amount': 50,
            'memo': {
              'some_property': 'value'
            },
            'rejection_message': Fixtures.rejectionMessage()
          }
        ],
        'debits': [
          {
            'participant': 'http://central-ledger/participants/alice',
            'amount': 50,
            'memo': {
              'some_property': 'value'
            }
          }
        ],
        'execution_condition': executionCondition,
        'expires_at': '2016-12-16T00:00:01.000Z',
        'state': 'prepared',
        timeline: {
          prepared_at: '2016-12-16T00:00:01.000Z',
          executed_at: null,
          rejected_at: '2016-12-18T00:00:01.000Z'
        },
        rejection_reason: 'some reason'
      }

      const expected = {
        id: 'http://central-ledger/transfers/3a2a1d9e-8640-4d2d-b06c-84f2cd613209',
        ledger: 'http://central-ledger',
        credits: [
          {
            participant: 'http://central-ledger/participants/bob',
            amount: '50.00',
            memo: {
              'some_property': 'value'
            },
            rejection_message: Fixtures.rejectionMessage()
          }
        ],
        debits: [
          { participant: 'http://central-ledger/participants/alice',
            amount: '50.00',
            memo: {
              'some_property': 'value'
            }
          }
        ],
        execution_condition: executionCondition,
        expires_at: '2016-12-16T00:00:01.000Z',
        state: 'prepared',
        timeline: {
          prepared_at: '2016-12-16T00:00:01.000Z',
          rejected_at: '2016-12-18T00:00:01.000Z'
        },
        rejection_reason: 'some reason'
      }

      let actual = TransferTranslator.toTransfer(from)
      t.deepEquals(expected, actual)
      t.end()
    })

    toTransferTest.test('not include properties that start with $', test => {
      const from = {
        '$id': 'bad-id',
        'id': 'good-id'
      }
      const actual = TransferTranslator.toTransfer(from)
      test.deepEquals(actual, { id: `http://central-ledger/transfers/${from.id}`, timeline: {} })
      test.end()
    })

    toTransferTest.test('translate an argument containing a "transferId" field', function (t) {
      const from = {
        'transferId': '3a2a1d9e-8640-4d2d-b06c-84f2cd613209',
        'state': 'prepared',
        'ledger': 'http://central-ledger',
        'payeeAmount': 50.00,
        'payeeNote': '{"source_transfer_id":"f17f52d9-e8b2-4bff-9f01-18c4d388c27a","source_transfer_amount":"12.00","source_transfer_ledger":"levelone.dfsp1."}',
        'payerAmount': 50.00,
        'payerNote': null,
        'executionCondition': executionCondition,
        'cancellationCondition': null,
        'rejectionReason': null,
        'expirationDate': '2016-12-16T00:00:01.000Z',
        'additionalInfo': null,
        'preparedDate': '2016-11-16T20:02:19.363Z',
        'executedDate': '2016-11-17T20:02:19.363Z',
        'fulfillment': null,
        'payeeRejected': 0,
        'payeeRejectionMessage': null,
        'rejectedDate': null,
        'payerParticipantId': 2,
        'payeeParticipantId': 1,
        'creditParticipantName': 'bob',
        'debitParticipantName': 'alice'
      }
      const expected = {
        id: 'http://central-ledger/transfers/3a2a1d9e-8640-4d2d-b06c-84f2cd613209',
        ledger: 'http://central-ledger',
        credits: [
          { participant: 'http://central-ledger/participants/bob',
            amount: '50.00',
            rejected: false
          }
        ],
        debits: [
          { participant: 'http://central-ledger/participants/alice',
            amount: '50.00',
            memo: {
              'source_transfer_id': 'f17f52d9-e8b2-4bff-9f01-18c4d388c27a',
              'source_transfer_amount': '12.00',
              'source_transfer_ledger': 'levelone.dfsp1.'
            }
          }
        ],
        execution_condition: executionCondition,
        expires_at: '2016-12-16T00:00:01.000Z',
        state: 'prepared',
        timeline: {
          prepared_at: '2016-11-16T20:02:19.363Z',
          executed_at: '2016-11-17T20:02:19.363Z'
        }
      }
      let actual = TransferTranslator.toTransfer(from)
      t.deepEquals(actual, expected)
      t.end()
    })

    toTransferTest.test('translate all properties containing a "transferId" field', function (t) {
      const rejectionMessage = Fixtures.rejectionMessage()
      const from = {
        'transferId': '3a2a1d9e-8640-4d2d-b06c-84f2cd613209',
        'state': 'prepared',
        'ledger': 'http://central-ledger',
        'payeeAmount': 50.00,
        'payeeNote': 'a debit memo',
        'payerAmount': 50.00,
        'payerNote': 'a credit memo',
        'payeeRejectionMessage': JSON.stringify(rejectionMessage),
        'executionCondition': executionCondition,
        'cancellationCondition': 'cancellation condition',
        'rejectionReason': 'rejection reason',
        'expirationDate': '2016-12-16T00:00:01.000Z',
        'additionalInfo': '{}',
        'preparedDate': '2016-11-16T20:02:19.363Z',
        'executedDate': '2016-11-17T20:02:19.363Z',
        'rejectedDate': '2016-11-17T20:02:19.363Z',
        'fulfillment': 'fulfillment',
        'payeeRejected': 1,
        'payerParticipantId': 2,
        'payeeParticipantId': 1,
        'creditParticipantName': 'bob',
        'debitParticipantName': 'alice'
      }
      const expected = {
        id: 'http://central-ledger/transfers/3a2a1d9e-8640-4d2d-b06c-84f2cd613209',
        ledger: 'http://central-ledger',
        credits: [
          { participant: 'http://central-ledger/participants/bob',
            amount: '50.00',
            memo: 'a credit memo',
            rejected: true,
            rejection_message: rejectionMessage
          }
        ],
        debits: [
          { participant: 'http://central-ledger/participants/alice',
            amount: '50.00',
            memo: 'a debit memo'
          }
        ],
        cancellation_condition: 'cancellation condition',
        execution_condition: executionCondition,
        expires_at: '2016-12-16T00:00:01.000Z',
        rejection_reason: 'rejection reason',
        state: 'prepared',
        timeline: {
          prepared_at: '2016-11-16T20:02:19.363Z',
          executed_at: '2016-11-17T20:02:19.363Z',
          rejected_at: '2016-11-17T20:02:19.363Z'
        }
      }
      const actual = TransferTranslator.toTransfer(from)
      t.deepEquals(actual, expected)
      t.end()
    })

    toTransferTest.test('throw an exception if argument does not contain "id" or "transferId" field', function (t) {
      t.throws(() => TransferTranslator.toTransfer({}), new Error('Unable to translate to transfer: {}'))
      t.end()
    })

    toTransferTest.end()
  })

  transferTranslatorTest.test('fromPayload should', fromPayloadTest => {
    fromPayloadTest.test('convert it from uri to UUID', test => {
      const id = Uuid()
      const transferUri = UrlParser.toTransferUri(id)
      test.notEqual(id, transferUri)
      const payload = { id: transferUri }
      const result = TransferTranslator.fromPayload(payload)
      test.equal(result.id, id.toString())
      test.end()
    })

    fromPayloadTest.end()
  })
  transferTranslatorTest.end()
})
