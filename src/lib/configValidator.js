
const Joi = require('@hapi/joi')
const Config = require('./config')

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

const additionalSettlementModelsSchema = Joi.array().items(
  Joi.string().valid('CGS', 'MULTILATERALDEFERREDNET', 'INTERCHANGEFEE')
)

/**
 * [validateConfig Validates startup configuration against schema]
 * @return {} [ ]
 */
async function validateConfig () {
  console.log(Config)
  await Promise.all([
    additionalParticipantLedgerAccountTypeSchema.validateAsync(Config.ADDITIONAL_PARTICIPANT_LEDGER_ACCOUNT_TYPES),
    additionalSettlementModelsSchema.validateAsync(Config.SETTLEMENT_MODELS)
  ])
}

module.exports = {
  validateConfig
}
