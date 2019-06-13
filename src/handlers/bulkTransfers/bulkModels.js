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
