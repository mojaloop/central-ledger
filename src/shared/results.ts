/**
 * Convenience Types for QueryResult
 * When T is void, result property is omitted
 */

export type QueryResultSuccess<T> = T extends void
  ? { type: 'SUCCESS' }
  : { type: 'SUCCESS'; result: T }

export type QueryResultFailure = {
  type: 'FAILURE',
  error: Error
}

export type QueryResult<T> = QueryResultSuccess<T> | QueryResultFailure

export function failureWithError(error: any): QueryResultFailure {
  return {
    type: 'FAILURE',
    error
  }
}