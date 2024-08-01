const fxTransferModel = require('../../models/fxTransfer')
const TransferService = require('../../domain/transfer')
const cyril = require('../../domain/fx/cyril')

// abstraction on transfer and fxTransfer
const createRemittanceEntity = (isFx) => {
  return {
    isFx,

    async getDuplicate (id) {
      return isFx
        ? fxTransferModel.duplicateCheck.getFxTransferDuplicateCheck(id)
        : TransferService.getTransferDuplicateCheck(id)
    },
    async saveDuplicateHash (id, hash) {
      return isFx
        ? fxTransferModel.duplicateCheck.saveFxTransferDuplicateCheck(id, hash)
        : TransferService.saveTransferDuplicateCheck(id, hash)
    },

    async savePreparedRequest (
      payload,
      reason,
      isValid,
      determiningTransferCheckResult,
      proxyObligation
    ) {
      // todo: add histoTimer and try/catch here
      return isFx
        ? fxTransferModel.fxTransfer.savePreparedRequest(
          payload,
          reason,
          isValid,
          determiningTransferCheckResult,
          proxyObligation
        )
        : TransferService.prepare(
          payload,
          reason,
          isValid,
          determiningTransferCheckResult,
          proxyObligation
        )
    },

    async getByIdLight (id) {
      return isFx
        ? fxTransferModel.fxTransfer.getByIdLight(id)
        : TransferService.getByIdLight(id)
    },

    async checkIfDeterminingTransferExists (payload, proxyObligation) {
      return isFx
        ? cyril.checkIfDeterminingTransferExistsForFxTransferMessage(payload, proxyObligation)
        : cyril.checkIfDeterminingTransferExistsForTransferMessage(payload)
    },

    async getPositionParticipant (payload, determiningTransferCheckResult, proxyObligation) {
      return isFx
        ? cyril.getParticipantAndCurrencyForFxTransferMessage(payload, determiningTransferCheckResult)
        : cyril.getParticipantAndCurrencyForTransferMessage(payload, determiningTransferCheckResult, proxyObligation)
    },

    async logTransferError (id, errorCode, errorDescription) {
      return isFx
        ? fxTransferModel.stateChange.logTransferError(id, errorCode, errorDescription)
        : TransferService.logTransferError(id, errorCode, errorDescription)
    }
  }
}

module.exports = createRemittanceEntity
