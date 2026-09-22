import { ReqRefDefaults, Request, Server, ServerMethods } from '@hapi/hapi';
import { Span } from "@mojaloop/event-sdk";

export type SettlementEnumName =
  | 'ledgerAccountType'
  | 'ledgerEntryType'
  | 'participantLimitType'
  | 'settlementDelay'
  | 'settlementDelayEnum'
  | 'settlementGranularity'
  | 'settlementGranularityEnum'
  | 'settlementInterchange'
  | 'settlementInterchangeEnum'
  | 'settlementState'
  | 'settlementWindowState'
  | 'transferParticipantRoleType'
  | 'transferStateEnum'
  | 'transferState';

export type SettlementEnumResult = Record<string, string | number>;

export interface SettlementServerMethods extends ServerMethods {
  enums: (name: SettlementEnumName) => Promise<SettlementEnumResult>;
}

export interface SettlementServer extends Server {
  methods: SettlementServerMethods;
}

type SettlementRequest<T extends Partial<ReqRefDefaults> = {}> = Request<ReqRefDefaults & T> & {
  span: Span;
  server: SettlementServer;
};

export type RequestGetSettlementsByParams = SettlementRequest<{
  Query: {
    currency?: string;
    participantId?: number;
    settlementWindowId?: number;
    accountId?: number;
    state?: string;
    fromDateTime?: string;
    toDateTime?: string;
    fromSettlementWindowDateTime?: string;
    toSettlementWindowDateTime?: string;
  };
}>;

export type RequestCreateSettlementEvent = SettlementRequest<{
  Payload: {
    settlementModel: string;
    reason: string;
    settlementWindows: { id: number }[];
  };
}>;

export type RequestGetSettlementById = SettlementRequest<{
  Params: { id: number };
}>;

export type RequestUpdateSettlementById = SettlementRequest<{
  Params: { id: number };
  Payload: {
    state?: string;
    reason?: string;
    externalReference?: string;
    participants?: {
      id: number;
      accounts: {
        id: number;
        reason?: string;
        state?: string;
        externalReference?: string;
      }[];
    }[];
  };
}>;

export type RequestGetSettlementWindowsByParams = SettlementRequest<{
  Query: {
    participantId?: number;
    state?: string;
    fromDateTime?: string;
    toDateTime?: string;
    currency?: string;
  };
}>;

export type RequestGetSettlementWindowById = SettlementRequest<{
  Params: { id: number };
}>;

export type RequestCloseSettlementWindow = SettlementRequest<{
  Params: { id: number };
  Payload: { state: 'CLOSED'; reason: string };
}>;

export type RequestGetSettlementByParticipant = SettlementRequest<{
  Params: { sid: number; pid: number };
}>;

export type RequestUpdateSettlementByParticipant = SettlementRequest<{
  Params: { sid: number; pid: number };
  Payload: {
    accounts: {
      id: number;
      reason?: string;
      state?: string;
      externalReference?: string;
    }[];
  };
}>;

export type RequestGetSettlementByParticipantAccount = SettlementRequest<{
  Params: { sid: number; pid: number; aid: number };
}>;

export type RequestUpdateSettlementByParticipantAccount = SettlementRequest<{
  Params: { sid: number; pid: number; aid: number };
  Payload: { state: string; reason: string; externalReference?: string };
}>;

export type RequestGetHealth = SettlementRequest;