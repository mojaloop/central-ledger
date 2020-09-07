
const Joi = require('@hapi/joi')
const Config = require('./config')
const currencyList = require('../../../seeds/currency.js').currencyList
const settlementGranularityList = require('../../../seeds/settlementGranularity.js').settlementGranularityList
const settlementInterchangeList = require('../../../seeds/settlementInterchange.js').settlementInterchangeList
const settlementDelayList = require('../../../seeds/settlementDelay.js').settlementDelayList

const additionalParticipantLedgerAccountTypeSchema = Joi.array().items(Joi.object({
  name: Joi.string()
    .min(2)
    .max(30)
    .required()
    .description('Name of the ledger account type'),
  description: Joi.string()
    .required()
    .description('The description of the ledger account type')
}))

const additionalSettlementModelsSchema = Joi.array().items(Joi.object({
  name: Joi.string().alphanum().min(2).max(30).required().description('Name of the settlement model'),
  settlementGranularity: Joi.string().required().valid(...settlementGranularityList).description('Granularity type for the settlement model GROSS or NET'),
  settlementInterchange: Joi.string().required().valid(...settlementInterchangeList).description('Interchange type for the settlement model BILATERAL or MULTILATERAL'),
  settlementDelay: Joi.string().required().valid(...settlementDelayList).description('Delay type for the settlement model IMMEDIATE or DEFERRED'),
  currency: Joi.string().valid(...currencyList).description('Currency code'),
  requireLiquidityCheck: Joi.boolean().required().description('Liquidity Check boolean'),
  ledgerAccountType: Joi.string().required().description('Account type for the settlement model POSITION, SETTLEMENT or INTERCHANGE_FEE'),
  autoPositionReset: Joi.boolean().required().description('Automatic position reset setting, which determines whether to execute the settlement transfer or not'),
  settlementAccountType: Joi.string().valid('SETTLEMENT', 'INTERCHANGE_FEE_SETTLEMENT').required().description('Settlement account linked to the ledger account')
}))

/**
 * [validateConfig Validates startup configuration against schema]
 * @return {[Joi.validationResult]} [ ]
 */
async function validateConfig () {
  return additionalParticipantLedgerAccountTypeSchema.validateAsync(Config.ADDITIONAL_PARTICIPANT_LEDGER_ACCOUNT_TYPES)
}

module.exports = {
  validateConfig
}
