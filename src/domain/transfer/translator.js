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

// const formatAsset = (asset) => Util.mergeAndOmitNil(asset, {
//   participant: UrlParser.toParticipantUri(asset.participant),
//   amount: Util.formatAmount(asset.amount),
//   memo: Util.parseJson(asset.memo),
//   rejection_message: Util.parseJson(asset.rejection_message)
// })

// const formatAssets = (assets) => (Array.isArray(assets) ? assets.map(formatAsset) : assets)

/* const fromTransferAggregate = (t) => {
  const cleanProperties = Util.omitNil({
    id: UrlParser.toTransferUri(t.id),
    credits: formatAssets(t.credits),
    debits: formatAssets(t.debits),
    timeline: Util.omitNil(t.timeline)
  })
  return Util.mergeAndOmitNil(Util.pick(t, transferProperties), cleanProperties)
} */

// const fromTransferReadModel = (t) => fromTransferAggregate({
//   id: t.transferId,
//   ledger: t.ledger,
//   debits: [{
//     participant: t.debitParticipantName,
//     amount: t.payeeAmount,
//     memo: t.payeeNote
//   }],
//   credits: [{
//     participant: t.creditParticipantName,
//     amount: t.payerAmount,
//     memo: t.payerNote,
//     rejected: t.payeeRejected === 1,
//     rejection_message: t.payeeRejectionMessage
//   }],
//   cancellation_condition: t.cancellationCondition,
//   execution_condition: t.executionCondition,
//   expires_at: t.expirationDate,
//   state: t.state,
//   timeline: Util.omitNil({
//     prepared_at: t.preparedDate,
//     executed_at: t.executedDate,
//     rejected_at: t.rejectedDate
//   }),
//   rejection_reason: t.rejectionReason
// })

const formatAmount = (asset) => Util.mergeAndOmitNil(asset, {
  amount: Util.formatAmount(asset.amount),
  currency: Util.omitNil(asset.currency)
})

const formatExtensionKeyValue = (asset) => Util.mergeAndOmitNil(asset, {
  key: asset.key,
  value: asset.value
})

const formatExtension = (assets) => (Array.isArray(assets) ? assets.map(formatExtensionKeyValue) : assets)

const formatExtensionList = (assets) => {
  if (assets) {
    return {
      extension: formatExtension(assets)
    }
  } else {
    return null
  }
}

const fromTransferAggregate = (t) => {
  const cleanProperties = Util.omitNil({
    transferId: t.transferId,
    amount: formatAmount(t.amount),
    ilpPacket: Util.omitNil(t.ilpPacket),
    fulfillment: Util.omitNil(t.fulfillment),
    condition: Util.omitNil(t.condition),
    expiration: Util.omitNil(t.expirationDate),
    extensionList: formatExtensionList(t.extensionList)
  })
  return Util.mergeAndOmitNil(Util.pick(t, transferProperties), cleanProperties)
}

const fromTransferReadModel = (t) => fromTransferAggregate({
  transferId: t.transferId,
  payeeFsp: t.payeeFsp,
  payerFsp: t.payerFsp,
  amount:
  {
    currency: t.currency,
    amount: t.amount
  },
  ilpPacket: t.ilpPacket,
  fulfillment: t.fulfillment,
  condition: t.condition,
  expiration: t.expirationDate,
  extensionList: t.extensionList
})

// TODO: Need to fix this method
const toTransfer = (t) => {
  // TODO: Validate 't' to confirm if its from the DB
  if (t.isTransferReadModel) {
    Logger.debug('In aggregate transfer translator')
    return fromTransferReadModel(t) // TODO: Remove this once the DB validation is done for 't'
  } else throw new Error(`Unable to translate to transfer: ${t}`)
  // if (t.transferId) {
  //   Logger.info('In aggregate transfer translator')
  //   return fromTransferAggregate(t)
  // } else if (t.transferId) {
  //   Logger.info('In read model transfer translator')
  //   return fromTransferReadModel(t)
  // } else throw new Error(`Unable to translate to transfer: ${t}`)
}

const fromPayload = (payload) => Util.merge(payload, { id: UrlParser.idFromTransferUri(payload.id) })

module.exports = {
  toTransfer,
  fromPayload
}

