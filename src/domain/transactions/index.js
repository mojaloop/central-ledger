/*****
 License
 --------------
 Copyright © 2017 Bill & Melinda Gates Foundation
 The Mojaloop files are made available by the Bill & Melinda Gates Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at
 http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 Contributors
 --------------
 This is the official list of the Mojaloop project contributors for this file.
 Names of the original copyright holders (individuals or organizations)
 should be listed with a '*' in the first column. People who have
 contributed from an organization can be listed under the organization
 that actually holds the copyright for their contributions (see the
 Gates Foundation organization for an example). Those individuals should have
 their names indented and be marked with a '-'. Email address can be added
 optionally within square brackets <email>.
 * Gates Foundation
 - Name Surname <name.surname@gatesfoundation.com>

 * ModusBox
 - Lazola Lucas <lazola.lucas@modusbox.com>
 --------------
 ******/
'use strict'

const IlpPacket = require('../../models/ilpPackets/ilpPacket')
const ErrorHandler = require('@mojaloop/central-services-error-handling')

const ilpPacket = require('ilp-packet')
const base64url = require('base64url')

const getById = async (id) => {
  try {
    return await IlpPacket.getById(id)
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}
const decodeIlpPacket = async (inputIlpPacket) => {
  const binaryPacket = Buffer.from(inputIlpPacket, 'base64')
  return ilpPacket.deserializeIlpPayment(binaryPacket)
}
/**
 * Get the transaction object in the data field of an Ilp packet
 *
 * @returns {object} - Transaction Object
 */
const getTransactionObject = async function (inputIlpPacket) {
  try {
    const jsonPacket = await decodeIlpPacket(inputIlpPacket)
    const decodedData = base64url.decode(jsonPacket.data.toString())
    return JSON.parse(decodedData)
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}
module.exports = {
  getById,
  getTransactionObject
}
