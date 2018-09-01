'use strict'

const Crypto = require('crypto')
const base64url = require('base64-url')
// const cc = require('five-bells-condition')

// const myFulfilment = new cc.PreimageSha256()
// const stringInputToEncode = 'hello world'
//
// myFulfilment.setPreimage(new Buffer(stringInputToEncode))
//
// // Calculate the condition
// const condition = myFulfilment.getConditionUri()
// console.log(`Condition: ${condition}`)
//
// // Calculate the fulfilment
// const fulfilment = myFulfilment.serializeUri()
// console.log(`fulfilment: ${fulfilment}`)
//
// // Calculate the condition from the fulfilmentcc.fu
// const conditionResult = cc.fulfillmentToCondition(fulfilment)
//
// // Print results and if the conditions match
// console.log(`Validate condition result = ${conditionResult} | match result = ${condition === conditionResult}`)

// const secret = '123456789'
// const ilpPacket = 'simple'

// Function to calculateConditionFromFulfil
const calculateConditionFromFulfil = (fulfilment) => {
  // TODO: The following hashing code should be moved into a re-usable common-shared-service at a later point
  var hashSha256 = Crypto.createHash('sha256')
  // var calculatedCondition = fulfilment // based on 6.5.1.2, the hash should be done on the decoded value as per the next line
  var calculatedCondition = base64url.decode(fulfilment)
  calculatedCondition = hashSha256.update(calculatedCondition)
  calculatedCondition = hashSha256.digest(calculatedCondition).toString('base64')
  calculatedCondition = base64url.escape(calculatedCondition)
  console.log(`calculatedCondition=${calculatedCondition}`)
  return calculatedCondition
}

// NOTE: This logic is based on v1.0 of the Mojaloop Specification as described in section 6.5.1.2
const validateFulfilCondition = (fulfilment, condition) => {
  // TODO: The following hashing code should be moved into a re-usable common-shared-service at a later point
  var calculatedCondition = calculateConditionFromFulfil(fulfilment)
  return calculatedCondition === condition
}

const secret = '123456789111'
const packet = 'simple11'

var hmacsignature = Crypto.createHmac('sha256', new Buffer(secret, 'base64'))
  .update(packet)
  .digest()
  .toString('base64')

console.log(`hmacsignature=${hmacsignature} | length:${hmacsignature.length}`)

var hashSha256 = Crypto.createHash('sha256')

var generatedFulfilFromSecret = hmacsignature

// generatedFulfilFromSecret = hashSha256.update(hmacsignature)
// // console.log(conditionHashedFulfil)
// generatedFulfilFromSecret = base64url.escape(hashSha256.digest(hmacsignature)
//   .toString('base64'))

generatedFulfilFromSecret = base64url.escape(hashSha256.update(hmacsignature).digest(hmacsignature)
  .toString('base64'))

console.log(`Generated Fulfil from Secret: ${generatedFulfilFromSecret} | length:${generatedFulfilFromSecret.length}`)

var generatedFulfilFromSecretCondition = calculateConditionFromFulfil(generatedFulfilFromSecret)

console.log(`Generated Condition from fulfil: ${generatedFulfilFromSecretCondition} | length:${generatedFulfilFromSecretCondition.length}`)
// console.log(`Compare generated fulfilment vs condition: ${validateFulfilCondition(generatedFulfilFromSecret,generatedFulfilFromSecretCondition)}`)

// const validateFulfilCondition = (fulfilment, condition) => {
//   // TODO: The following hashing code should be moved into a re-usable common-shared-service at a later point
//   const Crypto = require('crypto')
//   var hashSha256 = Crypto.createHash('sha256')
//   var calculatedCondition = fulfilment
//   calculatedCondition = hashSha256.update(calculatedCondition)
//   calculatedCondition = hashSha256.digest(calculatedCondition).toString('base64').slice(0, -1) // removing the trailing '=' as per the specification
//   console.log(`calculatedCondition=${calculatedCondition}`)
//   return calculatedCondition === condition
// }

console.log(`Compare generated fulfilment vs condition: ${validateFulfilCondition(generatedFulfilFromSecret, generatedFulfilFromSecretCondition)}`)

//
// const validateFulfilConditionv2 = (fulfilment, condition) => {
//   // TODO: The following hashing code should be moved into a re-usable common-shared-service at a later point
//   var hashSha256 = Crypto.createHash('sha256')
//   var calculatedCondition = base64url.decode(fulfilment)
//   calculatedCondition = hashSha256.update(calculatedCondition)
//   // calculatedCondition = hashSha256.digest(calculatedCondition).toString('base64').slice(0, -1) // removing the trailing '=' as per the specification
//   calculatedCondition = hashSha256.digest(calculatedCondition).toString('base64')
//   calculatedCondition = base64url.escape(calculatedCondition)
//   console.log(`calculatedCondition=${calculatedCondition}`)
//   return calculatedCondition === condition
// }
//
// // const base64url = require('base64-url')
// //
// // const validateFulfilConditionv2 = (fulfilment, condition) => {
// //   // TODO: The following hashing code should be moved into a re-usable common-shared-service at a later point
// //   // const fulfilDecoded = Buffer.from(`${fulfilment}=`, 'base64').toString('ascii')
// //   // const conditionDecoded = Buffer.from(`${condition}=`, 'base64').toString('ascii')
// //   // const Crypto = require('crypto')
// //   // var hashSha256 = Crypto.createHash('sha256')
// //   // var calculatedCondition = fulfilDecoded
// //   // calculatedCondition = hashSha256.update(calculatedCondition)
// //   // calculatedCondition = hashSha256.digest(calculatedCondition).toString('base64').slice(0, -1) // removing the trailing '=' as per the specification
// //   // console.log(`calculatedCondition=${calculatedCondition}`)
// //
// //   const fiveBellsConditionFormat = `ni:///sha-256;${condition}`
// //   const FiveBellsCondition = require('five-bells-condition')
// //   const calculatedCondition = FiveBellsCondition.fulfillmentToCondition(fiveBellsConditionFormat)
// //   return calculatedCondition === fiveBellsConditionFormat
// // }
//
// // let res = validateFulfilCondition('nYu2PGqfRDWnHbT649q0gc+7DcIq8iwcwHAQQa5T2HY', 'vJyJoxWiEbx+bYI8NWJ8GSETXEK2kxKaPVDex0OKv/U')
//
// // console.log(`validateFulfilCondition(Condition, conditionHashedFulfil)=${res}`)
//
let con
let ful
//
// // own test
// con = 'kiMJr_dTMV7Xif2m4qxo_opDJKgKFdJC-lm4nKHMiY8'
// con = 'otTwY9oJKLBrWmLI4h0FEw4ksdZtoAkX3qOVAygUlTI'
// ful = 'uU0nuZNNPgilLlLX2n2r-sSE7-N6U4DukIj3rOLvzek'
//
// // pre-decode hash test
// con = 'otTwY9oJKLBrWmLI4h0FEw4ksdZtoAkX3qOVAygUlTI'
// ful = 'uU0nuZNNPgilLlLX2n2r-sSE7-N6U4DukIj3rOLvzek'
//
// // integration tes
// // con = '47DEQpj8HBSa-_TImW-5JCeuQeRkm5NMpJWZG3hSuFU'
// // ful = 'oAKAAA'
//
// // swagger example
con = 'YlK5TZyhflbXaDRPtR5zhCu8FrbgvrQwwmzuH0iQ0AI'
ful = 'WLctttbu2HvTsa1XWvUoGRcQozHsqeu9Ahl2JW9Bsu8'
//
// console.log(`ful=${ful}`)
// console.log(`con=${con}`)
//
let res = validateFulfilCondition(ful, con)
// let res = validateFulfilConditionv2(ful, con)
//
console.log(`validateFulfilCondition(Condition, conditionHashedFulfil)=${res}`)
// //
// // res = validateFulfilConditionv2(con, ful)
// // console.log(`validateFulfilCondition(Condition, conditionHashedFulfil)=${res}`)
//

