'use strict'

const Util = require('@mojaloop/central-services-shared').Util
const Logger = require('../../shared/logger').logger
const ErrorHandler = require('@mojaloop/central-services-error-handling')

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
    // transferState: Util.omitNil(t.transferState),
    transferState: t.transferState,
    completedTimestamp: t.completedTimestamp,
    ilpPacket: t.ilpPacket,
    condition: t.condition,
    fulfilment: t.fulfilment,
    expiration: t.expirationDate,
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
  payeeFsp: t.payeeTransferParticipantRecord.name,
  payerFsp: t.payerTransferParticipantRecord.name,
  amount:
  {
    currency: t.transferRecord.currencyId,
    amount: t.transferRecord.amount
  },
  transferState: t.transferStateChangeRecord.transferStateId,
  completedTimestamp: t.transferStateChangeRecord.createdDate,
  ilpPacket: t.ilpPacketRecord.value,
  fulfilment: null,
  condition: t.transferRecord.ilpCondition,
  expiration: t.transferRecord.expirationDate,
  extensionList: t.transferExtensionsRecordList
})

const fromSavePayeeTransferResponseExecuted = (t) => {
  return {
    transferId: t.transferStateChangeRecord.transferId,
    transferState: t.transferStateChangeRecord.transferStateId,
    completedTimestamp: (t.transferFulfilmentRecord && t.transferFulfilmentRecord.completedDate) ||
      t.transferStateChangeRecord.createdDate,
    fulfilment: t.transferFulfilmentRecord && t.transferFulfilmentRecord.ilpFulfilment,
    extensionList: t.transferExtensionRecordsList
  }
}

const transformExtensionList = (extensionList) => {
  return extensionList.map(x => {
    return {
      key: x.key,
      value: x.value
    }
  })
}

const transformTransferToFulfil = (transfer, isFx) => {
  try {
    if (!transfer || Object.keys(transfer).length === 0) {
      throw new Error('transformTransferToFulfil: transfer is required')
    }

    const result = {
      completedTimestamp: transfer.completedTimestamp
    }
    if (isFx) {
      result.conversionState = transfer.fxTransferStateEnumeration
    } else {
      result.transferState = transfer.transferStateEnumeration
    }

    if (transfer.fulfilment !== '0') result.fulfilment = transfer.fulfilment

    if (transfer.extensionList) {
      const extension = transformExtensionList(transfer.extensionList)
      if (extension.length > 0 && !isFx) {
        result.extensionList = { extension }
      }
    }

    return Util.omitNil(result)
  } catch (err) {
    throw ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.INTERNAL_SERVER_ERROR, `Unable to transform to fulfil response: ${err}`)
  }
}

const toTransfer = (t) => {
  // TODO: Validate 't' to confirm if its from the DB transferReadModel or from the saveTransferPrepare
  if (t.isTransferReadModel) {
    Logger.isDebugEnabled && Logger.debug('In aggregate transfer transform for isTransferReadModel')
    return Util.omitNil(fromTransferReadModel(t)) // TODO: Remove this once the DB validation is done for 't'
  } else if (t.isSaveTransferPrepared) {
    Logger.isDebugEnabled && Logger.debug('In aggregate transfer transform for isSaveTransferPrepared')
    return Util.omitNil(fromSaveTransferPrepared(t)) // TODO: Remove this once the DB validation is done for 't'
  } else if (t.savePayeeTransferResponseExecuted) {
    Logger.isDebugEnabled && Logger.debug('In aggregate transfer transform for isSavePayeeTransferResponseExecuted')
    return Util.omitNil(fromSavePayeeTransferResponseExecuted(t)) // TODO: Remove this once the DB validation is done for 't'
  } else throw ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.INTERNAL_SERVER_ERROR, `Unable to transform to transfer: ${t}`)
}

// const fromPayload = (payload) => Util.merge(payload, { id: UrlParser.idFromTransferUri(payload.id) })

module.exports = {
  toTransfer,
  toFulfil: transformTransferToFulfil
  // fromPayload
}
