'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const P = require('bluebird')
const Uuid = require('uuid4')
const Db = require('../../../../../src/db')
const RolesModel = require('../../../../../src/domain/security/models/roles')

Test('Roles model', modelTest => {
  let sandbox

  modelTest.beforeEach(test => {
    sandbox = Sinon.sandbox.create()

    Db.roles = {
      insert: sandbox.stub(),
      update: sandbox.stub(),
      destroy: sandbox.stub(),
      find: sandbox.stub(),
      findOne: sandbox.stub(),
      query: sandbox.stub()
    }

    Db.userRoles = {
      insert: sandbox.stub(),
      destroy: sandbox.stub()
    }

    test.end()
  })

  modelTest.afterEach(test => {
    sandbox.restore()
    test.end()
  })

  modelTest.test('getAll should', getAllTest => {
    getAllTest.test('findAll roles in db', test => {
      const roles = [{ name: 'role1' }, { name: 'role2' }]

      Db.roles.find.returns(P.resolve(roles))

      RolesModel.getAll()
        .then(result => {
          test.deepEqual(result, roles)
          test.ok(Db.roles.find.calledWith({}))
          test.end()
        })
    })

    getAllTest.end()
  })

  modelTest.test('getById should', getByIdTest => {
    getByIdTest.test('find role by id in db', test => {
      const roleId = 1234
      const role = { name: 'role1' }

      Db.roles.findOne.returns(P.resolve(role))

      RolesModel.getById(roleId)
        .then(result => {
          test.deepEqual(result, role)
          test.ok(Db.roles.findOne.calledWith({ roleId }))
          test.end()
        })
    })

    getByIdTest.end()
  })

  modelTest.test('addPartyRole should', addPartyRoleTest => {
    addPartyRoleTest.test('insert userRole in db', test => {
      const userRole = { partyId: Uuid(), roleId: Uuid() }

      Db.userRoles.insert.returns(P.resolve(userRole))

      RolesModel.addPartyRole(userRole)
        .then(result => {
          test.deepEqual(result, userRole)
          test.ok(Db.userRoles.insert.calledWith(userRole))
          test.end()
        })
    })

    addPartyRoleTest.end()
  })

  modelTest.test('save should', saveTest => {
    saveTest.test('insert role in db if roleId not defined', test => {
      const role = { name: 'role1' }

      Db.roles.insert.returns(P.resolve(role))

      RolesModel.save(role)
        .then(result => {
          test.deepEqual(result, role)
          test.ok(Db.roles.insert.calledWith(sandbox.match({ name: role.name })))
          test.end()
        })
    })

    saveTest.test('update role in db if roleId defined', test => {
      const role = { name: 'role1', roleId: 'uuid' }

      Db.roles.update.returns(P.resolve(role))

      RolesModel.save(role)
        .then(result => {
          test.ok(Db.roles.update.calledWith({ roleId: role.roleId }, role))
          test.deepEqual(result, role)
          test.end()
        })
    })

    saveTest.end()
  })

  modelTest.test('remove should', removeTest => {
    removeTest.test('destroy role in db', test => {
      const roleId = Uuid()

      Db.roles.destroy.returns(P.resolve(1))

      RolesModel.remove(roleId)
        .then(result => {
          test.equal(result, 1)
          test.ok(Db.roles.destroy.calledWith({ roleId }))
          test.end()
        })
    })

    removeTest.end()
  })

  modelTest.test('removePartyRoles should', removePartyRolesTest => {
    removePartyRolesTest.test('delete userRoles by partyId in db', test => {
      const partyId = Uuid()

      Db.userRoles.destroy.returns(P.resolve(1))

      RolesModel.removePartyRoles(partyId)
        .then(result => {
          test.equal(result, 1)
          test.ok(Db.userRoles.destroy.calledWith({ partyId }))
          test.end()
        })
    })
    removePartyRolesTest.end()
  })

  modelTest.test('getPartyRoles should', getPartyRolesTest => {
    getPartyRolesTest.test('find roles by partyId', test => {
      const partyId = Uuid()
      const roles = [{}, {}]

      const builderStub = sandbox.stub()
      const whereStub = sandbox.stub()
      const selectStub = sandbox.stub()

      whereStub.returns({ select: selectStub })
      builderStub.innerJoin = sandbox.stub().returns({ where: whereStub })

      Db.roles.query.callsArgWith(0, builderStub)
      Db.roles.query.returns(P.resolve(roles))

      RolesModel.getPartyRoles(partyId)
        .then(results => {
          test.equal(results, roles)
          test.ok(builderStub.innerJoin.calledWith('userRoles as ur', 'roles.roleId', 'ur.roleId'))
          test.ok(whereStub.calledWith('ur.partyId', partyId))
          test.ok(selectStub.calledWith('roles.*'))
          test.end()
        })
    })

    getPartyRolesTest.end()
  })

  modelTest.end()
})
