import HandlerSettlementV2 from "./handler-v2"

const HapiOpenAPI = require('hapi-openapi')
const Path = require('path')
const HandlerHealth = require('../api_admin/root/handler')


const buildRoutes = (handler: HandlerSettlementV2) => {
  return {
    plugin: HapiOpenAPI,
    options: {
      api: Path.join(__dirname, '../settlement/interface/swagger.json'),
      handlers: {
        health: {
          get: HandlerHealth.getHealth
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

export default buildRoutes
