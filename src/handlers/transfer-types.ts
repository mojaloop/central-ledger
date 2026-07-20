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
