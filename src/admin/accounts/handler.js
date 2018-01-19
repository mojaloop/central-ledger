'use strict'

const Account = require('../../domain/account')
const Errors = require('../../errors')
const UrlParser = require('../../lib/urlparser')
const Sidecar = require('../../lib/sidecar')

const entityItem = ({ name, createdDate, isDisabled }) => {
  const link = UrlParser.toAccountUri(name)
  return {
    name,
    id: link,
    created: createdDate,
    is_disabled: isDisabled,
    '_links': {
      self: link
    },
    emailAddress: name + '@test.com'
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

const create = (request, reply) => {
  Sidecar.logRequest(request)
  Account.getByName(request.payload.name)
    .then(handleExistingRecord)
    .then(() => Account.create(request.payload))
    .then(account => reply(entityItem(account)).code(201))
    .catch(reply)
}

const getAll = (request, reply) => {
  Account.getAll()
    .then(results => results.map(entityItem))
    .then(reply)
    .catch(reply)
}

const getByName = (request, reply) => {
  Account.getByName(request.params.name)
    .then(handleMissingRecord)
    .then(account => entityItem(account))
    .then(reply)
    .catch(reply)
}

const update = (request, reply) => {
  Sidecar.logRequest(request)
  Account.update(request.params.name, request.payload)
    .then(result => reply(entityItem(result)))
    .catch(reply)
}

module.exports = {
  create,
  getAll,
  getByName,
  update
}
