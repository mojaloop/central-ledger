'use strict'

const Sodium = require('sodium')
const Argon2 = require('argon2')
const Base64Url = require('urlsafe-base64')
const P = require('bluebird')
const defaultSaltLength = 64
const defaultKeyLength = 74
const defaultSecretLength = 74
const defaultTokenLength = 74

const argonOptions = {
  timeCost: 3,
  memoryCost: 13,
  parallelism: 2,
  argon2d: false
}

const generateBuffer = (size) => {
  return new P((resolve) => {
    const buffer = Buffer.alloc(size)
    Sodium.api.randombytes_buf(buffer, size)
    resolve(buffer)
  })
}

const generateString = (size) => {
  return generateBuffer(size).then(buffer => Base64Url.encode(buffer))
}

const hash = (buffer) => {
  return generateBuffer(defaultSaltLength)
    .then(salt => Argon2.hash(buffer, salt, argonOptions))
}

const verifyHash = (hash, password) => {
  return Argon2.verify(hash, password)
}

module.exports = {
  generateKey: () => generateString(defaultKeyLength),
  generateSecret: () => generateString(defaultSecretLength),
  generateToken: () => generateString(defaultTokenLength),
  hash,
  verifyHash
}
