import HandlerV2Participants from "./participants/handler-v2";
import HandlerV2Transactions from "./transactions/handler-v2";

import routesBuilderParticipants from './participants/routes-v2'
import routesBuilderTransactions from './transactions/routes-v2'

const buildRoutes = (
  handlerParticipants: HandlerV2Participants,
  handlerTransactions: HandlerV2Transactions
) => {
  const routesParticipants = routesBuilderParticipants(handlerParticipants)
  const routesTransactions = routesBuilderTransactions(handlerTransactions)

  return {
    name: 'api routes',
    register: function (server: any) {
      server.route(require('./root/routes'))
      server.route(routesParticipants)
      server.route(routesTransactions)
      server.route(require('./settlementModels/routes'))
      // This can likely be removed, it was being consumed by central-settlements.
      server.route(require('./ledgerAccountTypes/routes'))
    }
  }
}

export default buildRoutes