/* Helper Functions */

/**
 * Create a mock request handler
 * @param {*} param0
 */
const createRequest = ({ payload, params, query }) => {
  const requestPayload = payload || {}
  const requestParams = params || {}
  const requestQuery = query || {}

  return {
    payload: requestPayload,
    params: requestParams,
    query: requestQuery,
    server: {
      log: () => { },
      methods: {

      }
    }
  }
}

/**
 * unwrapResponse
 *
 * Use this function to unwrap the innner response body and code from an async Handler
 */
const unwrapResponse = async (asyncFunction) => {
  let responseBody
  let responseCode
  const nestedReply = {
    response: (response) => {
      responseBody = response
      return {
        code: statusCode => {
          responseCode = statusCode
        }
      }
    }
  }
  await asyncFunction(nestedReply)

  return {
    responseBody,
    responseCode
  }
}

module.exports = {
  createRequest,
  unwrapResponse
}
