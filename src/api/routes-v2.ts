import HandlerV2 from "./participants/handler-v2";

import routesParticipantsBuilder from './participants/routes-v2'

const buildRoutes = (handlerParticipants: HandlerV2) => {
  const routesParticipants = routesParticipantsBuilder(handlerParticipants)

  return {
    name: 'api routes',
    register: function (server: any) {
      server.route(require('./root/routes'))
      server.route(routesParticipants)
      server.route(require('./transactions/routes'))
      server.route(require('./settlementModels/routes'))
      // This can likely be removed, it was being consumed by central-settlements.
      server.route(require('./ledgerAccountTypes/routes'))
    }
  }
}

export default buildRoutes