const TABLE_NAMES = Object.freeze({
  fxTransfer: 'fxTransfer',
  fxTransferDuplicateCheck: 'fxTransferDuplicateCheck',
  fxTransferStateChange: 'fxTransferStateChange',
  transferDuplicateCheck: 'transferDuplicateCheck'
})

const FX_METRIC_PREFIX = 'fx_'

const PROM_METRICS = Object.freeze({
  transferGet: (isFx) => `${isFx ? FX_METRIC_PREFIX : ''}transfer_get`,
  transferPrepare: (isFx) => `${isFx ? FX_METRIC_PREFIX : ''}transfer_prepare`,
  transferFulfil: (isFx) => `${isFx ? FX_METRIC_PREFIX : ''}transfer_fulfil`,
  transferFulfilError: (isFx) => `${isFx ? FX_METRIC_PREFIX : ''}transfer_fulfil_error`
})

module.exports = {
  TABLE_NAMES,
  PROM_METRICS
}
