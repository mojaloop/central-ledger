'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const Permissions = require('../../../src/domain/security/permissions')
const Auth = require('../../../src/admin/auth')
const RouteConfig = require('../../../src/admin/route-config')

const tags = ['tag1', 'tag2']

Test('routeConfig', routeConfigTest => {
  let sandbox

  routeConfigTest.beforeEach(test => {
    sandbox = Sinon.sandbox.create()
    sandbox.stub(Auth)
    test.end()
  })

  routeConfigTest.afterEach(test => {
    sandbox.restore()
    test.end()
  })

  routeConfigTest.test('config should', configTest => {
    configTest.test('return empty config by default', test => {
      const result = RouteConfig.config()

      test.deepEqual(result, {})
      test.end()
    })

    configTest.test('populate tags', test => {
      const result = RouteConfig.config(tags)

      test.deepEqual(result, {tags})
      test.end()
    })

    configTest.test('set description', test => {
      const description = 'some description'
      const result = RouteConfig.config(tags, description)
      test.deepEqual(result, {tags, description})
      test.end()
    })

    configTest.test('use permission to set description', test => {
      const result = RouteConfig.config(tags, Permissions.ACCOUNTS_LIST)

      test.equal(result.description, Permissions.ACCOUNTS_LIST.description)
      test.end()
    })

    configTest.test('set auth from permission', test => {
      const permission = Permissions.ACCOUNTS_LIST
      const auth = {strategy: 'test', prop2: 'prop2'}
      Auth.tokenAuth.withArgs(permission).returns(auth)
      const result = RouteConfig.config(tags, permission)

      test.deepEqual(result.auth, auth)
      test.end()
    })

    configTest.test('set validation', async function (test) {
      const validation = {
        payload: {allow: 'application/json', failAction: 'error', output: 'data'},
        validate: {params: {id: 'test'}, payload: {id: 'test'}}
      }
      const validatedConfig = {
        description: 'description',
        payload: {allow: 'application/json', failAction: 'error', output: 'data'},
        tags: ['tag1', 'tag2'],
        validate: {params: {id: 'test'}, payload: {id: 'test'}}
      }
      const result = RouteConfig.config(tags, 'description', validation)

      test.deepEqual(result, validatedConfig)
      test.end()
    })

    configTest.end()
  })

  routeConfigTest.end()
})
