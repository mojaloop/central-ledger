import { LedgerSql } from "../../domain/ledger/ledger-sql";
import { ApplicationConfig } from "../../lib/config";
import { ReqRefDefaults, Request, ResponseToolkit } from '@hapi/hapi';
const Transaction = require('../../domain/transactions')
const rethrow = require('../../shared/rethrow')
const fspiopErrorFactory = require('../../shared/fspiopErrorFactory')
const logger = require('../../shared/logger').logger

interface Dependencies {
  config: ApplicationConfig,
  ledger: LedgerSql,
}

export type RequestGetById = Request<ReqRefDefaults & {
  Params: { id: string }
}>

export default class HandlerV2 {
  constructor(private deps: Dependencies) {
    logger.warn(`transactions HandlerV2.constructor() - API_MODE_ADMIN=${this.deps.config.API_MODE_ADMIN}`)
  }

  public async getById(request: RequestGetById, h: ResponseToolkit): Promise<unknown> {
    if (this.deps.config.API_MODE_ADMIN === 'LEDGER') {
      return this.ledger_getById(request, h)
    }

    try {
      const entity = await Transaction.getById(request.params.id)
      if (entity) {
        return await Transaction.getTransactionObject(entity[0].value)
      }
      throw fspiopErrorFactory.resourceNotFound()
    } catch (err) {
      rethrow.rethrowAndCountFspiopError(err, { operation: 'transactionsGetById' })
    }
  }

  public async ledger_getById(request: RequestGetById, h: ResponseToolkit): Promise<unknown> {
    try {
      const result = await this.deps.ledger.lookupTransfer({
        transferId: request.params.id
      })

      if (result.type === 'NOT_FOUND') {
        throw fspiopErrorFactory.resourceNotFound()
      }

      if (result.type === 'FAILED') {
        throw result.error
      }
      return result.transfer
    } catch (err) {
      rethrow.rethrowAndCountFspiopError(err, { operation: 'transactionsGetById' })
    }
  }
}
