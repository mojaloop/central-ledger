const config = {
  URI_PREFIX: 'http',
  CENTRAL_LEDGER_HOST: process.env.CENTRAL_LEDGER_HOST || 'localhost',
  CENTRAL_LEDGER_PORT: process.env.CENTRAL_LEDGER_PORT || '3001',
  CENTRAL_LEDGER_BASE: '',
  ML_API_ADAPTER_HOST: process.env.ML_API_ADAPTER_HOST || 'localhost',
  ML_API_ADAPTER_PORT: process.env.ML_API_ADAPTER_PORT || '3000',
  ML_API_ADAPTER_BASE: '',
  SIMULATOR_HOST: process.env.SIMULATOR_HOST || 'localhost',
  SIMULATOR_PORT: process.env.SIMULATOR_PORT || '8444',
  SIMULATOR_CORR_ENDPOINT: '/payeefsp/correlationid',
  SIMULATOR_REMOTE_HOST: process.env.SIMULATOR_REMOTE_HOST || 'simulator',
  SIMULATOR_REMOTE_PORT: process.env.SIMULATOR_REMOTE_PORT || '8444',
  get CENTRAL_LEDGER_URL () {
    return `${this.URI_PREFIX}://${this.CENTRAL_LEDGER_HOST}:${this.CENTRAL_LEDGER_PORT}${this.CENTRAL_LEDGER_BASE}`
  },
  get SIMULATOR_URL () {
    return `${this.URI_PREFIX}://${this.SIMULATOR_REMOTE_HOST}:${this.SIMULATOR_REMOTE_PORT}`
  },
  get ML_API_ADAPTER_URL () {
    return `${this.URI_PREFIX}://${this.ML_API_ADAPTER_HOST}:${this.ML_API_ADAPTER_PORT}${this.ML_API_ADAPTER_BASE}`
  },
  get SIMULATOR_HOST_URL () {
    return `${this.URI_PREFIX}://${this.SIMULATOR_HOST}:${this.SIMULATOR_PORT}${this.SIMULATOR_CORR_ENDPOINT}`
  }
}

module.exports = config
