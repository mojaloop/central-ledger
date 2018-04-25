'use strict'

const UrlParser = require('../../lib/urlparser')
const Util = require('../../lib/util')
const Logger = require('@mojaloop/central-services-shared').Logger

const transferProperties = [
  'additional_info',
  'cancellation_condition',
  'credits',
  'debits',
  'execution_condition',
  'expires_at',
  'expiry_duration',
  'id',
  'ledger',
  'rejection_reason',
  'state',
  'timeline'
]

const formatAsset = (asset) => Util.mergeAndOmitNil(asset, {
  participant: UrlParser.toParticipantUri(asset.participant),
  amount: Util.formatAmount(asset.amount),
  memo: Util.parseJson(asset.memo),
  rejection_message: Util.parseJson(asset.rejection_message)
})

const formatAssets = (assets) => (Array.isArray(assets) ? assets.map(formatAsset) : assets)

const fromTransferAggregate = (t) => {
  const cleanProperties = Util.omitNil({
    id: UrlParser.toTransferUri(t.id),
    credits: formatAssets(t.credits),
    debits: formatAssets(t.debits),
    timeline: Util.omitNil(t.timeline)
  })
  return Util.mergeAndOmitNil(Util.pick(t, transferProperties), cleanProperties)
}

const fromTransferReadModel = (t) => fromTransferAggregate({
  id: t.transferId,
  ledger: t.ledger,
  debits: [{
    participant: t.debitParticipantName,
    amount: t.payeeAmount,
    memo: t.payeeNote
  }],
  credits: [{
    participant: t.creditParticipantName,
    amount: t.payerAmount,
    memo: t.payerNote,
    rejected: t.payeeRejected === 1,
    rejection_message: t.payeeRejectionMessage
  }],
  cancellation_condition: t.cancellationCondition,
  execution_condition: t.executionCondition,
  expires_at: t.expirationDate,
  state: t.state,
  timeline: Util.omitNil({
    prepared_at: t.preparedDate,
    executed_at: t.executedDate,
    rejected_at: t.rejectedDate
  }),
  rejection_reason: t.rejectionReason
})

const toTransfer = (t) => {
  if (t.id) {
    Logger.info('In aggregate transfer translator')
    return fromTransferAggregate(t)
  } else if (t.transferId) {
    Logger.info('In read model transfer translator')
    return fromTransferReadModel(t)
  } else throw new Error(`Unable to translate to transfer: ${t}`)
}

const fromPayload = (payload) => Util.merge(payload, { id: UrlParser.idFromTransferUri(payload.id) })

module.exports = {
  toTransfer,
  fromPayload
}

