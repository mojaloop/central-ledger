'use strict'

const Account = require('../../domain/account')
const Config = require('../../lib/config')
const UrlParser = require('../../lib/urlparser')
const Util = require('../../lib/util')
const PositionService = require('../../domain/position')
const Errors = require('../../errors')
const Sidecar = require('../../lib/sidecar')
// const Logger = require('@mojaloop/central-services-shared').Logger

const buildAccount = (account) => {
  return {
    id: UrlParser.toAccountUri(account.name),
    name: account.name,
    ledger: Config.HOSTNAME
  }
}

const buildResponse = (account, { net = '0' } = {}) => {
  // Logger.info('Account')
  // Logger.info(account)
  return Util.mergeAndOmitNil(buildAccount(account), {
    created: account.createdDate,
    balance: net,
    is_disabled: account.isDisabled || false,
    credentials: account.credentials,
    emailAddress: account.emailAddress
  })
}

const settlementResponse = (settlement) => {
  return {
    account_id: UrlParser.toAccountUri(settlement.accountName),
    account_number: settlement.accountNumber,
    routing_number: settlement.routingNumber
  }
}

const handleExistingRecord = (entity) => {
  if (entity) {
    throw new Errors.RecordExistsError()
  }
  return entity
}

const handleMissingRecord = (entity) => {
  if (!entity) {
    throw new Errors.NotFoundError('The requested resource could not be found.')
  }
  return entity
}

const getPosition = (account) => {
  return PositionService.calculateForAccount(account)
    .then(handleMissingRecord)
    .then(position => buildResponse(account, position))
}

exports.create = (request, reply) => {
  Sidecar.logRequest(request)
  Account.getByName(request.payload.name)
    .then(handleExistingRecord)
    .then(() => Account.create(request.payload))
    .then(account => reply(buildResponse(account)).code(201))
    .catch(reply)
}

// exports.create = (request, reply) => {
//   Sidecar.logRequest(request)
//  Account.getByName(request.payload.name)
//    .then(handleExistingRecord)
//   .then(() => Account.create(request.payload))
//    .then(account => reply(buildResponse(account)).code(201))
//    .catch((err) => {
      // Logger.info('error has occurred' + err)
      // console.log(request)
//      Logger.info(err)
//    })
// }

exports.updateUserCredentials = (request, reply) => {
  Sidecar.logRequest(request)
  const accountName = request.params.name
  const credentials = request.auth.credentials
  const authenticated = (credentials && (credentials.is_admin || credentials.name === accountName))

  if (!authenticated) {
    throw new Errors.UnauthorizedError('Invalid attempt updating the password.')
  }

  Account.getByName(request.params.name)
    .then(handleMissingRecord)
    .then(account => Account.updateUserCredentials(account, request.payload))
    .then(updatedAccount => buildAccount(updatedAccount))
    .then(reply)
    .catch(reply)
}

exports.updateAccountSettlement = (request, reply) => {
  Sidecar.logRequest(request)
  const accountName = request.params.name
  const credentials = request.auth.credentials
  const authenticated = (credentials && (credentials.is_admin || credentials.name === accountName))

  if (!authenticated) {
    throw new Errors.UnauthorizedError('Invalid attempt updating the settlement.')
  }

  Account.getByName(request.params.name)
    .then(handleMissingRecord)
    .then(account => Account.updateAccountSettlement(account, request.payload))
    .then(settlement => settlementResponse(settlement))
    .then(reply)
    .catch(reply)
}

exports.getByName = (request, reply) => {
  Sidecar.logRequest(request)
  const accountName = request.params.name
  const credentials = request.auth.credentials
  const authenticated = (credentials && (credentials.is_admin || credentials.name === accountName))
  Account.getByName(request.params.name)
    .then(handleMissingRecord)
    .then(account => (authenticated ? getPosition(account) : buildAccount(account)))
    .then(reply)
    .catch(reply)
}
