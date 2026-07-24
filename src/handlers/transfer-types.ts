
/**
 * Types over javascript domain/model functions we need to inject into the new handlers.
 */

export type ProxyCache = {
  getFSPProxy: (dfspId: string, options?: unknown) => Promise<{
    inScheme: boolean,
    proxyId: string | null,
    name: string
  } | null>
}

export type CreateRemittanceEntity = () => {
  checkIfDeterminingTransferExists: (payload: any, proxyObligation: any) => Promise<any>
  getByIdLight: (id: string) => Promise<any>
  getDuplicate: (id: string) => Promise<{ [key: string]: any; hash?: string | undefined; } | null>
  saveDuplicateHash: (id: string, hash: string) => Promise<void>,
  savePreparedRequest: (
    payload: unknown,
    reason: string | null,
    isValid: boolean,
    determiningTransferCheckResult: unknown,
    proxyObligation: unknown
  ) => Promise<void>,
  getPositionParticipant: (
    payload: any, 
    determiningTransferCheckResult: any,
    proxyObligation: any
  ) => Promise<any>
}

export type KafkaParams<T> = {
  message: any
  kafkaTopic: string
  decodedPayload: T
  span: any
  consumer: any
  producer: any
}
