'use strict'

const Account = require('../../domain/account')
const Config = require('../../lib/config')
const UrlParser = require('../../lib/urlparser')
const Util = require('../../lib/util')
const PositionService = require('../../domain/position')
const Errors = require('../../errors')
const Sidecar = require('../../lib/sidecar')
// const Logger = require('@mojaloop/central-services-shared').Logger
const Boom = require('boom')

const buildAccount = (account) => {
  return {
    id: UrlParser.toAccountUri(account.name),
    name: account.name,
    ledger: Config.HOSTNAME
  }
}

const buildResponse = (account, {net = '0'} = {}) => {
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

exports.create = async function (request, h) {
  try {
    Sidecar.logRequest(request)
    const entity = await Account.getByName(request.payload.name)
    handleExistingRecord(entity)
    const account = await Account.create(request.payload)
    return h.response(buildResponse(account)).code(201)
  } catch (err) {
    throw Boom.boomify(err, {statusCode: 400, message: 'An error has occurred'})
  }
}

exports.updateUserCredentials = async function (request, h) {
  Sidecar.logRequest(request)
  const accountName = request.params.name
  const credentials = request.auth.credentials
  const authenticated = (credentials && (credentials.is_admin || credentials.name === accountName))

  if (!authenticated) {
    throw Boom.boomify(new Errors.UnauthorizedError('Invalid attempt updating the password.'), {statusCode: 400})
  }
  const account = await Account.getByName(request.params.name)
  handleMissingRecord(account)
  const updatedAccount = await Account.updateUserCredentials(account, request.payload)
  return buildAccount(updatedAccount)
}

exports.updateAccountSettlement = async function (request, h) {
  Sidecar.logRequest(request)
  const accountName = request.params.name
  const credentials = request.auth.credentials
  const authenticated = (credentials && (credentials.is_admin || credentials.name === accountName))

  if (!authenticated) {
    throw new Errors.UnauthorizedError('Invalid attempt updating the settlement.')
  }
  const account = await Account.getByName(request.params.name)
  handleMissingRecord(account)
  const settlement = await Account.updateAccountSettlement(account, request.payload)
  return settlementResponse(settlement)
}

exports.getByName = async function (request, h) {
  Sidecar.logRequest(request)
  const accountName = request.params.name
  const credentials = request.auth.credentials
  const authenticated = (credentials && (credentials.is_admin || credentials.name === accountName))
  const account = await Account.getByName(request.params.name)
  handleMissingRecord(account)
  if (authenticated) {
    return await getPosition(account)
  } else {
    return buildAccount(account)
  }
}
