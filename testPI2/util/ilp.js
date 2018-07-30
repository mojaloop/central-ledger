'use strict'

const cc = require('five-bells-condition')

const myFulfilment = new cc.PreimageSha256()
const stringInputToEncode = 'hello world'

myFulfilment.setPreimage(new Buffer(stringInputToEncode))

// Calculate the condition
const condition = myFulfilment.getConditionUri()
console.log(`Condition: ${condition}`)

// Calculate the fulfilment
const fulfilment = myFulfilment.serializeUri()
console.log(`fulfilment: ${fulfilment}`)

// Calculate the condition from the fulfilment
const conditionResult = cc.fulfilmentToCondition(fulfilment)

// Print results and if the conditions match
console.log(`Validate condition result = ${conditionResult} | match result = ${condition === conditionResult}`)

const crypto = require('crypto')
const secret = '123456789'
const ilpPacket = 'simple'

var hmacsignature = crypto.createHmac('sha256', new Buffer(secret, 'base64'))
  .update(ilpPacket)
  .digest()
  .toString('base64')

console.log(`hmacsignature=${hmacsignature} | length:${hmacsignature.length}`)

var hashSha256 = crypto.createHash('sha256')

var conditionHashedFulfil = hmacsignature

conditionHashedFulfil = hashSha256.update(hmacsignature)
console.log(conditionHashedFulfil)
conditionHashedFulfil = hashSha256.digest(hmacsignature)
  .toString('base64')
console.log(`code ${conditionHashedFulfil} | length:${conditionHashedFulfil.length}`)
