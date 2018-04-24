'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const P = require('bluebird')
const Uuid = require('uuid4')
const Db = require('../../../../../src/db')
const RoleModel = require('../../../../../src/domain/security/models/role')

Test('Role model', modelTest => {
  let sandbox

  modelTest.beforeEach(test => {
    sandbox = Sinon.sandbox.create()

    Db.role = {
      insert: sandbox.stub(),
      update: sandbox.stub(),
      destroy: sandbox.stub(),
      find: sandbox.stub(),
      findOne: sandbox.stub(),
      query: sandbox.stub()
    }

    Db.userRole = {
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
    getAllTest.test('findAll role in db', test => {
      const role = [{ name: 'role1' }, { name: 'role2' }]

      Db.role.find.returns(P.resolve(role))

      RoleModel.getAll()
        .then(result => {
          test.deepEqual(result, role)
          test.ok(Db.role.find.calledWith({}))
          test.end()
        })
    })

    getAllTest.end()
  })

  modelTest.test('getById should', getByIdTest => {
    getByIdTest.test('find role by id in db', test => {
      const roleId = 1234
      const role = { name: 'role1' }

      Db.role.findOne.returns(P.resolve(role))

      RoleModel.getById(roleId)
        .then(result => {
          test.deepEqual(result, role)
          test.ok(Db.role.findOne.calledWith({ roleId }))
          test.end()
        })
    })

    getByIdTest.end()
  })

  modelTest.test('addPartyRole should', addPartyRoleTest => {
    addPartyRoleTest.test('insert userRole in db', test => {
      const userRole = { partyId: Uuid(), roleId: Uuid() }

      Db.userRole.insert.returns(P.resolve(userRole))

      RoleModel.addPartyRole(userRole)
        .then(result => {
          test.deepEqual(result, userRole)
          test.ok(Db.userRole.insert.calledWith(userRole))
          test.end()
        })
    })

    addPartyRoleTest.end()
  })

  modelTest.test('save should', saveTest => {
    saveTest.test('insert role in db if roleId not defined', test => {
      const role = { name: 'role1' }

      Db.role.insert.returns(P.resolve(role))

      RoleModel.save(role)
        .then(result => {
          test.deepEqual(result, role)
          test.ok(Db.role.insert.calledWith(sandbox.match({ name: role.name })))
          test.end()
        })
    })

    saveTest.test('update role in db if roleId defined', test => {
      const role = { name: 'role1', roleId: 'uuid' }

      Db.role.update.returns(P.resolve(role))

      RoleModel.save(role)
        .then(result => {
          test.ok(Db.role.update.calledWith({ roleId: role.roleId }, role))
          test.deepEqual(result, role)
          test.end()
        })
    })

    saveTest.end()
  })

  modelTest.test('remove should', removeTest => {
    removeTest.test('destroy role in db', test => {
      const roleId = Uuid()

      Db.role.destroy.returns(P.resolve(1))

      RoleModel.remove(roleId)
        .then(result => {
          test.equal(result, 1)
          test.ok(Db.role.destroy.calledWith({ roleId }))
          test.end()
        })
    })

    removeTest.end()
  })

  modelTest.test('removePartyRole should', removePartyRoleTest => {
    removePartyRoleTest.test('delete userRole by partyId in db', test => {
      const partyId = Uuid()

      Db.userRole.destroy.returns(P.resolve(1))

      RoleModel.removePartyRole(partyId)
        .then(result => {
          test.equal(result, 1)
          test.ok(Db.userRole.destroy.calledWith({ partyId }))
          test.end()
        })
    })
    removePartyRoleTest.end()
  })

  modelTest.test('getPartyRole should', getPartyRoleTest => {
    getPartyRoleTest.test('find role by partyId', test => {
      const partyId = Uuid()
      const role = [{}, {}]

      const builderStub = sandbox.stub()
      const whereStub = sandbox.stub()
      const selectStub = sandbox.stub()

      whereStub.returns({ select: selectStub })
      builderStub.innerJoin = sandbox.stub().returns({ where: whereStub })

      Db.role.query.callsArgWith(0, builderStub)
      Db.role.query.returns(P.resolve(role))

      RoleModel.getPartyRole(partyId)
        .then(results => {
          test.equal(results, role)
          test.ok(builderStub.innerJoin.calledWith('userRole as ur', 'role.roleId', 'ur.roleId'))
          test.ok(whereStub.calledWith('ur.partyId', partyId))
          test.ok(selectStub.calledWith('role.*'))
          test.end()
        })
    })

    getPartyRoleTest.end()
  })

  modelTest.end()
})
