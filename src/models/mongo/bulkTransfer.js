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
'use strict'

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
      _id: false,
      key: String,
      value: String
    }]
  }
}
// schema for individual transfer with bulkTransfers reference
const individualTransferSchema = new mongoose.Schema(Object.assign({}, { payload: transfer },
  { _id_bulkTransfers: { type: mongoose.Schema.Types.ObjectId, ref: 'bulkTransfers' },
    messageId: { type: String, required: true },
    payload: { type: Object, required: true }
  }))
const IndividualTransferModel = mongoose.model('individualTransfers', individualTransferSchema, 'individualTransfers')

// schema for bulk transfers
const bulkTransferSchema = new mongoose.Schema({
  messageId: { type: String, required: true },
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
  extensionList: {
    extension: [{
      _id: false,
      key: String,
      value: String
    }]
  }
})
// after the bulk object is created, before its save, single transfers are
// created and saved in the transfers collection with the bulk reference
bulkTransferSchema.pre('save', function () {
  try {
    this.individualTransfers.forEach(async transfer => {
      try {
        let individualTransfer = new IndividualTransferModel({
          _id_bulkTransfers: this._id,
          messageId: this.messageId,
          payload: transfer._doc
        })
        await individualTransfer.save()
      } catch (e) {
        throw e
      }
    })
  } catch (e) {
    throw (e)
  }
})
const BulkTransferModel = mongoose.model('bulkTransfers', bulkTransferSchema, 'bulkTransfers')

// single transfer result model
const transferResult = {
  transferId: {
    type: String, required: true
  },
  fulfilment: {
    type: String
  },
  errorInformation: {
    errorCode: String,
    errorDescription: String
  },
  extensionList: {
    extension: [{
      _id: false,
      key: String,
      value: String
    }]
  }
}
// schema for individual transfer with bulkTransferResponses reference
const individualTransferResultSchema = new mongoose.Schema(Object.assign({}, { payload: transferResult },
  { _id_bulkTransferResponses: { type: mongoose.Schema.Types.ObjectId, ref: 'bulkTransferResponses' },
    messageId: { type: String, required: true },
    destination: { type: String, required: true },
    bulkTransferId: { type: String, required: true },
    payload: { type: Object, required: true }
  }))
individualTransferResultSchema.index({ messageId: 1, destination: 1 }, { unique: true })
const IndividualTransferResultModel = mongoose.model('individualTransferResults', individualTransferResultSchema, 'individualTransferResults')

// schema for bulk transfer responses
const bulkTransferResponseSchema = new mongoose.Schema({
  messageId: { type: String, required: true },
  destination: { type: String, required: true },
  headers: {
    type: Object, required: true
  },
  bulkTransferId: {
    type: String, required: true, index: true
  },
  bulkTransferState: {
    type: String, required: true
  },
  completedTimestamp: {
    type: Date
  },
  individualTransferResults: [new mongoose.Schema(Object.assign({
    _id: false
  }, transferResult))],
  extensionList: {
    extension: [{
      _id: false,
      key: String,
      value: String
    }]
  }
})
bulkTransferResponseSchema.index({ messageId: 1, destination: 1 }, { unique: true })
// after the bulk object is created, before its save, single responses are
// created and saved in the transfers collection with the bulk reference
bulkTransferResponseSchema.pre('save', function () {
  try {
    this.individualTransferResults.forEach(async transfer => {
      try {
        let individualTransferResult = new IndividualTransferResultModel({
          _id_bulkTransferResponses: this._id,
          messageId: this.messageId,
          destination: this.destination,
          bulkTransferId: this.bulkTransferId,
          payload: transfer._doc
        })
        await individualTransferResult.save()
      } catch (e) {
        throw e
      }
    })
  } catch (e) {
    throw (e)
  }
})
const BulkTransferResponseModel = mongoose.model('bulkTransferResponses', bulkTransferResponseSchema, 'bulkTransferResponses')

module.exports = {
  BulkTransferModel,
  BulkTransferResponseModel,
  IndividualTransferModel,
  IndividualTransferResultModel
}
