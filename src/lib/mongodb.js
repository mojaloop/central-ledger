'use strict'
const Mongoose = require('mongoose')
const Logger = require('@mojaloop/central-services-shared').Logger

Mongoose.connection.on('error', (err) => { Logger.info('connection error ', err) })
Mongoose.connection.once('open', function callback () {
  Logger.info('MongoDB succesfully connected')
})

Mongoose.set('useFindAndModify', false)
Mongoose.set('useNewUrlParser', true)
Mongoose.set('useCreateIndex', true)

exports.Mongoose = Mongoose
exports.db = Mongoose.connection
