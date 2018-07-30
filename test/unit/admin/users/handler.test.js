'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const P = require('bluebird')
const Uuid = require('uuid4')
const SecurityService = require('../../../../src/domain/security')
const Handler = require('../../../../src/admin/party/handler')
const Sidecar = require('../../../../src/lib/sidecar')

Test('Party handler', handlerTest => {
  let sandbox

  handlerTest.beforeEach(test => {
    sandbox = Sinon.createSandbox()
    sandbox.stub(SecurityService)
    sandbox.stub(Sidecar, 'logRequest')
    test.end()
  })

  handlerTest.afterEach(test => {
    sandbox.restore()
    test.end()
  })

  handlerTest.test('create should createParty in service', async function (test) {
    const party = {firstName: 'dave'}

    SecurityService.createParty.returns(P.resolve(party))

    const request = {
      payload: party
    }

    const response = await Handler.create(request, {})
    test.equal(response, party)
    test.ok(Sidecar.logRequest.calledWith(request))
    test.end()
  })

  handlerTest.test('getAll should get all party from service', async function (test) {
    const party = [{}, {}]
    SecurityService.getAllParty.returns(P.resolve(party))

    const response = await Handler.getAll({}, {})
    test.equal(response, party)
    test.end()
  })

  handlerTest.test('getById should get party by id from service', async function (test) {
    const party = {firstName: 'Dave'}
    const partyId = Uuid()
    SecurityService.getPartyById.withArgs(partyId).returns(P.resolve(party))

    const response = await Handler.getById({params: {id: partyId}}, {})
    test.equal(response, party)
    test.end()
  })

  handlerTest.test('remove should deleteParty in service and return empty', async function (test) {
    const partyId = Uuid()

    SecurityService.deleteParty.returns(P.resolve({}))

    const request = {params: {id: partyId}}

    const response = await Handler.remove(request, {})
    test.deepEqual(response, {})
    test.ok(Sidecar.logRequest.calledWith(request))
    test.ok(SecurityService.deleteParty.calledWith(partyId))
    test.end()
  })

  handlerTest.test('update should update party by id', async function (test) {
    const partyId = Uuid()
    const details = {firstName: 'Dave'}
    const party = {lastName: 'Superuser'}

    SecurityService.updateParty.returns(P.resolve(party))
    const request = {
      params: {id: partyId},
      payload: details
    }

    const response = await Handler.update(request, {})
    test.deepEqual(response, party)
    test.ok(Sidecar.logRequest.calledWith(request))
    test.ok(SecurityService.updateParty.calledWith(partyId, details))
    test.end()
  })

  handlerTest.test('getRole should return role from service', async function (test) {
    const role = [{}, {}]
    const partyId = Uuid()
    SecurityService.getPartyRole.withArgs(partyId).returns(P.resolve(role))

    const response = await Handler.getRole({params: {id: partyId}}, {})
    test.deepEqual(response, role)
    test.end()
  })

  handlerTest.test('updateRole should update role in service', async function (test) {
    const updatedRole = [{}, {}]
    const roleIds = [Uuid(), Uuid()]
    const partyId = Uuid()

    SecurityService.updatePartyRole.withArgs(partyId, roleIds).returns(P.resolve(updatedRole))
    const request = {
      params: {id: partyId},
      payload: roleIds
    }

    const response = await Handler.updateRole(request, {})
    test.deepEqual(response, updatedRole)
    test.ok(Sidecar.logRequest.calledWith(request))
    test.end()
  })

  handlerTest.end()
})
