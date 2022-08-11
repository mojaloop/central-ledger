'use strict'

const ErrorHandler = require('@mojaloop/central-services-error-handling')

const transformTransferToGetResponse = (transfer) => {
  try {
    // TODO
  } catch (err) {
    throw ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.INTERNAL_SERVER_ERROR, `Unable to transform to fulfil response: ${err}`)
  }
}

module.exports = {
  transformTransferToGetResponse
}
