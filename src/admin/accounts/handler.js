'use strict'

const Account = require('../../domain/account')
const Errors = require('../../errors')
const UrlParser = require('../../lib/urlparser')
const Sidecar = require('../../lib/sidecar')

const entityItem = ({name, createdDate, isDisabled}) => {
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

const create = async function (request, h) {
  Sidecar.logRequest(request)
  const entity = await Account.getByName(request.payload.name)
  await handleExistingRecord(entity)
  const account = await Account.create(request.payload)
  return h.response(entityItem(account)).code(201)
}

const getAll = async function (request, h) {
  const results = await Account.getAll()
  return results.map(entityItem)
}

const getByName = async function (request, h) {
  const entity = await Account.getByName(request.params.name)
  handleMissingRecord(entity)
  return entityItem(entity)
}

const update = async function (request, h) {
  Sidecar.logRequest(request)
  const updatedEntity = await Account.update(request.params.name, request.payload)
  return entityItem(updatedEntity)
}

module.exports = {
  create,
  getAll,
  getByName,
  update
}
