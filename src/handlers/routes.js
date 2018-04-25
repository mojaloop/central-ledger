const RegisterAllHandler = require('./handlers')
const TransferHandler = require('./transfers/handler')
const PositionHandler = require('./positions/handler')
const NotificationHandler = require('./notification/handler')

module.exports = [
  {
    method: 'POST',
    path: '/register/all',
    handler: RegisterAllHandler.registerAllHandlers,
    options: {
      id: 'handlers',
      description: 'Register all Kafka consumer handlers'
    }
  },
  {
    method: 'POST',
    path: '/register/transfer/all',
    handler: TransferHandler.registerAllHandlers,
    options: {
      id: 'transfer',
      description: 'Register all transfer Kafka consumer handlers'
    }
  },
  {
    method: 'POST',
    path: '/register/transfer/prepare',
    handler: TransferHandler.registerPrepareHandlers,
    options: {
      id: 'prepare',
      description: 'Register prepare transfer Kafka consumer handler'
    }
  },
  {
    method: 'POST',
    path: '/register/transfer/fulfill',
    handler: TransferHandler.registerFulfillHandler,
    options: {
      id: 'fulfill',
      description: 'Register ful;fill transfer Kafka consumer handler'
    }
  },
  {
    method: 'POST',
    path: '/register/transfer/reject',
    handler: TransferHandler.registerRejectHandler,
    options: {
      id: 'reject',
      description: 'Register reject transfer Kafka consumer handler'
    }
  },
  {
    method: 'POST',
    path: '/register/position',
    handler: PositionHandler.registerPositionHandlers,
    options: {
      id: 'position',
      description: 'Register position Kafka consumer handler'
    }
  },
  {
    method: 'POST',
    path: '/register/notification',
    handler: NotificationHandler.registerNotificationHandler,
    options: {
      id: 'notification',
      description: 'Register prepare transfer Kafka consumer handler'
    }
  }
]
