/**
 * @function processBins
 *
 * @async
 * @description This is the domain function to process a list bins containing position messages grouped by participant account.
 *
 * @param {array} bins - a list of account-bins to process
 * @param {object} trx - Database transaction object
 *
 * @returns {results} - Returns a list of bins with results or throws an error if failed
 */
const processBins = async (bins, trx) => {
  // TODO: Implement binProcessor
  // 1. Pre fetch all transferStateChanges for all the transferIds in the account-bin
  // 2. Pre fetch all position and settlement account balances for the account-bin and acquire lock on position
  // 3. For each account-bin in the list
  //   3.1. If non-prepare action found, log error
  //   3.2. If prepare action found
  //      3.2.1. Pre fetch NDC limit of participant
  //      3.2.2. Pre fetch settlementModelDelay
  //      3.2.3. then call processPositionPrepareBin function with:
  //          messages, positionValue, positionReservedValue, settlementPositionValue, settlementModelDelay, participantLimitValue, transferStateChanges
  //        Output: accumulatedPositionValue, accumulatedPositionReservedValue, accumulatedTransferStateChanges
  //   3.3. Insert accumulated transferStateChanges by calling a facade function
  //   3.4. Update accumulated position value by calling a facade function
  // 4. Return bins with results
}

module.exports = {
  processBins
}
