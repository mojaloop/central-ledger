// ********************************************************
// Name: Interchange fee calculation
// Type: notification
// Action: commit
// Status: success
// Start: 2020-06-01T00:00:00.000Z
// End: 2020-12-31T23:59:59.999Z
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

// let transfer
// eslint-disable-next-line prefer-const,no-undef
// transfer = getTransfer(payload.id)
// eslint-disable-next-line no-undef
log(JSON.stringify(transfer))
// eslint-disable-next-line no-undef
const payerFspId = transfer.payer.partyIdInfo.fspId
// eslint-disable-next-line no-undef
const payeeFspId = transfer.payee.partyIdInfo.fspId

if ((payeeFspId !== payerFspId) &&
  // eslint-disable-next-line no-undef
  (getExtensionValue(transfer.payee.partyIdInfo.extensionList.extension, 'accountType') === 'Wallet' &&
    // eslint-disable-next-line no-undef
    getExtensionValue(transfer.payer.partyIdInfo.extensionList.extension, 'accountType') === 'Wallet') &&
  // eslint-disable-next-line no-undef
  (transfer.transactionType.scenario === 'TRANSFER' &&
    // eslint-disable-next-line no-undef
    transfer.transactionType.initiator === 'PAYER' &&
    // eslint-disable-next-line no-undef
    transfer.transactionType.initiatorType === 'CONSUMER')) {
  // eslint-disable-next-line no-undef
  log(`Adding an interchange fee for Wallet to Wallet from ${payerFspId} to ${payeeFspId}`)
  // eslint-disable-next-line no-undef
  addLedgerEntry(payload.id, 'INTERCHANGE_FEE', // Ledger account type Id
    'INTERCHANGE_FEE', // Ledger entry type Id
    // eslint-disable-next-line no-undef
    multiply(transfer.amount.amount, 0.006, 2),
    // eslint-disable-next-line no-undef
    transfer.amount.currency,
    payerFspId,
    payeeFspId)
}
