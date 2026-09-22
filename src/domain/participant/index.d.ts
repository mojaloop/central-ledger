export interface ParticipantCurrency {
  participantCurrencyId: number
  participantId: number
  currencyId: string
  ledgerAccountTypeId: number
  isActive: number
  createdDate: string
  createdBy: string
}

export interface Participant {
  participantId: number
  name: string
  description: string | null
  isActive: number
  createdDate: string
  createdBy: string
  isProxy: number
  currencyList: ParticipantCurrency[]
}

export function create(payload: any): Promise<any>
export function ensureExists(name: string): Promise<void>
export function getAll(): Promise<Array<Participant>>
export function getById(id: any): Promise<Participant | undefined>
export function getByName(name: string): Promise<Participant | undefined>
export function getLedgerAccountTypeName(ledgerAccountTypeId: any): Promise<string>
export function update(name: string, payload: any): Promise<any>
export function createParticipantCurrency(participantId: any, currencyId: any, ledgerAccountTypeId: any, isActive: boolean): Promise<any>
export function createHubAccount(participantId: number, currencyId: any, ledgerAccountTypeId: any): Promise<any>
export function getParticipantCurrencyById(participantCurrencyId: any): Promise<any>
export function destroyByName(name: string): Promise<void>
export function addEndpoint(name: string, payload: { type: string, value: string }): Promise<any>
export function addEndpoints(name: string, endpoints: Array<{ type: string, value: string }>): Promise<any>
export function getEndpoint(name: string, type: string): Promise<any>
export function getAllEndpoints(name: string): Promise<any>
export function destroyParticipantEndpointByName(name: string): Promise<void>
export function addLimitAndInitialPosition(participantName: string, limitPositionObj: any): Promise<any>
export function getPositionByParticipantCurrencyId(participantCurrencyId: any): Promise<any>
export function getPositionChangeByParticipantPositionId(participantPositionId: any): Promise<any>
export function destroyParticipantPositionByNameAndCurrency(name: string, currencyId: any): Promise<void>
export function destroyParticipantLimitByNameAndCurrency(name: string, currencyId: any): Promise<void>
export function getLimits(name: string, params?: any): Promise<any>
export function adjustLimits(name: string, params: any): Promise<any>
export function adjustLimitsV2(name: string, params: any, trx?: any): Promise<any>
export function getPositions(name: string, query?: any): Promise<any>
export interface ParticipantWithCurrency extends Participant {
  participantCurrencyId: number
  currencyId: string
  currencyIsActive: number
}

export function getByNameAndCurrency(
  name: string,
  currencyId: string,
  ledgerAccountTypeId: number,
  isCurrencyActive?: boolean
): Promise<ParticipantWithCurrency | undefined>


type GetAccountsResponseAccount = {
  id: number,
  ledgerAccountType: string,
  currency: string,
  isActive: number,
  value: string,
  reservedValue: string,
  changedDate: string,
  createdDate: string
}

export function getAccounts(name: string, query: {currency?: string}): Promise<Array<GetAccountsResponseAccount>>

export function updateAccount(payload: { isActive: boolean }, params: { name: string, id: number }, enums: any): Promise<void>
export function getParticipantAccount(participantName: string, accountId: any): Promise<any>
export function recordFundsInOut(payload: any, params: any, enums: any): Promise<any>
export function getAccountByNameAndCurrency(name: string, currencyId: any, ledgerAccountTypeId: any): Promise<any>
export function hubAccountExists(currencyId: any, ledgerAccountTypeId: any): Promise<boolean>
export function getLimitsForAllParticipants(payload: { currency: string, type: string }): Promise<any>
export function validateHubAccounts(payload: any): Promise<any>
export function createAssociatedParticipantAccounts(currency: any, ledgerAccountTypeId: any, trx: any): Promise<any>

export interface RecordFundsPayload {
  transferId: string
  action: 'recordFundsIn' | 'recordFundsOutPrepareReserve' | 'recordFundsOutCommit' | 'recordFundsOutAbort'
  reason?: string
  externalReference?: string
  amount?: {
    amount: number | string
    currency: string
  }
  participantCurrencyId?: number
}

export function createRecordFundsInOut(
  payload: RecordFundsPayload,
  transactionTimestamp: Date,
  enums: any
): Promise<void>

export function changeStatusOfRecordFundsOut(
  payload: RecordFundsPayload,
  transferId: string,
  transactionTimestamp: Date,
  enums: any
): Promise<boolean>
