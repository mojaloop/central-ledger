import { FulfilHandlerInput, PaymentFulfilResult } from "../../handlers/payment-fulfil";
import { PrepareHandlerInput, PaymentPrepareResult } from "../../handlers/payment-prepare";
import { AnyQuery, CommandResult, CreateDfspCommand, CreateDfspResponse, CreateHubAccountCommand, CreateHubAccountResponse, DepositCommand, DepositResponse, DfspAccountResponse, FulfilResult, GetAllDfspAccountsQuery, GetAllDfspsResponse, GetDfspAccountsQuery, GetNetDebitCapQuery, GetNetDebitCapsQuery, GetSettlementQuery, GetSettlementQueryResponse, GetSettlementsQuery, GetSettlementsQueryResponse, GetSettlementWindowsQuery, GetSettlementWindowsQueryResponse, HubAccountResponse, Ledger, LegacyLedgerDfsp, LegacyLimit, LegacyLimitItem, LookupTransferQuery, LookupTransferQueryResponse, QueryResult, QueryResultWithNotFound, SetNetDebitCapCommand, SettlementAbortCommand, SettlementCloseWindowCommand, SettlementCommitCommand, SettlementPrepareCommand, SettlementUpdateCommand, SweepResult, WithdrawAbortCommand, WithdrawAbortResponse, WithdrawCommitCommand, WithdrawCommitResponse, WithdrawPrepareCommand, WithdrawPrepareResponse } from "./types";

/**
 * Temporary Ledger to make adding methods to LedgerSql more managable
 */
export default class LedgerScaffold implements Ledger {
  getNetDebitCaps(query: GetNetDebitCapsQuery): Promise<QueryResultWithNotFound<Array<LegacyLimitItem>>> {
    throw new Error("Method not implemented.");
  }
  prepare(inputs: Array<PrepareHandlerInput>): Promise<Array<PaymentPrepareResult>> {
    throw new Error("Method not implemented.");
  }
  fulfil(inputs: Array<FulfilHandlerInput>): Promise<Array<PaymentFulfilResult>> {
    throw new Error("Method not implemented.");
  }
  createHubAccount(cmd: CreateHubAccountCommand): Promise<CreateHubAccountResponse> {
    throw new Error("Method not implemented.");
  }
  createDfsp(cmd: CreateDfspCommand): Promise<CreateDfspResponse> {
    throw new Error("Method not implemented.");
  }
  disableDfsp(cmd: { dfspId: string; }): Promise<CommandResult<void>> {
    throw new Error("Method not implemented.");
  }
  enableDfsp(cmd: { dfspId: string; }): Promise<CommandResult<void>> {
    throw new Error("Method not implemented.");
  }
  enableDfspAccount(cmd: { dfspId: string; accountId: number; }): Promise<CommandResult<void>> {
    throw new Error("Method not implemented.");
  }
  disableDfspAccount(cmd: { dfspId: string; accountId: number; }): Promise<CommandResult<void>> {
    throw new Error("Method not implemented.");
  }
  deposit(cmd: DepositCommand): Promise<DepositResponse> {
    throw new Error("Method not implemented.");
  }
  withdrawPrepare(cmd: WithdrawPrepareCommand): Promise<WithdrawPrepareResponse> {
    throw new Error("Method not implemented.");
  }
  withdrawCommit(cmd: WithdrawCommitCommand): Promise<WithdrawCommitResponse> {
    throw new Error("Method not implemented.");
  }
  withdrawAbort(cmd: WithdrawAbortCommand): Promise<WithdrawAbortResponse> {
    throw new Error("Method not implemented.");
  }
  setNetDebitCap(cmd: SetNetDebitCapCommand): Promise<CommandResult<void>> {
    throw new Error("Method not implemented.");
  }
  getHubAccounts(query: AnyQuery): Promise<HubAccountResponse> {
    throw new Error("Method not implemented.");
  }
  getDfsp(query: { dfspId: string; }): Promise<QueryResultWithNotFound<LegacyLedgerDfsp>> {
    throw new Error("Method not implemented.");
  }
  getAllDfsps(query: AnyQuery): Promise<QueryResult<GetAllDfspsResponse>> {
    throw new Error("Method not implemented.");
  }
  getDfspAccounts(query: GetDfspAccountsQuery): Promise<DfspAccountResponse> {
    throw new Error("Method not implemented.");
  }
  getAllDfspAccounts(query: GetAllDfspAccountsQuery): Promise<DfspAccountResponse> {
    throw new Error("Method not implemented.");
  }
  getNetDebitCap(query: GetNetDebitCapQuery): Promise<QueryResultWithNotFound<LegacyLimit>> {
    throw new Error("Method not implemented.");
  }

  sweepTimedOut(now: Date): Promise<SweepResult> {
    throw new Error("Method not implemented.");
  }
  lookupTransfer(query: LookupTransferQuery): Promise<LookupTransferQueryResponse> {
    throw new Error("Method not implemented.");
  }
  closeSettlementWindow(cmd: SettlementCloseWindowCommand): Promise<CommandResult<void>> {
    throw new Error("Method not implemented.");
  }
  settlementPrepare(cmd: SettlementPrepareCommand): Promise<CommandResult<{ id: number; }>> {
    throw new Error("Method not implemented.");
  }
  settlementAbort(cmd: SettlementAbortCommand): Promise<CommandResult<void>> {
    throw new Error("Method not implemented.");
  }
  settlementCommit(cmd: SettlementCommitCommand): Promise<CommandResult<void>> {
    throw new Error("Method not implemented.");
  }
  settlementUpdate(cmd: SettlementUpdateCommand): Promise<CommandResult<void>> {
    throw new Error("Method not implemented.");
  }
  getSettlementWindows(query: GetSettlementWindowsQuery): Promise<QueryResult<GetSettlementWindowsQueryResponse>> {
    throw new Error("Method not implemented.");
  }
  getSettlement(query: GetSettlementQuery): Promise<GetSettlementQueryResponse> {
    throw new Error("Method not implemented.");
  }
  getSettlements(query: GetSettlementsQuery): Promise<GetSettlementsQueryResponse> {
    throw new Error("Method not implemented.");
  }
  
}