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
 * Valentin Genev <valentin.genev@modusbox.com>
 --------------
 ******/
const mongoose = require('mongoose')

// single transfer model
const transfer = {
  transferId: {
    type: String, required: true, unique: true, index: true
  },
  transferAmount: {
    currency: {
      type: String,
      required: true
    },
    amount: {
      type: Number,
      required: true
    }
  },
  ilpPacket: {
    type: String,
    required: true
  },
  condition: {
    type: String,
    required: true
  },
  extensionList: {
    extension: [{
      key: String,
      value: String
    }]
  }
}

// schema for individual transfer with bulkQuoteId reference
const individualTransferSchema = new mongoose.Schema(Object.assign({}, { payload: transfer },
  { bulkDocument: { type: mongoose.Schema.Types.ObjectId, ref: 'bulktransfers' },
    bulkTransferId: { type: mongoose.Schema.Types.String },
    payload: { type: Object, required: true }
  }))

// schema for bulkquotes
const bulkTransferSchema = new mongoose.Schema({
  headers: {
    type: Object, required: true
  },
  bulkQuoteId: {
    type: String, required: true, unique: true
  },
  bulkTransferId: {
    type: String, required: true, index: true, unique: true
  },
  payerFsp: {
    type: String, required: true
  },
  payeeFsp: {
    type: String, required: true
  },
  expiration: {
    type: Date
  },
  individualTransfers: [new mongoose.Schema(Object.assign({
    _id: false
  }, transfer))],
  extensionList: [{
    key: String,
    value: String
  }]
})

const IndividualTransferModel = mongoose.model('transfers', individualTransferSchema)
const BulkTransferModel = mongoose.model('bulktransfers', bulkTransferSchema)

module.exports = { BulkTransferModel, IndividualTransferModel }
