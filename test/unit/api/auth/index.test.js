'use strict'

const Test = require('tape')
const Sinon = require('sinon')
const Config = require('../../../../src/lib/config')
const AccountStrategy = require('../../../../src/api/auth/account')
const TokenStrategy = require('../../../../src/api/auth/token')

const AuthModule = require('../../../../src/api/auth')

Test('Auth module', authTest => {
  authTest.test('should be named "auth"', test => {
    test.equal(AuthModule.register.attributes.name, 'auth')
    test.end()
  })

  authTest.test('register should', registerTest => {
    registerTest.test('add AccountStrategy to server auth strategies', test => {
      const strategySpy = Sinon.spy()
      const server = {
        auth: {
          strategy: strategySpy
        }
      }
      const next = () => {
        test.ok(strategySpy.calledWith(AccountStrategy.name, AccountStrategy.scheme, Sinon.match({ validate: AccountStrategy.validate })))
        test.end()
      }

      AuthModule.register(server, {}, next)
    })

    registerTest.test('add TokenStrategy to server auth strategies', test => {
      const strategySpy = Sinon.spy()
      const server = {
        auth: {
          strategy: strategySpy
        }
      }

      const next = () => {
        test.ok(strategySpy.calledWith(TokenStrategy.name, TokenStrategy.scheme, Sinon.match({ validate: TokenStrategy.validate })))
        test.end()
      }

      AuthModule.register(server, {}, next)
    })

    registerTest.end()
  })

  authTest.test('strategy should', strategyTest => {
    strategyTest.test('return token if ENABLE_TOKEN_AUTH true', test => {
      Config.ENABLE_TOKEN_AUTH = true
      Config.ENABLE_BASIC_AUTH = false
      test.deepEqual(AuthModule.strategy(), { strategy: 'token', mode: 'required' })
      test.end()
    })

    strategyTest.test('return account if ENABLE_BASIC_AUTH true', test => {
      Config.ENABLE_TOKEN_AUTH = false
      Config.ENABLE_BASIC_AUTH = true
      test.deepEqual(AuthModule.strategy(), { strategy: 'account', mode: 'required' })
      test.end()
    })

    strategyTest.test('return account if ENABLE_TOKEN_AUTH and ENABLE_BASIC_AUTH true', test => {
      Config.ENABLE_TOKEN_AUTH = true
      Config.ENABLE_BASIC_AUTH = true
      test.deepEqual(AuthModule.strategy(), { strategy: 'token', mode: 'required' })
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
      test.deepEqual(AuthModule.strategy(true), { strategy: 'account', mode: 'try' })
      test.end()
    })

    strategyTest.end()
  })

  authTest.end()
})
