'use strict'

/**
 * Notes:
 *  - I have done it this way to make the JSON flattening and to CSV as generic as possible. As long as you use a list of JSON objects, the below code will work.
 *  - The other option is to use the json2csv component to handle the conversion, where one can stipulate the mapping directly in the options. This will work, but it will no longer be generic.
 */
JSON.flatten = require('flat')
const json2csv = require('json2csv')

// Helper function to flatten each a list
function flattenJsonObjectList (jsonList) {
  const flatOptions = {delimiter: '_'}
  return jsonList.map(json => JSON.flatten(json, flatOptions))
}

module.exports = {
  flattenedTransfersJson: function flattendTransfersJson (settleTransfers) {
    return flattenJsonObjectList(settleTransfers)
  },
  flattenedFeeJson: function flattendFeeJson (settleFee) {
    return flattenJsonObjectList(settleFee)
  },
  joinedSettlementJson: function joinedSettlementJson (flattenedTransfersJson, flattenedFeeJson) {
    return flattenedTransfersJson.concat(flattenedFeeJson)
  },
  keys: function keys (joinedSettlementJson) {
    return Object.keys(joinedSettlementJson[0])
  },
  convertJsonToCsv: function convertJsonToCsv (joinedSettlementJson, keys) {
    try {
      return json2csv({
        data: joinedSettlementJson,
        fields: keys,
        del: '',
        doubleQuotes: '\'',
        hasCSVColumnTitle: true
      })
    } catch (err) {
      // Errors are thrown for bad options, or if the data is empty and no fields are provided.
      // Be sure to provide fields if it is possible that your data array will be empty.
      return err
    }
  }
}
