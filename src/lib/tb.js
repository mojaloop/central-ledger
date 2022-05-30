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

 * Jason Bruwer <jason.bruwer@coil.com>

 --------------
 ******/
'use strict'

const ErrorHandler = require('@mojaloop/central-services-error-handling')
const Logger = require('@mojaloop/central-services-logger')
const TbNode = require('tigerbeetle-node')
const createClient = TbNode.createClient
const Config = require('../lib/config')
const util = require('util')
const crypto = require("crypto");

let tbCachedClient

let inFlight = [];
let lastWriteSecond = 0, lastWriteMinute = 0;

const secret = 'This is a secret 🤫'

const getTBClient = async () => {
  try {
    if (!Config.TIGERBEETLE.enabled) return null

    if (tbCachedClient == null) {
      Logger.info('TB-Client-Enabled. Connecting to R-01 '+ Config.TIGERBEETLE.replicaEndpoint01)
      Logger.info('TB-Client-Enabled. Connecting to R-02 '+Config.TIGERBEETLE.replicaEndpoint02)
      Logger.info('TB-Client-Enabled. Connecting to R-03 '+Config.TIGERBEETLE.replicaEndpoint03)

      tbCachedClient = await createClient({
        cluster_id: Config.TIGERBEETLE.cluster,
        replica_addresses:
          [
            Config.TIGERBEETLE.replicaEndpoint01,
            Config.TIGERBEETLE.replicaEndpoint02,
            Config.TIGERBEETLE.replicaEndpoint03
          ]
      })
    }
    return tbCachedClient;
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

const tbCreateAccount = async (id, accountType = 1, currencyTxt = 'USD') => {
  try {
    const client = await getTBClient()
    if (client == null) return {}

    //console.trace('Creating the account' + 'BOOM -> '+id +' - '+accountType+' - '+currencyTxt)

    const userData = BigInt(id)
    const currencyU16 = obtainUnitFromCurrency(currencyTxt)
    const tbId = tbIdFrom(userData, currencyU16, accountType)

    const account = {
      id: tbId, // u128 (137n)
      user_data: userData, // u128, opaque third-party identifier to link this account (many-to-one) to an external entity:
      reserved: Buffer.alloc(48, 0), // [48]u8
      unit: currencyU16,   // u16, unit of value
      code: accountType, // u16, a chart of accounts code describing the type of account (e.g. clearing, settlement)
      flags: 0,  // u32
      debits_reserved: 0n,  // u64
      debits_accepted: 0n,  // u64
      credits_reserved: 0n, // u64
      credits_accepted: 0n, // u64
      timestamp: 0n, // u64, Reserved: This will be set by the server.
    }
    const errors = await client.createAccounts([account])
    if (errors.length > 0) {
      Logger.error('CreateAccount-ERROR: '+enumLabelFromCode(TbNode.CreateAccountError, errors[0].code))

      for (let i = 0; i < errors.length; i++) {
        Logger.error('CreateAccErrors -> '+errors[i].code)
      }
      const fspiopError = ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.MODIFIED_REQUEST,
        'TB-Account entry failed for [' + id + ':' +
        enumLabelFromCode(TbNode.CreateAccountError, errors[0].code) + '] : '+ util.inspect(errors));
      throw fspiopError
    }
    return errors
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

const tbLookupAccount = async (id, accountType = 1, currencyTxt = 'USD') => {
  try {
    const client = await getTBClient()
    if (client == null) return {}

    const userData = BigInt(id)
    const currencyU16 = obtainUnitFromCurrency(currencyTxt)
    const tbId = tbIdFrom(userData, currencyU16, accountType)

    const accounts = await client.lookupAccounts([tbId])
    if (accounts.length > 0) return accounts[0]
    return {}
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

const tbLookupTransfer = async (id) => {
  try {
    const client = await getTBClient()
    if (client == null) return {}

    const tranId = uuidToBigInt(id)
    const transfers = await client.lookupTransfers([tranId])
    if (transfers.length > 0) return transfers[0]
    return {}
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

const tbTransfer = async (
  transferRecord,
  payerTransferParticipantRecord,
  payeeTransferParticipantRecord,
  participants,
  participantCurrencyIds
) => {
  try {
    const client = await getTBClient()
    if (client == null) return {}

    Logger.info('1.1 Creating Transfer    '+util.inspect(transferRecord))
    Logger.info('1.2 Creating Payer       '+util.inspect(payerTransferParticipantRecord))
    Logger.info('1.3 Creating Payee       '+util.inspect(payeeTransferParticipantRecord))
    Logger.info('1.4 Participants         '+util.inspect(participants))
    Logger.info('1.5 Participant Currency '+util.inspect(participantCurrencyIds))

    const tranId = uuidToBigInt(transferRecord.transferId)
    const accountTypeNumeric = payerTransferParticipantRecord.ledgerEntryTypeId
    const payer = obtainTBAccountFrom(payerTransferParticipantRecord, participants, accountTypeNumeric)
    const payee = obtainTBAccountFrom(payeeTransferParticipantRecord, participants, accountTypeNumeric)

    Logger.info('(tbTransfer) Making use of id '+
      uuidToBigInt(transferRecord.transferId) +' ['+ payer + ':::'+payee+']')

    const transfer = {
      id: tranId, // u128
      debit_account_id: payer,  // u128
      credit_account_id: payee, // u128
      user_data: tranId, //TODO u128, opaque third-party identifier to link this transfer (many-to-one) to an external entity
      reserved: Buffer.alloc(32, 0), // two-phase condition can go in here
      timeout: 0n, // u64, in nano-seconds.
      code: accountTypeNumeric,  // u32, a chart of accounts code describing the reason for the transfer (e.g. deposit, settlement)
      flags: 0, // u32
      amount: BigInt(transferRecord.amount), // u64
      timestamp: 0n, //u64, Reserved: This will be set by the server.
    }

    const errors = await client.createTransfers([transfer])
    if (errors.length > 0) {
      Logger.error('Transfer-ERROR: '+enumLabelFromCode(TbNode.CreateTransferError, errors[0].code))
      const fspiopError = ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.MODIFIED_REQUEST,
        'TB-Transfer entry failed for [' + tranId + ':' +
        enumLabelFromCode(TbNode.CreateTransferError, errors[0].code) + '] : '+ util.inspect(errors));
      throw fspiopError
    }
    return errors
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

const tbPrepareTransfer = async (
  transferRecord,
  payerTransferParticipantRecord,
  payeeTransferParticipantRecord,
  participants,
  participantCurrencyIds,
  timeoutSeconds = 30
) => {
  try {
    const client = await getTBClient()
    if (client == null) return {}

    //Logger.info('1.1 Creating Transfer    '+util.inspect(transferRecord))
    //Logger.info('1.2 Payer                '+util.inspect(payerTransferParticipantRecord))
    //Logger.info('1.3 Payee                '+util.inspect(payeeTransferParticipantRecord))
    //Logger.info('1.4 Participants         '+util.inspect(participants))
    //Logger.info('1.5 Participant Currency '+util.inspect(participantCurrencyIds))

    const tranId = uuidToBigInt(transferRecord.transferId)
    const accountTypeNumeric = payerTransferParticipantRecord.ledgerEntryTypeId
    const payer = obtainTBAccountFrom(payerTransferParticipantRecord, participants, accountTypeNumeric)
    const payee = obtainTBAccountFrom(payeeTransferParticipantRecord, participants, accountTypeNumeric)

    let flags = 0
    flags |= TbNode.TransferFlags.two_phase_commit

    const timeoutNanoseconds = BigInt(timeoutSeconds * 1000000000)

    const transfer = {
      id: tranId, // u128
      debit_account_id: payer,  // u128
      credit_account_id: payee, // u128
      user_data: tranId, // u128, opaque third-party identifier to link this transfer (many-to-one) to an external entity
      reserved: Buffer.alloc(32, 0), // two-phase condition can go in here
      timeout: timeoutNanoseconds, // u64, in nano-seconds.
      code: accountTypeNumeric,  // u32, a chart of accounts code describing the reason for the transfer (e.g. deposit, settlement)
      flags: flags, // u32
      amount: BigInt(transferRecord.amount), // u64
      timestamp: 0n, //u64, Reserved: This will be set by the server.
    }

    var errors = []
    if (Config.TIGERBEETLE.enableBatching) {
      inFlight.push(transfer)

      if (inFlight.length > Config.TIGERBEETLE.batchMaxSize) {
        errors = await client.createTransfers(inFlight)
        inFlight = []
      }
    } else {
      errors = await client.createTransfers([transfer])
    }

    if (errors.length > 0) {
      let nonExistErr = true
      for (let i = 0; i < errors.length; i++) {
        if (errors[i].code != 2) {
          nonExistErr = false
          break
        }
      }
      if (nonExistErr) return []//Already exists...

      Logger.error('PrepareTransfer-ERROR: '+enumLabelFromCode(TbNode.CreateTransferError, errors[0].code))

      const fspiopError = ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.MODIFIED_REQUEST,
        'TB-PrepareTransfer entry failed for [' + tranId + ':' +
        enumLabelFromCode(TbNode.CreateTransferError, errors[0].code) + '] : '+ util.inspect(errors));
      throw fspiopError
    }
    return errors
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

const tbFulfilTransfer = async (
  transferFulfilmentRecord,
  ledgerEntryTypeId = 1,
) => {
  try {
    const client = await getTBClient()
    if (client == null) return {}

    const commit = {
      id: uuidToBigInt(transferFulfilmentRecord.transferId), // u128
      code: ledgerEntryTypeId,
      flags: 0, // defaults to accept
      reserved: Buffer.alloc(32, 0),
      timestamp: 0n, // this will be set correctly by the TigerBeetle server
    }

    const errors = await client.commitTransfers([commit])
    if (errors.length > 0) {
      Logger.error('FulfilTransfer-ERROR: '+enumLabelFromCode(TbNode.CommitTransferError, errors[0].code))

      const fspiopError = ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.MODIFIED_REQUEST,
        'TB-TransferFulfil entry failed for [' + tranId + ':' +
        enumLabelFromCode(TbNode.CreateTransferError, errors[0].code) + '] : '+ util.inspect(errors));
      throw fspiopError
    }
    return errors
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

const tbDestroy = async () => {
  try {
    const client = await getTBClient()
    if (client == null) return {}
    Logger.info('Destroying TB client')
    client.destroy()
    tbCachedClient = undefined
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

const obtainTBAccountFrom = (
  account,
  participants,
  accountTypeNumeric
) => {
  const partCurrencyId = account.participantCurrencyId;
  for (let i = 0; i < participants.length; i++) {
    const itemAtIndex = participants[i]
    if (itemAtIndex.participantCurrencyId == partCurrencyId) {
      return tbIdFrom(
        itemAtIndex.participantId,
        obtainUnitFromCurrency(itemAtIndex.currencyId),
        accountTypeNumeric
      )
    }
  }

  const fspiopError = ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.MODIFIED_REQUEST,
    'TB-Participant-NotFound '+partCurrencyId+ ' : '+ util.inspect(account) + ' : ' + util.inspect(participants));
  throw fspiopError
}

const obtainUnitFromCurrency = (currencyTxt) => {
  switch (currencyTxt) {
    case 'KES' : return 404;
    case 'ZAR' : return 710;
    default : return 840;//USD
  }
}

const tbIdFrom = (userData, currencyTxt, accountTypeNumeric) => {
  const combined = ''+userData+'-'+currencyTxt+'-'+accountTypeNumeric
  Logger.info('-------------__>   '+ combined)
  //TODO @jason Replace md5 with SHA-256
  //TODO @jason, perhaps replace the hashing completely...

  const md5Hasher = crypto.createHmac('md5', secret)
  const hash = md5Hasher.update(combined).digest('hex')
  return BigInt("0x"+hash)
}

const uuidToBigInt = (uuid) => {
  //const buffer = Buffer.from(uuidNoDashes, 'hex')
  //Logger.info('UUID-Buff-1: ' + BigInt("0x"+uuid.replace(/-/g, '')))
  //Logger.info('UUID-Buff-2: ' + buffer.readBigInt64BE())
  //Logger.info('UUID-Buff: ' + BigInt(buffer))

  //const uuidBin = hex2bin(uuidNoDashes)
  //Logger.info('UUID: '+uuidBin)
  return BigInt("0x" + uuid.replace(/-/g, ''))
}

const enumLabelFromCode = (resultEnum, errCode) => {
  const errorEnum = Object.keys(resultEnum)
  return errorEnum[errCode + ((errorEnum.length / 2) - 1)]
}


module.exports = {
  tbCreateAccount,
  tbTransfer,
  tbPrepareTransfer, //TODO @jason: Need to add the rollback functions here...
  tbFulfilTransfer,
  tbLookupAccount,
  tbLookupTransfer,
  tbDestroy
}
