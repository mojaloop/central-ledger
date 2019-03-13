'use strict'

const Crypto = require('crypto')
const base64url = require('base64url')

/**
 *
 *  Generate Fulfilment
 */

const l1pSecret = 'secret'
const l1pPacket = 'AQAAAAAAAABkC3ByaXZhdGUuYm9iggXcZXlKMGNtRnVjMkZqZEdsdmJrbGtJam9pWVRnek1qTmlZell0WXpJeU9DMDBaR1l5TFdGbE9ESXRaVFZoT1RrM1ltRm1PRGs1SWl3aWNYVnZkR1ZKWkNJNkltSTFNV1ZqTlRNMExXVmxORGd0TkRVM05TMWlObUU1TFdWaFpESTVOVFZpT0RBMk9TSXNJbkJoZVdWbElqcDdJbkJoY25SNVNXUkpibVp2SWpwN0luQmhjblI1U1dSVWVYQmxJam9pVFZOSlUwUk9JaXdpY0dGeWRIbEpaR1Z1ZEdsbWFXVnlJam9pTVRZeE16VTFOVEV5TVRJaUxDSndZWEowZVZOMVlrbGtUM0pVZVhCbElqb2lVRUZUVTFCUFVsUWlMQ0ptYzNCSlpDSTZJakV5TXpRaWZTd2liV1Z5WTJoaGJuUkRiR0Z6YzJsbWFXTmhkR2x2YmtOdlpHVWlPaUl4TWpNMElpd2libUZ0WlNJNklrcDFjM1JwYmlCVWNuVmtaV0YxSWl3aWNHVnljMjl1WVd4SmJtWnZJanA3SW1OdmJYQnNaWGhPWVcxbElqcDdJbVpwY25OMFRtRnRaU0k2SWtwMWMzUnBiaUlzSW0xcFpHUnNaVTVoYldVaU9pSlFhV1Z5Y21VaUxDSnNZWE4wVG1GdFpTSTZJbFJ5ZFdSbFlYVWlmU3dpWkdGMFpVOW1RbWx5ZEdnaU9pSXhPVGN4TFRFeUxUSTFJbjE5TENKd1lYbGxjaUk2ZXlKd1lYSjBlVWxrU1c1bWJ5STZleUp3WVhKMGVVbGtWSGx3WlNJNklrMVRTVk5FVGlJc0luQmhjblI1U1dSbGJuUnBabWxsY2lJNklqRTJNVE0xTlRVeE1qRXlJaXdpY0dGeWRIbFRkV0pKWkU5eVZIbHdaU0k2SWxCQlUxTlFUMUpVSWl3aVpuTndTV1FpT2lJeE1qTTBJbjBzSW0xbGNtTm9ZVzUwUTJ4aGMzTnBabWxqWVhScGIyNURiMlJsSWpvaU5UWTNPQ0lzSW01aGJXVWlPaUpOYVdOb1lXVnNJRXB2Y21SaGJpSXNJbkJsY25OdmJtRnNTVzVtYnlJNmV5SmpiMjF3YkdWNFRtRnRaU0k2ZXlKbWFYSnpkRTVoYldVaU9pSk5hV05vWVdWc0lpd2liV2xrWkd4bFRtRnRaU0k2SWtwbFptWnlaWGtpTENKc1lYTjBUbUZ0WlNJNklrcHZjbVJoYmlKOUxDSmtZWFJsVDJaQ2FYSjBhQ0k2SWpFNU5qTXRNREl0TVRjaWZYMHNJbUZ0YjNWdWRDSTZleUpqZFhKeVpXNWplU0k2SWxWVFJDSXNJbUZ0YjNWdWRDSTZJakV3TUNKOUxDSjBjbUZ1YzJGamRHbHZibFI1Y0dVaU9uc2ljMk5sYm1GeWFXOGlPaUpVVWtGT1UwWkZVaUlzSW5OMVlsTmpaVzVoY21sdklqb2liRzlqWVd4c2VTQmtaV1pwYm1Wa0lITjFZaTF6WTJWdVlYSnBieUlzSW1sdWFYUnBZWFJ2Y2lJNklsQkJXVVZGSWl3aWFXNXBkR2xoZEc5eVZIbHdaU0k2SWtOUFRsTlZUVVZTSWl3aWNtVm1kVzVrU1c1bWJ5STZleUp2Y21sbmFXNWhiRlJ5WVc1ellXTjBhVzl1U1dRaU9pSmlOVEZsWXpVek5DMWxaVFE0TFRRMU56VXRZalpoT1MxbFlXUXlPVFUxWWpnd05qa2lmU3dpWW1Gc1lXNWpaVTltVUdGNWJXVnVkSE1pT2lJeE1qTWlmU3dpYm05MFpTSTZJbE52YldVZ2JtOTBaUzRpTENKbGVIUmxibk5wYjI1TWFYTjBJanA3SW1WNGRHVnVjMmx2YmlJNlczc2lhMlY1SWpvaWEyVjVNU0lzSW5aaGJIVmxJam9pZG1Gc2RXVXhJbjBzZXlKclpYa2lPaUpyWlhreUlpd2lkbUZzZFdVaU9pSjJZV3gxWlRJaWZWMTlmUT09'

const caluclateFulfil = (base64EncodedPacket, rawSecret) => {
  let encodedSecret = Buffer.from(rawSecret).toString('base64')

  let hmacsignature = Crypto.createHmac('sha256', Buffer.from(encodedSecret, 'ascii'))
    .update(Buffer.from(base64EncodedPacket, 'ascii'))

  let generatedFulfilment = hmacsignature.digest('base64')

  console.log(`calculateFulfil:: generatedFulfilment=${generatedFulfilment} | length:${generatedFulfilment.length}`)

  return base64url.fromBase64(generatedFulfilment)
}

let l1pGeneratedFulfilment = caluclateFulfil(l1pPacket, l1pSecret)

let l1pProvidedFulfilment = 'fEGpcud1ZXZDCyTIkJjf4P5TEW80R0igI72nMAg9dE8'

console.log(`l1pGeneratedFulfilment = ${l1pGeneratedFulfilment}`)

console.log(`l1pProvidedFulfilment  = ${l1pProvidedFulfilment}`)

console.log(`Do they match? ${l1pGeneratedFulfilment === l1pProvidedFulfilment}`)

/**
 *
 *  Calculate Condition from Fulfilment (preimage)
 */

const calculateConditionFromFulfil = (fulfilment) => {
  // TODO: The following hashing code should be moved into a re-usable common-shared-service at a later point
  let hashSha256 = Crypto.createHash('sha256')
  let preimage = base64url.toBuffer(fulfilment)

  if (preimage.length !== 32) {
    throw new Error('Interledger preimages must be exactly 32 bytes.')
  }

  let calculatedConditionDigest = hashSha256.update(preimage).digest('base64')
  console.log(`calculatedConditionDigest=${calculatedConditionDigest}`)
  return base64url.fromBase64(calculatedConditionDigest)
}

let l1pProvidedCondition = 'mEw-mqZdYOnuzv4oOVbd9yCXZ5b6xcfO5lUvfpec1KY'

let l1pGeneratedCondition = calculateConditionFromFulfil(l1pGeneratedFulfilment)

console.log(`l1pGeneratedCondition = ${l1pGeneratedCondition}`)

console.log(`l1pProvidedCondition  = ${l1pProvidedCondition}`)

console.log(`Do they match? ${l1pGeneratedCondition === l1pProvidedCondition}`)

const validateFulfilCondition = (fulfilment, condition) => {
  // TODO: The following hashing code should be moved into a re-usable common-shared-service at a later point
  let calculatedCondition = calculateConditionFromFulfil(fulfilment)
  return calculatedCondition === condition
}

console.log(`How do they compare? ${validateFulfilCondition(l1pGeneratedFulfilment, l1pGeneratedCondition)}`)

// // // swagger example
let con = 'GRzLaTP7DJ9t4P-a_BA0WA9wzzlsugf00-Tn6kESAfM'
let ful = 'UNlJ98hZTY_dsw0cAqw4i_UN3v4utt7CZFB4yfLbVFA'

console.log(`How do they compare? ${validateFulfilCondition(ful, con)}`)
