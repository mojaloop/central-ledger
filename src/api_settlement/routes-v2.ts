import HandlerSettlementV2 from "./handler-v2"

const HapiOpenAPI = require('hapi-openapi')
const Path = require('path')

const buildRoutes = (handler: HandlerSettlementV2) => {
  return {
    plugin: HapiOpenAPI,
    options: {
      api: Path.join(__dirname, '../settlement/interface/swagger.json'),
      handlers: {
        health: {
          get: notImplemented('GET /health')
        },
        settlementWindows: {
          get: handler.getSettlementWindowsByParams.bind(handler),
          '{id}': {
            get: handler.getSettlementWindowById.bind(handler),
            post: handler.closeSettlementWindow.bind(handler),
          }
        },
        settlements: {
          get: handler.getSettlementByParams.bind(handler),
          post: handler.createSettlementEvent.bind(handler),
          '{id}': {
            get: handler.getSettlementById.bind(handler),
            put: handler.updateSettlementById.bind(handler),
          },
          '{sid}': {
            participants: {
              '{pid}': {
                get: handler.getSettlementBySettlementParticipant.bind(handler),
                put: handler.updateSettlementByParticipant.bind(handler),
                accounts: {
                  '{aid}': {
                    get: handler.getSettlementBySettlementParticipantAccount.bind(handler),
                    put: handler.updateSettlementByIdParticipantAccount.bind(handler),
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}

const notImplemented = (route: string) => (_req: any, h: any) => {
  return h.response({ error: `${route} not implemented in handler-v2` }).code(501)
}

export default buildRoutes
