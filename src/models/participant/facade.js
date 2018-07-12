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

 * Georgi Georgiev <georgi.georgiev@modusbox.com>
 --------------
 ******/

'use strict'

const Db = require('../../db')

const getByNameAndCurrency = async (name, currencyId) => {
  try {
    return await Db.participant.query(async (builder) => {
      var result = builder
        .where({'participant.name': name})
        .andWhere({'participant.isActive': true})
        .andWhere({'pc.currencyId': currencyId})
        .andWhere({'pc.isActive': true})
        .innerJoin('participantCurrency AS pc', 'pc.participantId', 'participant.participantId')
        .select(
          'participant.*',
          'pc.participantCurrencyId'
        )
        .first()
      return result
    })
  } catch (e) {
    throw e
  }
}

const getEndpoint = async (participant, endpointType) => {
  try {
    return await Db.participantEndpoint.query(builder => {
      return builder.innerJoin('endpointType AS et', 'participantEndpoint.endpointTypeId', 'et.endpointTypeId')
        .andWhere('participantEndpoint.participantId', participant.participantId)
        .andWhere('participantEndpoint.isActive', 1)
        .andWhere('et.name', endpointType).select('participantEndpoint.participantEndpointId',
          'participantEndpoint.participantId',
          'participantEndpoint.endpointTypeId',
          'participantEndpoint.value',
          'participantEndpoint.isActive',
          'participantEndpoint.createdDate',
          'participantEndpoint.createdBy',
          'et.name')
    })
  } catch (err) {
    throw new Error(err.message)
  }
}

const getAllEndpoints = async (participant) => {
  try {
    return await Db.participantEndpoint.query(builder => {
      return builder.innerJoin('endpointType AS et', 'participantEndpoint.endpointTypeId', 'et.endpointTypeId')
        .andWhere('participantEndpoint.participantId', participant.participantId)
        .andWhere('participantEndpoint.isActive', 1).select('participantEndpoint.participantEndpointId',
          'participantEndpoint.participantId',
          'participantEndpoint.endpointTypeId',
          'participantEndpoint.value',
          'participantEndpoint.isActive',
          'participantEndpoint.createdDate',
          'participantEndpoint.createdBy',
          'et.name')
    })
  } catch (err) {
    throw new Error(err.message)
  }
}

const addEndpoint = async (participant, endpoint) => {
  try {
    const knex = Db.getKnex()
    return knex.transaction(async function (trx) {
      let endpointType = await trx.first('endpointTypeId').from('endpointType').where('name', endpoint.type).andWhere('isActive', 1)
      return knex('participantEndpoint').transacting(trx).forUpdate().select('*')
        .where('participantId', participant.participantId)
        .andWhere('endpointTypeId', endpointType.endpointTypeId)
        .andWhere('isActive', 1)
        .then(function (existingEndpoint) {
          if (existingEndpoint) {
            return knex('participantEndpoint').transacting(trx).update({isActive: 0}).where('participantEndpointId', existingEndpoint[0].participantEndpointId)
          }
        }).then(() => {
          let newEndpoint = {
            participantId: participant.participantId,
            endpointTypeId: endpointType.endpointTypeId,
            value: endpoint.value,
            isActive: 1,
            createdBy: 'unknown'
          }
          return knex('participantEndpoint').transacting(trx).insert(newEndpoint)
        }).then(trx.commit)
        .catch(trx.rollback)
    })
  } catch (err) {
    throw new Error(err.message)
  }
}

module.exports = {
  getByNameAndCurrency,
  getEndpoint,
  getAllEndpoints,
  addEndpoint
}
