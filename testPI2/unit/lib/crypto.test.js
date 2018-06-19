'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const P = require('bluebird')
const Sodium = require('sodium')
const Argon2 = require('argon2')
const Base64Url = require('urlsafe-base64')
const Crypto = require('../../../src/lib/crypto')

Test('crypto', cryptoTest => {
  let sandbox
  let sodiumApi

  cryptoTest.beforeEach(test => {
    sandbox = Sinon.sandbox.create()
    sodiumApi = {
      randombytes_buf: sandbox.stub()
    }
    sandbox.stub(Argon2, 'hash')
    sandbox.stub(Argon2, 'verify')
    Sodium.api = sodiumApi
    test.end()
  })

  cryptoTest.afterEach(test => {
    sandbox.restore()
    test.end()
  })

  cryptoTest.test('generateKey should', keyTest => {
    keyTest.test('generate sodium random buffer with 74 bytes', test => {
      Crypto.generateKey()
        .then(key => {
          test.equal(key, Base64Url.encode(Buffer.alloc(74)))
          test.ok(sodiumApi.randombytes_buf.calledWith(Sinon.match.instanceOf(Buffer), 74))
          test.end()
        })
    })
    keyTest.end()
  })

  cryptoTest.test('generateSecret should', keyTest => {
    keyTest.test('generate sodium random buffer with 74 bytes', test => {
      Crypto.generateSecret()
        .then(key => {
          test.equal(key, Base64Url.encode(Buffer.alloc(74)))
          test.ok(sodiumApi.randombytes_buf.calledWith(Sinon.match.instanceOf(Buffer), 74))
          test.end()
        })
    })
    keyTest.end()
  })

  cryptoTest.test('generateToken should', keyTest => {
    keyTest.test('generate sodium random buffer with 74 bytes', test => {
      Crypto.generateToken()
        .then(key => {
          test.equal(key, Base64Url.encode(Buffer.alloc(74)))
          test.ok(sodiumApi.randombytes_buf.calledWith(Sinon.match.instanceOf(Buffer), 74))
          test.end()
        })
    })
    keyTest.end()
  })

  cryptoTest.test('hash should', hashTest => {
    hashTest.test('generate argon hash with 64 byte salt', test => {
      const password = Buffer.from('password')
      const hash = Buffer.from('hash')
      Argon2.hash.returns(P.resolve(hash))
      Crypto.hash(password)
        .then(result => {
          test.equal(result, hash)
          const hashArgs = Argon2.hash.firstCall.args
          test.equal(hashArgs[0], password)
          test.equal(hashArgs[1].length, 64)
          test.deepEqual(hashArgs[2], { timeCost: 3, memoryCost: 13, parallelism: 2, argon2d: false })
          test.ok(sodiumApi.randombytes_buf.calledWith(hashArgs[1], 64))
          test.end()
        })
    })
    hashTest.end()
  })

  cryptoTest.test('verify should', verifyTest => {
    verifyTest.test('verify argon hash', test => {
      const hash = 'hash'
      const password = 'password'
      Argon2.verify.returns(P.resolve(true))
      Crypto.verifyHash(hash, password)
        .then(result => {
          test.equal(result, true)
          test.ok(Argon2.verify.calledWith(hash, password))
          test.end()
        })
    })

    verifyTest.end()
  })

  cryptoTest.end()
})
