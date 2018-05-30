'use strict'

const Util = require('../../lib/util')
const Logger = require('@mojaloop/central-services-shared').Logger

const transferProperties = [
  'transferId',
  'amount',
  'transferState',
  'completedTimestamp',
  'ilpPacket',
  'fulfilment',
  'condition',
  'expiration',
  'extensionList'
]

const formatAmount = (asset) => Util.mergeAndOmitNil(asset, {
  amount: Util.formatAmount(asset.amount),
  currency: asset.currency
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
    transferState: Util.omitNil(t.transferState),
    completedTimestamp: Util.omitNil(t.completedTimestamp),
    ilpPacket: t.ilpPacket,
    fulfilment: t.fulfilment,
    condition: t.condition,
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
  transferState: t.transferState,
  completedTimestamp: t.completedTimestamp,
  ilpPacket: t.ilpPacket,
  fulfilment: t.fulfilment,
  condition: t.condition,
  expiration: t.expirationDate,
  extensionList: t.extensionList
})

const fromSaveTransferPrepared = (t) => fromTransferAggregate({
  transferId: t.transferRecord.transferId,
  payeeFsp: t.transferRecord.payeeFsp,
  payerFsp: t.transferRecord.payerFsp,
  amount:
  {
    currency: t.transferRecord.currency,
    amount: t.transferRecord.amount
  },
  transferStatus: t.transferStateRecord.transferStateId,
  completedTimestamp: t.transferStateRecord.changedDate,
  ilpPacket: t.ilpRecord.ilpPacket || t.ilpRecord.packet,
  fulfilment: t.ilpRecord.fulfilment,
  condition: t.ilpRecord.condition,
  expiration: t.transferRecord.expirationDate,
  extensionList: t.extensionsRecordList
})

// TODO: Need to fix this method
const toTransfer = (t) => {
  // TODO: Validate 't' to confirm if its from the DB transferReadModel or from the saveTransferPrepare
  if (t.isTransferReadModel) {
    Logger.debug('In aggregate transfer translator for isTransferReadModel')
    return fromTransferReadModel(t) // TODO: Remove this once the DB validation is done for 't'
  } else if (t.isSaveTransferPrepared) {
    Logger.debug('In aggregate transfer translator for isSaveTransferPrepared')
    return fromSaveTransferPrepared(t) // TODO: Remove this once the DB validation is done for 't'
  } else throw new Error(`Unable to translate to transfer: ${t}`)
}

// const fromPayload = (payload) => Util.merge(payload, { id: UrlParser.idFromTransferUri(payload.id) })

module.exports = {
  toTransfer
  // fromPayload
}

