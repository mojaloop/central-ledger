'use strict'

const _ = require('lodash')
const Config = require('./config')

const omitNil = (object) => {
  return _.omitBy(object, _.isNil)
}

const pick = (object, properties) => {
  return _.pick(object, properties)
}

const assign = (target, source) => {
  return Object.assign(target, source)
}

const merge = (target, source) => {
  return Object.assign({}, target, source)
}

const mergeAndOmitNil = (target, source) => {
  return omitNil(merge(target, source))
}

const formatAmount = (amount) => {
  return Number(amount).toFixed(Config.AMOUNT.SCALE).toString()
}

const parseJson = (value) => {
  if (typeof value !== 'string') {
    return value
  }

  try {
    return JSON.parse(value)
  } catch (e) {
    return value
  }
}

const squish = (array) => {
  return _.join(array, '|')
}

const expand = (value) => {
  return (value) ? _.split(value, '|') : value
}

const filterUndefined = (fields) => {
  for (let key in fields) {
    if (fields[key] === undefined || fields[key] === null) {
      delete fields[key]
    }
  }
  return fields
}

/**
 * Method to provide object clonning
 *
 * TODO:
 *  Implement a better deep copy method
 *
 * @param value
 * @returns {any}
 */
const clone = (value) => {
  return JSON.parse(JSON.stringify(value))
}

module.exports = {
  assign,
  expand,
  formatAmount,
  merge,
  mergeAndOmitNil,
  omitNil,
  parseJson,
  pick,
  squish,
  filterUndefined,
  clone
}
