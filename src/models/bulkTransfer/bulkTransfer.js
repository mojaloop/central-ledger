/*****
 License
 --------------
 Copyright © 2020-2024 Mojaloop Foundation
 The Mojaloop files are made available by the Mojaloop Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

 Contributors
 --------------
 This is the official list of the Mojaloop project contributors for this file.
 Names of the original copyright holders (individuals or organizations)
 should be listed with a '*' in the first column. People who have
 contributed from an organization can be listed under the organization
 that actually holds the copyright for their contributions (see the
 Mojaloop Foundation for an example). Those individuals should have
 their names indented and be marked with a '-'. Email address can be added
 optionally within square brackets <email>.
 * Mojaloop Foundation
 - Name Surname <name.surname@mojaloop.io>

 * Georgi Georgiev <georgi.georgiev@modusbox.com>
 --------------
 ******/
'use strict'

const Db = require('../../lib/db')
const { rethrow } = require('@mojaloop/central-services-shared').Util

const getById = async (id) => {
  try {
    return await Db.from('bulkTransfer').query(async (builder) => {
      const result = builder
        .innerJoin('participant AS payer', 'payer.participantId', 'bulkTransfer.payerParticipantId')
        .innerJoin('participant AS payee', 'payee.participantId', 'bulkTransfer.payeeParticipantId')
        .innerJoin('bulkTransferStateChange AS btsc', 'btsc.bulkTransferId', 'bulkTransfer.bulkTransferId')
        .leftJoin('bulkTransferFulfilment AS btf', 'btf.bulkTransferId', 'bulkTransfer.bulkTransferId')
        .leftJoin('bulkTransferState AS bts', 'bts.bulkTransferStateId', 'btsc.bulkTransferStateId')
        .where({ 'bulkTransfer.bulkTransferId': id })
        .orderBy('btsc.bulkTransferStateChangeId', 'desc')
        .select(
          'bulkTransfer.bulkTransferId',
          'btsc.bulkTransferStateId',
          'btf.completedDate AS completedTimestamp',
          'bts.enumeration AS bulkTransferStateEnumeration',
          'payer.name AS payerFsp',
          'payee.name AS payeeFsp',
          'bulkTransfer.bulkQuoteId',
          'bulkTransfer.expirationDate'
        ).first()
      return result
    })
  } catch (err) {
    rethrow.rethrowDatabaseError(err)
  }
}

const getByTransferId = async (id) => {
  try {
    return await Db.from('bulkTransfer').query(async (builder) => {
      const result = builder
        .innerJoin('bulkTransferAssociation AS bta', 'bta.bulkTransferId', 'bulkTransfer.bulkTransferId')
        .innerJoin('participant AS payer', 'payer.participantId', 'bulkTransfer.payerParticipantId')
        .innerJoin('participant AS payee', 'payee.participantId', 'bulkTransfer.payeeParticipantId')
        .innerJoin('bulkTransferStateChange AS btsc', 'btsc.bulkTransferId', 'bulkTransfer.bulkTransferId')
        .leftJoin('bulkTransferState AS bts', 'bts.bulkTransferStateId', 'btsc.bulkTransferStateId')
        .leftJoin('bulkTransferFulfilment AS btf', 'btf.bulkTransferId', 'bulkTransfer.bulkTransferId')
        .where({ 'bta.transferId': id })
        .orderBy('btsc.bulkTransferStateChangeId', 'desc')
        .select(
          'bulkTransfer.bulkTransferId',
          'btsc.bulkTransferStateId',
          'btf.completedDate AS completedTimestamp',
          'bts.enumeration AS bulkTransferStateEnumeration',
          'payer.name AS payerFsp',
          'payee.name AS payeeFsp',
          'bulkTransfer.bulkQuoteId'
        ).first()
      return result
    })
  } catch (err) {
    rethrow.rethrowDatabaseError(err)
  }
}

const getParticipantsById = async (id) => {
  try {
    return await Db.from('bulkTransfer').query(async (builder) => {
      const result = builder
        .innerJoin('participant AS payer', 'payer.participantId', 'bulkTransfer.payerParticipantId')
        .innerJoin('participant AS payee', 'payee.participantId', 'bulkTransfer.payeeParticipantId')
        .where({ 'bulkTransfer.bulkTransferId': id })
        .select('payer.name AS payerFsp', 'payee.name AS payeeFsp')
        .first()
      return result
    })
  } catch (err) {
    rethrow.rethrowDatabaseError(err)
  }
}

module.exports = {
  getById,
  getByTransferId,
  getParticipantsById
}
