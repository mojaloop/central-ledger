'use strict'

const Test = require('tape')
const Sinon = require('sinon')
const Config = require('../../../../src/lib/config')
const ParticipantStrategy = require('../../../../src/api/auth/participant')
const TokenStrategy = require('../../../../src/api/auth/token')

const AuthModule = require('../../../../src/api/auth')

Test('Auth module', authTest => {
  authTest.test('should be named "auth"', test => {
    test.equal(AuthModule.plugin.name, 'auth')
    test.end()
  })

  authTest.test('register should', registerTest => {
    registerTest.test('add ParticipantStrategy to server auth strategies', async function (test) {
      const strategySpy = Sinon.spy()
      const server = {
        auth: {
          strategy: strategySpy
        }
      }
      await AuthModule.plugin.register(server, {})
      test.ok(strategySpy.calledWith(ParticipantStrategy.scheme, 'basic', Sinon.match({ validate: ParticipantStrategy.validate })))
      test.end()
    })

    registerTest.test('add TokenStrategy to server auth strategies', async function (test) {
      const strategySpy = Sinon.spy()
      const server = {
        auth: {
          strategy: strategySpy
        }
      }

      AuthModule.plugin.register(server, {})
      test.ok(strategySpy.calledWith(TokenStrategy.scheme, TokenStrategy.name, Sinon.match({ validate: TokenStrategy.validate })))
      test.end()
    })

    registerTest.end()
  })

  authTest.test('strategy should', strategyTest => {
    strategyTest.test('return token if ENABLE_TOKEN_AUTH true', test => {
      Config.ENABLE_TOKEN_AUTH = true
      Config.ENABLE_BASIC_AUTH = false
      test.deepEqual(AuthModule.strategy(), { strategy: 'bearer-access-token', mode: 'required' })
      test.end()
    })

    strategyTest.test('return participant if ENABLE_BASIC_AUTH true', test => {
      Config.ENABLE_TOKEN_AUTH = false
      Config.ENABLE_BASIC_AUTH = true
      test.deepEqual(AuthModule.strategy(), { strategy: 'simple', mode: 'required' })
      test.end()
    })

    strategyTest.test('return participant if ENABLE_TOKEN_AUTH and ENABLE_BASIC_AUTH true', test => {
      Config.ENABLE_TOKEN_AUTH = true
      Config.ENABLE_BASIC_AUTH = true
      test.deepEqual(AuthModule.strategy(), { strategy: 'bearer-access-token', mode: 'required' })
      test.end()
    })

    strategyTest.test('return false if ENABLE_TOKEN_AUTH and ENABLE_BASIC_AUTH is false', test => {
      Config.ENABLE_TOKEN_AUTH = false
      Config.ENABLE_BASIC_AUTH = false
      test.equal(AuthModule.strategy(), false)
      test.end()
    })

    strategyTest.test('return try if optional', test => {
      Config.ENABLE_TOKEN_AUTH = false
      Config.ENABLE_BASIC_AUTH = true
      test.deepEqual(AuthModule.strategy(true), { strategy: 'simple', mode: 'try' })
      test.end()
    })

    strategyTest.end()
  })

  authTest.end()
})
