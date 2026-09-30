import { CommandResultSuccess, CommandResultFailure, QueryResultSuccess, QueryResultFailure } from './types';

export function commandResultSuccess<T>(result: T): CommandResultSuccess<T> {
  return {
    type: 'SUCCESS',
    result,
  } as CommandResultSuccess<T>;
}

export function emptyCommandResultSuccess(): CommandResultSuccess<void> {
  return {
    type: 'SUCCESS'
  };
}

export function commandResultFailure(error: any): CommandResultFailure {
  return {
    type: 'FAILURE',
    error: error
  };
}

export function queryResultSuccess<T>(result: T): QueryResultSuccess<T> {
  return {
    type: 'SUCCESS',
    result,
  } as QueryResultSuccess<T>;
}

export function queryResultFailure(error: any): QueryResultFailure {
  return {
    type: 'FAILURE',
    error: error
  };
}
