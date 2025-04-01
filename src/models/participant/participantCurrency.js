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
const rethrow = require('../../shared/rethrow')

exports.create = async (participantId, currencyId, ledgerAccountTypeId, isActive = true) => {
  try {
    return await Db.from('participantCurrency').insert({
      participantId,
      currencyId,
      ledgerAccountTypeId,
      isActive,
      createdBy: 'unknown'
    })
  } catch (err) {
    rethrow.rethrowDatabaseError(err)
  }
}

exports.getAll = async () => {
  try {
    return await Db.from('participantCurrency').find({}, { order: 'participantCurrencyId asc' })
  } catch (err) {
    rethrow.rethrowDatabaseError(err)
  }
}

exports.getById = async (id) => {
  try {
    return await Db.from('participantCurrency').findOne({ participantCurrencyId: id })
  } catch (err) {
    rethrow.rethrowDatabaseError(err)
  }
}

exports.update = async (participantCurrencyId, isActive) => {
  try {
    return await Db.from('participantCurrency').update({ participantCurrencyId }, { isActive })
  } catch (err) {
    rethrow.rethrowDatabaseError(err)
  }
}

exports.getByParticipantId = async (id, ledgerAccountTypeId = null) => {
  try {
    const params = { participantId: id }
    if (ledgerAccountTypeId) {
      params.ledgerAccountTypeId = ledgerAccountTypeId
    }
    return await Db.from('participantCurrency').find(params)
  } catch (err) {
    rethrow.rethrowDatabaseError(err)
  }
}

exports.destroyByParticipantId = async (id) => {
  try {
    return await Db.from('participantCurrency').destroy({ participantId: id })
  } catch (err) {
    rethrow.rethrowDatabaseError(err)
  }
}

exports.getByName = async (accountParams) => {
  try {
    const participantCurrency = await Db.from('participantCurrency').findOne(accountParams)
    return participantCurrency
  } catch (err) {
    rethrow.rethrowDatabaseError(err)
  }
}
