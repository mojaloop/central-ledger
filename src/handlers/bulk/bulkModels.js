const mongoose = require('mongoose')
const Crypto = require('crypto')
const encodePayload = require('@mojaloop/central-services-stream/src/kafka/protocol').encodePayload

// TODO needs to be put in shared lib
const createHash = (payload) => {
  const hashSha256 = Crypto.createHash('sha256')
  let hash = JSON.stringify(payload)
  hash = hashSha256.update(hash)
  hash = hashSha256.digest(hash).toString('base64').slice(0, -1) // removing the trailing '=' as per the specification
  return hash
}

// single transfer model

const transfer = {
  transferId: {
    type: String, required: true, unique: true, index: true
  },
  payerFsp: {
    type: String, required: true
  },
  payeeFsp: {
    type: String, required: true
  },
  amount: {
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
  expiration: {
    type: Date
  },
  extensionList: [{
    key: String,
    value: String
  }]
}

// schema for individual transfer with bulkQuoteId reference

const individualTransferSchema = new mongoose.Schema(Object.assign({}, { payload: transfer },
  { bulkDocument: { type: mongoose.Schema.Types.ObjectId, ref: 'bulktransfers' },
    bulkTransferId: { type: mongoose.Schema.Types.String },
    dataUri: { type: String, required: true },
    hash: { type: String, unique: true, index: true }
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
  individualTransfersIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'transfers' }],
  extensionList: [{
    key: String,
    value: String
  }],
  status: { type: String },
  hash: { type: String, unique: true, index: true }
})

// create document hash and if the hash is different, the validation doesn't work and the model is not created

bulkTransferSchema.pre('validate', async function () {
  this.hash = createHash(this)
})

individualTransferSchema.pre('validate', async function () {
  this.hash = createHash(this)
})

// TODO change document status post validation

// TODO add error handling to the pre and post middleware to send callback with errors for duplicates

const IndividualTransferModel = mongoose.model('transfers', individualTransferSchema)

// after the bulk object is created, before its save, single transfers are created and saved in the transfers collection with the bulk reference
// and the individualTransfersIds list is populated

bulkTransferSchema.pre('save', function () { // TODO must be PRE if possible to not miss a transfer while retrieving from central-ledger !!!
  try {
    this.individualTransfers.forEach(async transfer => {
      try {
        let individualTransfer = new IndividualTransferModel({ payload: transfer._doc })
        individualTransfer.bulkDocument = this._id
        individualTransfer.bulkTransferId = this.bulkTransferId
        this.individualTransfersIds.push(individualTransfer._id)
        individualTransfer.dataUri = encodePayload(JSON.stringify(transfer._doc), this.headers['content-type'])
        await individualTransfer.save()
      } catch (e) {
        throw e
      }
    })
  } catch (e) {
    throw (e)
  }
})

const BulkTransferModel = mongoose.model('bulktransfers', bulkTransferSchema)

module.exports = { BulkTransferModel, IndividualTransferModel }
