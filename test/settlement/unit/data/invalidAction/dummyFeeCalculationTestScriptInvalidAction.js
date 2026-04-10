/* eslint-disable no-undef */
// ********************************************************
// Name: Interchange fee calculation
// Type: notification
// Action: invalidAction
// Status: success
// Start: 2020-06-01T00:00:00.000Z
// End: 2100-12-31T23:59:59.999Z
// Description: This script calculates the interchange fees between DFSPs where the account type is "Wallet"
// ********************************************************

// ## Globals:
// payload: The contents of the message from the Kafka topic.
// transfer: The transfer object.

// # Functions:
// ## Data retrieval functions:
// getTransfer(transferId): Retrieves a mojaloop transfer from the central-ledger API.

// ## Helper functions:
// getExtensionValue(list, key): Gets a value from an extension list
// log(message): allows the script to log to standard out for debugging purposes

// Math functions:
// multiply(number1, number2, decimalPlaces): Uses ml-number to handle multiplication of money values

// Ledger functions:
// addLedgerEntry: Adds a debit and credit ledger entry to the specified account to the specified DFSPs

log(JSON.stringify(transfer))
const payerFspId = transfer.payer.partyIdInfo.fspId
const payeeFspId = transfer.payee.partyIdInfo.fspId

if ((payeeFspId !== payerFspId) &&
  (getExtensionValue(transfer.payee.partyIdInfo.extensionList.extension, 'accountType') === 'Wallet' &&
    getExtensionValue(transfer.payer.partyIdInfo.extensionList.extension, 'accountType') === 'Wallet') &&
  (transfer.transactionType.scenario === 'TRANSFER' &&
    transfer.transactionType.initiator === 'PAYER' &&
    transfer.transactionType.initiatorType === 'CONSUMER')) {
  log(`Adding an interchange fee for Wallet to Wallet from ${payerFspId} to ${payeeFspId}`)
  addLedgerEntry(payload.id, 'INTERCHANGE_FEE', // Ledger account type Id
    'INTERCHANGE_FEE', // Ledger entry type Id
    multiply(transfer.amount.amount, 0.006, 2),
    transfer.amount.currency,
    payerFspId,
    payeeFspId)
}
