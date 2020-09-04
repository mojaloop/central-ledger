
const Joi = require('@hapi/joi')
const Config = require('./config')

const additionalParticipantLedgerAccountTypeSchema = Joi.array().items(Joi.object({
    name: Joi.string()
              .alphanum()
              .min(2)
              .max(30)
              .required()
              .description('Name of the ledger account type'),
    description: Joi.string()
                 .required()
                 .description('The description of the ledger account type'),
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
