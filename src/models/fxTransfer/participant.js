const Db = require('../../lib/db')
const { TABLE_NAMES } = require('../../shared/constants')

// const table = TABLE_NAMES.fxTransferParticipant

// const getByNameAndCurrency = async (name, currencyId, ledgerAccountTypeId, isCurrencyActive) => {
//   return Db.from(table).query(async (builder) => {
//     let b = builder
//       .innerJoin('participantCurrency AS pc', 'pc.participantId', 'fxParticipant.fxTransferParticipantId')
//       .where({ 'fxParticipant.name': name })
//       .andWhere({ 'pc.currencyId': currencyId })
//       .andWhere({ 'pc.ledgerAccountTypeId': ledgerAccountTypeId })
//       .select(
//         'fxParticipant.*',
//         'pc.participantCurrencyId',
//         'pc.currencyId',
//         'pc.isActive AS currencyIsActive'
//       )
//       .first()

//     if (isCurrencyActive !== undefined) {
//       b = b.andWhere({ 'pc.isActive': isCurrencyActive })
//     }
//     return b
//   })
// }

module.exports = {
  // getByNameAndCurrency
}
