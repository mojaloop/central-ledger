/**
 * @function processPositionPrepareBin
 *
 * @async
 * @description This is the domain function to process a bin of position-prepare messages of a single participant account.
 *
 * @param {array} messages - a list of messages to consume for the relevant topic
 * @param {number} accumulatedPositionValue - value of position accumulated so far
 * @param {number} accumulatedPositionReservedValue - value of position reserved accumulated so far
 * @param {number} settlementPositionValue - value of settlement position to be used for liquidity check
 * @param {number} participantLimitValue - NDC limit of participant
 * @param {array} accumulatedTransferStateChanges - list of accumulated transfer state changes
 *
 * @returns {object} - Returns an object containing  accumulatedPositionValue, accumulatedPositionReservedValue, accumulatedTransferStateChanges or throws an error if failed
 */
const processPositionPrepareBin = async (messages, accumulatedPositionValue, accumulatedPositionReservedValue, settlementPositionValue, participantLimitValue, accumulatedTransferStateChanges) => {
    // TODO: Implement processPositionPrepareBin
}

module.exports = {
    processPositionPrepareBin,
}
