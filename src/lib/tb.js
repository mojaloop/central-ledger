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
const uuidv4Gen = require('uuid4')
const net = require('net')
const dns = require('dns')

let tbCachedClient

let inFlight = []

const currencyMapping = [
  { currency: 'ZAR', code: 710 },
  { currency: 'KES', code: 404 },
  { currency: 'USD', code: 840 },
  { currency: 'EUR', code: 978 },
  { currency: 'GBP', code: 826 }
]

const getTBClient = async () => {
  try {
    if (!Config.TIGERBEETLE.enabled) {
      console.info('TB-Client-Disabled')
      return null
    }

    console.log('TB-Client-Enabled')

    if (tbCachedClient == null) {
      Logger.info('TB-Client-Enabled. Connecting to R-01 ' + Config.TIGERBEETLE.replicaEndpoint01)
      Logger.info('TB-Client-Enabled. Connecting to R-02 ' + Config.TIGERBEETLE.replicaEndpoint02)
      Logger.info('TB-Client-Enabled. Connecting to R-03 ' + Config.TIGERBEETLE.replicaEndpoint03)

      const addresses = []
      if (Config.TIGERBEETLE.replicaEndpoint01 !== undefined && Config.TIGERBEETLE.replicaEndpoint01.length > 0) {
        addresses.push(Config.TIGERBEETLE.replicaEndpoint01)
      }
      if (Config.TIGERBEETLE.replicaEndpoint02 !== undefined && Config.TIGERBEETLE.replicaEndpoint02.length > 0) {
        addresses.push(Config.TIGERBEETLE.replicaEndpoint02)
      }
      if (Config.TIGERBEETLE.replicaEndpoint03 !== undefined && Config.TIGERBEETLE.replicaEndpoint03.length > 0) {
        addresses.push(Config.TIGERBEETLE.replicaEndpoint03)
      }
      if (addresses.length === 0) return null

      const mappedAddresses = await _parseAndLookupReplicaAddresses(addresses)
      console.info('mappedAddresses:')
      console.info(mappedAddresses)
      tbCachedClient = await createClient({
        cluster_id: Config.TIGERBEETLE.cluster,
        replica_addresses: mappedAddresses
      })
    }
    return tbCachedClient
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

// check if addresses are IPs or names, resolve if names
const _parseAndLookupReplicaAddresses = async (addressesToParse) => {
  console.table(addressesToParse)

  const replicaIpAddresses = []
  for (const addr of addressesToParse) {
    Logger.info(`Parsing addr: ${addr}`)
    const parts = addr.split(':')
    if (!parts) {
      const err = new Error(`Cannot parse replicaAddresses in TigerBeetleAdapter.init() - value: "${addr}"`)
      Logger.error(err.message)
      throw err
    }
    Logger.info(`\t addr parts are: ${parts[0]} and ${parts[1]}`)

    if (net.isIP(parts[0]) === 0) {
      Logger.debug('\t addr part[0] is not an IP address, looking it up..')
      await dns.promises.lookup(parts[0], { family: 4 }).then((resp) => {
        Logger.debug(`\t lookup result is: ${resp.address}`)
        replicaIpAddresses.push(`${resp.address}:${parts[1]}`)
      }).catch((error) => {
        const err = new Error(`Lookup error while parsing replicaAddresses in TigerBeetleAdapter.init() - cannot resolve: "${addr[0]}" of "${addr}": ${error}`)
        Logger.error(err.message)
        throw err
      })
    } else {
      Logger.debug('\t lookup not necessary, adding addr directly')
      replicaIpAddresses.push(addr)
    }
  }
  console.table(replicaIpAddresses)
  return replicaIpAddresses
}

const tbCreateAccount = async (participantId, participantCurrencyId, accountType = 1, currencyTxt = 'USD') => {
  try {
    const client = await getTBClient()
    if (client == null) return {}

    console.info('JASON::: 0->> Creating Account    ' + participantId + ':' + participantCurrencyId)

    const userData = BigInt(participantId)
    const currencyU16 = obtainLedgerFromCurrency(currencyTxt)
    const tbId = tbIdFrom(participantCurrencyId)

    console.info(`JASON::: 1.2 Creating Account ${util.inspect(currencyU16)} - ${tbId}   `)

    const account = {
      id: tbId, // u128 (137n)
      user_data: userData, // u128, opaque third-party identifier to link this account (many-to-one) to an external entity:
      reserved: Buffer.alloc(48, 0), // [48]u8
      ledger: currencyU16, // u32, currency
      code: accountType, // u16, a chart of accounts code describing the type of account (e.g. clearing, settlement)
      flags: 0, // u32
      debits_pending: 0n, // u64
      debits_posted: 0n, // u64
      credits_pending: 0n, // u64
      credits_posted: 0n, // u64
      timestamp: 0n // u64, Reserved: This will be set by the server.
    }
    console.info(`JASON::: 1.3 Creating Account ${util.inspect(account)}`)

    const errors = await client.createAccounts([account])
    console.info(`JASON::: 1.4 ERRORS ${util.inspect(errors)}.`)

    if (errors.length > 0) {
      if (errors[0].result === TbNode.CreateAccountError.exists ||
        errors[0].result === TbNode.CreateAccountError.exists_with_different_user_data) return []

      Logger.error('CreateAccount-ERROR: CRITICAL! ' + enumLabelFromCode(TbNode.CreateAccountError, errors[0].code))

      for (let i = 0; i < errors.length; i++) {
        Logger.error('CreateAccErrors -> ' + errors[i].code)
      }
      const fspiopError = ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.MODIFIED_REQUEST,
        'TB-Account entry failed for [' + tbId + ':' +
        enumLabelFromCode(TbNode.CreateAccountError, errors[0].code) + '] : ' + util.inspect(errors))
      throw fspiopError
    }
    return errors
  } catch (err) {
    console.error('TB: Unable to create account.')
    console.error(err)
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

const tbLookupAccount = async (participantCurrencyId) => {
  try {
    const client = await getTBClient()
    if (client == null) return {}

    const tbId = tbIdFrom(participantCurrencyId)
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
    if (client == null) return null

    const tranId = uuidToBigInt(id)
    const transfers = await client.lookupTransfers([tranId])
    if (transfers.length > 0) return transfers[0]
    return null
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

const tbLookupTransferMapped = async (id) => {
  try {
    const tbTransfer = await tbLookupTransfer(id)
    if (tbTransfer) {
      let isOrgPending = TbNode.TransferFlags.pending === tbTransfer.flags
      if (isOrgPending) isOrgPending = await tbIsPendingTransferPosted(id)

      const returnVal = {
        transferId: bigIntToUuid(tbTransfer.id),
        payerParticipantCurrencyId: Number(tbTransfer.debit_account_id),
        payeeParticipantCurrencyId: Number(tbTransfer.credit_account_id),
        payeeAmount: Number(tbTransfer.amount),
        currency: obtainCurrencyFromLedger(tbTransfer.ledger),
        // TODO this only tells us the original is a 2phase transfer, we still need to perform a lookup based on pending_id
        transferState: isOrgPending ? 'RESERVED' : 'ACCEPTED'
      }
      return returnVal
    }
    return {}
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

const tbIsPendingTransferPosted = async (id) => {
  try {
    const client = await getTBClient()
    if (client == null) return false

    // TODO const tranId = uuidToBigInt(id)
    const transfers = [1, 2, 3]// TODO await client.lookupBasedOnPendingId([tranId])
    if (transfers.length > 0) return true
    return false
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

const tbTransfer = async (
  transferRecord,
  payerTransferParticipantRecord,
  payeeTransferParticipantRecord,
  participants
) => {
  try {
    const client = await getTBClient()
    if (client == null) return {}

    Logger.info('1.1 Creating Transfer    ' + util.inspect(transferRecord))
    Logger.info('1.2 Creating Payer       ' + util.inspect(payerTransferParticipantRecord))
    Logger.info('1.3 Creating Payee       ' + util.inspect(payeeTransferParticipantRecord))
    Logger.info('1.4 Participants         ' + util.inspect(participants))

    const tranId = uuidToBigInt(transferRecord.transferId)
    const accountTypeNumeric = payerTransferParticipantRecord.ledgerEntryTypeId
    const payer = obtainTBAccountFrom(payerTransferParticipantRecord)
    const payee = obtainTBAccountFrom(payeeTransferParticipantRecord)
    const ledgerPayer = obtainLedgerFrom(payerTransferParticipantRecord, participants)

    Logger.info('(tbTransfer) Making use of id ' + uuidToBigInt(transferRecord.transferId) + ' [' + payer + ':::' + payee + ']')

    const transfer = {
      id: tranId, // u128
      debit_account_id: payer, // u128
      credit_account_id: payee, // u128
      user_data: tranId, // TODO u128, opaque third-party identifier to link this transfer (many-to-one) to an external entity
      reserved: BigInt(0), // two-phase condition can go in here / Buffer.alloc(32, 0)
      pending_id: 0,
      timeout: 0n, // u64, in nano-seconds.
      ledger: ledgerPayer,
      code: accountTypeNumeric, // u32, a chart of accounts code describing the reason for the transfer (e.g. deposit, settlement)
      flags: 0, // u32
      amount: BigInt(transferRecord.amount), // u64
      timestamp: 0n // u64, Reserved: This will be set by the server.
    }

    const errors = await client.createTransfers([transfer])
    if (errors.length > 0) {
      const errorTxt = errorsToString(TbNode.CreateTransferError, errors)

      Logger.error('Transfer-ERROR: ' + errorTxt)
      const fspiopError = ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.MODIFIED_REQUEST,
        'TB-Transfer entry failed for [' + tranId + ':' + errorTxt + '] : ' + util.inspect(errors))
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
  timeoutSeconds = 30
) => {
  try {
    const client = await getTBClient()
    if (client == null) return {}

    const tranId = uuidToBigInt(transferRecord.transferId)
    const accountTypeNumeric = payerTransferParticipantRecord.ledgerEntryTypeId// Enum.Accounts.LedgerAccountType.POSITION
    const payer = obtainTBAccountFrom(payerTransferParticipantRecord)
    const payee = obtainTBAccountFrom(payeeTransferParticipantRecord)
    const ledgerPayer = obtainLedgerFrom(payerTransferParticipantRecord, participants)

    let flags = 0
    flags |= TbNode.TransferFlags.pending

    const timeoutNanoseconds = BigInt(timeoutSeconds * 1000000000)
    const transfer = {
      id: tranId, // u128
      debit_account_id: payer, // u128
      credit_account_id: payee, // u128
      user_data: tranId, // u128, opaque third-party identifier to link this transfer (many-to-one) to an external entity
      reserved: BigInt(0),
      pending_id: BigInt(0),
      timeout: timeoutNanoseconds, // u64, in nano-seconds.
      ledger: ledgerPayer, // Currency
      code: accountTypeNumeric, // u32, a chart of accounts code describing the reason for the transfer (e.g. deposit, settlement)
      flags, // u32
      amount: BigInt(transferRecord.amount), // u64
      timestamp: 0n // u64, Reserved: This will be set by the server.
    }

    let errors = []
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
      const errorTxt = errorsToString(TbNode.CreateTransferError, errors)
      Logger.error('PrepareTransfer-ERROR: ' + errorTxt)
      const fspiopError = ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.MODIFIED_REQUEST,
        'TB-PrepareTransfer entry failed for [' + tranId + ':' + errorTxt + '] : ' + util.inspect(errors))
      throw fspiopError
    }
    return errors
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

const tbFulfilTransfer = async (
  transferFulfilmentRecord,
  ledgerEntryTypeId = 1// Enum.Accounts.LedgerAccountType.POSITION
) => {
  try {
    const client = await getTBClient()
    if (client == null) return {}

    let flags = 0
    flags |= TbNode.TransferFlags.post_pending_transfer

    const orgTransferId = uuidToBigInt(transferFulfilmentRecord.transferId)
    const postTransfer = {
      id: uuidToBigInt(`${uuidv4Gen()}`),
      debit_account_id: 0n, // use org.
      credit_account_id: 0n, // use org.
      user_data: orgTransferId,
      reserved: 0n,
      pending_id: orgTransferId, // u128
      timeout: 0n,
      ledger: 0, // Use ledger from pending transfer.
      code: ledgerEntryTypeId,
      flags,
      amount: 0n, // Amount from pending transfer
      timestamp: 0n // this will be set correctly by the TigerBeetle server
    }

    const errors = await client.createTransfers([postTransfer])
    if (errors.length > 0) {
      const errorTxt = errorsToString(TbNode.CreateTransferError, errors)
      Logger.error('FulfilTransfer-ERROR: ' + errorTxt)
      const fspiopError = ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.MODIFIED_REQUEST,
        `TB-TransferFulfil entry failed for [${transferFulfilmentRecord.transferId}:${errorTxt}:${util.inspect(errors)}`)
      throw fspiopError
    }
    return errors
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

const tbVoidTransfer = async (transferId) => {
  try {
    // TODO need to rollback transfer here...
    Logger.info(transferId)
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

const obtainTBAccountFrom = (account) => {
  return tbIdFrom(account.participantCurrencyId)
}

const obtainLedgerFrom = (
  account,
  participants
) => {
  const partCurrencyId = account.participantCurrencyId
  for (let i = 0; i < participants.length; i++) {
    const itemAtIndex = participants[i]
    if (itemAtIndex.participantCurrencyId === partCurrencyId) {
      return obtainLedgerFromCurrency(itemAtIndex.currencyId)
    }
  }

  const fspiopError = ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.MODIFIED_REQUEST,
    'TB-Participant-NotFound ' + partCurrencyId + ' : ' + util.inspect(account) + ' : ' + util.inspect(participants))
  throw fspiopError
}

const obtainLedgerFromCurrency = (currencyTxt) => {
  const returnVal = currencyMapping.find(itm => itm.currency === currencyTxt)
  if (returnVal) return returnVal.code
  return null
}

const obtainCurrencyFromLedger = (ledgerVal) => {
  const returnVal = currencyMapping.find(itm => itm.code === ledgerVal)
  if (returnVal) return returnVal.currency
  return null
}

const errorsToString = (resultEnum, errors) => {
  let errorListing = ''
  for (const val of errors) {
    errorListing = errorListing.concat('[' + val.code + ':' + enumLabelFromCode(resultEnum, val.code) + '],')
  }
  return errorListing
}

const tbIdFrom = (participantCurrencyId) => {
  if (participantCurrencyId === undefined) return 0n
  return BigInt(participantCurrencyId)
}

const uuidToBigInt = (uuid) => {
  return BigInt('0x' + uuid.replace(/-/g, ''))
}

const bigIntToUuid = (bi) => {
  let str = bi.toString(16)
  while (str.length < 32) str = '0' + str

  if (str.length !== 32) {
    Logger.warn(`_bigIntToUuid() got string that is not 32 chars long: "${str}"`)
  } else {
    str = `${str.substring(0, 8)}-${str.substring(8, 12)}-${str.substring(12, 16)}-${str.substring(16, 20)}-${str.substring(20)}`
  }
  return str
}

const enumLabelFromCode = (resultEnum, errCode) => {
  const errorEnum = Object.keys(resultEnum)
  return errorEnum[errCode + ((errorEnum.length / 2) - 1)]
}

module.exports = {
  tbCreateAccount,
  tbTransfer,
  tbPrepareTransfer, // TODO @jason: Need to add the rollback functions here...
  tbFulfilTransfer,
  tbLookupAccount,
  tbLookupTransferMapped,
  tbIsPendingTransferPosted,
  tbVoidTransfer,
  tbDestroy
}
