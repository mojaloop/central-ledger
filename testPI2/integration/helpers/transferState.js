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
 * Valentin Genev <valentin.genev@modusbox.com>
 * Nikolay Anastasov <nikolay.anastasov@modusbox.com>
 --------------
 ******/
'use strict'

const Model = require('../../../src/domain/transfer/models/transferStates')

const testTransferStates = [
  {
    'transferStateId': 'TEST_RECEIVED',
    'enumeration': 'RECEIVED',
    'description': 'Next ledger has received the transfer.'
  },
  {
    'transferStateId': 'TEST_RESERVED',
    'enumeration': 'RESERVED',
    'description': 'Next ledger has reserved the transfer.'
  },
  {
    'transferStateId': 'TEST_COMMITTED',
    'enumeration': 'COMMITTED',
    'description': 'Next ledger has successfully performed the transfer.'
  },
  {
    'transferStateId': 'TEST_ABORTED',
    'enumeration': 'ABORTED',
    'description': 'Next ledger has aborted the transfer due a rejection or failure to perform the transfer.'
  },
  {
    'transferStateId': 'TEST_SETTLED',
    'enumeration': 'COMMITTED',
    'description': 'Ledger has settled the transfer'
  }
]

exports.prepareData = async () => {
  for (let state of testTransferStates) {
    await Model.saveTransferState(state)
  }
  return testTransferStates
}

exports.deletePreparedData = async () => {
  let result = []
  for (let state of testTransferStates) {
    result.push(await Model.destroyTransferStatesById(state.transferStateId))
  }
  return result
}
