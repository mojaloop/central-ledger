module.exports = {
  uuidToBin: uuid => uuid && Buffer.from(uuid.replace(/-/g, ''), 'hex'),
  binToUuid: bin => bin && [
    bin.toString('hex', 4, 8),
    bin.toString('hex', 2, 4),
    bin.toString('hex', 0, 2),
    bin.toString('hex', 8, 10),
    bin.toString('hex', 10, 16)
  ].join('-'),
  transferToUuid: transfer => {
    if (Array.isArray(transfer)) return transfer.map(module.exports.transferToUuid)
    if (Buffer.isBuffer(transfer?.transferId)) return { ...transfer, transferId: module.exports.binToUuid(transfer.transferId) }
    return transfer
  },
  transferToBin: transfer => transfer && { ...transfer, transferId: module.exports.uuidToBin(transfer.transferId) }
}
