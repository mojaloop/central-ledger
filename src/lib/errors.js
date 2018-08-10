'use strict'

const error = {
  4001: 'Payer FSP has insufficient liquidity to perform the transfer'
}

const createErrorInformation = (errorCode, extensionList) => {
  return {
    errorCode,
    errorDescription: error[errorCode],
    extensionList
  }
}

const getErrorDescription = (errorCode) => {
  return error[errorCode]
}

module.exports = {
  createErrorInformation,
  getErrorDescription
}
