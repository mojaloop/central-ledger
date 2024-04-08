module.exports = {
  uuidToBin: uuid => uuid && Buffer.from(uuid.replace(/-/g, ''), 'hex'),
  binToUuid: bin => bin && [
    bin.toString('hex', 4, 8),
    bin.toString('hex', 2, 4),
    bin.toString('hex', 0, 2),
    bin.toString('hex', 8, 10),
    bin.toString('hex', 10, 16)
  ].join('-')
}
