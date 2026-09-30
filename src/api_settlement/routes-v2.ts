const OpenapiBackend = require('@mojaloop/central-services-shared').Util.OpenapiBackend
import HandlerSettlementV2 from "./handler-v2"

const Path = require('path')
const HandlerHealth = require('../api_admin/root/handler')

const { getBasePath, handleRequest, assertHandlersRegistered, preOperationHandler } = require('./openapiRouting')


const APIRoutes = (api: any) => {
  const basePath = getBasePath(api)
  return [
    {
      method: 'GET',
      path: `${basePath}/health`,
      handler: (req: any, h: any) => handleRequest(api, req, h),
      config: {
        id: 'getHealth',
        tags: ['api', 'getHealth'],
        description: 'GET health'
      }
    },
    {
      method: 'GET',
      path: `${basePath}/settlementWindows/{id}`,
      handler: (req: any, h: any) => handleRequest(api, req, h),
      config: {
        id: 'getSettlementWindowById',
        tags: ['api', 'getSettlementWindowById', 'sampled'],
        description: 'GET settlement window by id'
      }
    },
    {
      method: 'POST',
      path: `${basePath}/settlementWindows/{id}`,
      handler: (req: any, h: any) => handleRequest(api, req, h),
      config: {
        id: 'closeSettlementWindow',
        tags: ['api', 'closeSettlementWindow', 'sampled'],
        description: 'POST close settlement window by id'
      }
    },
    {
      method: 'GET',
      path: `${basePath}/settlementWindows`,
      handler: (req: any, h: any) => handleRequest(api, req, h),
      config: {
        id: 'getSettlementWindowsByParams',
        tags: ['api', 'getSettlementWindowsByParams', 'sampled'],
        description: 'GET settlement windows by params'
      }
    },
    {
      method: 'GET',
      path: `${basePath}/settlements`,
      handler: (req: any, h: any) => handleRequest(api, req, h),
      config: {
        id: 'getSettlementsByParams',
        tags: ['api', 'getSettlementsByParams', 'sampled'],
        description: 'GET settlements by params'
      }
    },
    {
      method: 'POST',
      path: `${basePath}/settlements`,
      handler: (req: any, h: any) => handleRequest(api, req, h),
      config: {
        id: 'createSettlement',
        tags: ['api', 'createSettlement', 'sampled'],
        description: 'POST trigger settlement event'
      }
    },
    {
      method: 'GET',
      path: `${basePath}/settlements/{id}`,
      handler: (req: any, h: any) => handleRequest(api, req, h),
      config: {
        id: 'getSettlementById',
        tags: ['api', 'getSettlementById', 'sampled'],
        description: 'GET settlement by id'
      }
    },
    {
      method: 'PUT',
      path: `${basePath}/settlements/{id}`,
      handler: (req: any, h: any) => handleRequest(api, req, h),
      config: {
        id: 'updateSettlementById',
        tags: ['api', 'updateSettlementById', 'sampled'],
        description: 'PUT update settlement by id'
      }
    },
    {
      method: 'GET',
      path: `${basePath}/settlements/{sid}/participants/{pid}`,
      handler: (req: any, h: any) => handleRequest(api, req, h),
      config: {
        id: 'getSettlementBySettlementParticipant',
        tags: ['api', 'getSettlementBySettlementParticipant', 'sampled'],
        description: 'GET settlement by settlement and participant'
      }
    },
    {
      method: 'PUT',
      path: `${basePath}/settlements/{sid}/participants/{pid}`,
      handler: (req: any, h: any) => handleRequest(api, req, h),
      config: {
        id: 'updateSettlementBySettlementParticipant',
        tags: ['api', 'updateSettlementBySettlementParticipant', 'sampled'],
        description: 'PUT update settlement by settlement and participant'
      }
    },
    {
      method: 'GET',
      path: `${basePath}/settlements/{sid}/participants/{pid}/accounts/{aid}`,
      handler: (req: any, h: any) => handleRequest(api, req, h),
      config: {
        id: 'getSettlementBySettlementParticipantAccount',
        tags: ['api', 'getSettlementBySettlementParticipantAccount', 'sampled'],
        description: 'GET settlement by settlement, participant and account'
      }
    },
    {
      method: 'PUT',
      path: `${basePath}/settlements/{sid}/participants/{pid}/accounts/{aid}`,
      handler: (req: any, h: any) => handleRequest(api, req, h),
      config: {
        id: 'updateSettlementBySettlementParticipantAccount',
        tags: ['api', 'updateSettlementBySettlementParticipantAccount', 'sampled'],
        description: 'PUT update settlement by settlement, participant and account'
      }
    }
  ]
}

const buildRoutes = (handler: HandlerSettlementV2) => {
  const handlers = {
    getHealth: (context: any, req: any, h: any) => HandlerHealth.getHealth(req, h),
    getSettlementWindowsByParams: handler.getSettlementWindowsByParams.bind(handler),
    getSettlementWindowById: handler.getSettlementWindowById.bind(handler),
    closeSettlementWindow: handler.closeSettlementWindow.bind(handler),
    getSettlementsByParams: handler.getSettlementByParams.bind(handler),
    createSettlement: handler.createSettlementEvent.bind(handler),
    getSettlementById: handler.getSettlementById.bind(handler),
    updateSettlementById: handler.updateSettlementById.bind(handler),
    getSettlementBySettlementParticipant: 
      handler.getSettlementBySettlementParticipant.bind(handler),
    updateSettlementBySettlementParticipant: 
      handler.updateSettlementByParticipant.bind(handler),
    getSettlementBySettlementParticipantAccount: 
      handler.getSettlementBySettlementParticipantAccount.bind(handler),
    updateSettlementBySettlementParticipantAccount:
    handler.updateSettlementByIdParticipantAccount.bind(handler),
    preOperationHandler,
    validationFail: OpenapiBackend.validationFail,
    notFound: OpenapiBackend.notFound,
    methodNotAllowed: OpenapiBackend.methodNotAllowed
  }
  return {
    plugin: {
      name: 'settlement api routes',
      register: async function (server: any) {
        const api = await OpenapiBackend.initialise(
          Path.join(__dirname, '../settlement/interface/swagger.json'),
          handlers
        )
        assertHandlersRegistered(api)
        server.route(APIRoutes(api))
      }
    }
  }
}

export default buildRoutes
