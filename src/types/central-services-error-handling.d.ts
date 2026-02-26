// Type definitions for @mojaloop/central-services-error-handling.

declare module '@mojaloop/central-services-error-handling' {
  export interface FSPIOPApiErrorObject {
    errorInformation: {
      errorCode: string;
      errorDescription: string;
      extensionList?: {
        extension: Array<{
          key: string;
          value: string;
        }>;
      };
    };
  }
  export class FSPIOPError extends Error {
    apiErrorCode: any
    message: string
    cause: any
    extensions: any
    replyTo: string
    useMessageAsDescription: boolean
    
    constructor(cause: any, message: string, replyTo: string, apiErrorCode: any, extensions?: any, useMessageAsDescription?: boolean);
    
    toApiErrorObject(options?: { includeCauseExtension?: boolean; truncateExtensions?: boolean }): FSPIOPApiErrorObject;
    
    toFullErrorObject(): any;
  }

  export namespace Factory {
    export function createFSPIOPError(
      apiErrorCode: any,
      message?: string,
      cause?: any,
      replyTo?: string,
      extensions?: any,
      useDescriptionAsMessage?: boolean
    ): FSPIOPError;

    export function createInternalServerFSPIOPError(
      message: string,
      cause?: any,
      replyTo?: string,
      extensions?: any
    ): FSPIOPError;

    export function reformatFSPIOPError(
      error: any,
      apiErrorCode?: any,
      replyTo?: string,
      extensions?: any
    ): FSPIOPError;

    export function createFSPIOPErrorFromJoiError(error: any, cause?: any, replyTo?: string): FSPIOPError;
    export function createFSPIOPErrorFromOpenapiError(error: any, replyTo?: string): FSPIOPError;
    export function createFSPIOPErrorFromErrorInformation(errorInformation: any, cause?: any, replyTo?: string): FSPIOPError;
    export function createFSPIOPErrorFromErrorCode(code: any, message?: string, cause?: any, replyTo?: string, extensions?: any): FSPIOPError;
    export function validateFSPIOPErrorCode(code: any): any;
    export function validateFSPIOPErrorGroups(code: any): boolean;
  }

  export namespace Enums {
    export const FSPIOPErrorCodes: any
    export function findFSPIOPErrorCode(code: any): any;
    export function findErrorType(code: any): any;
  }

  export function validateRoutes(options?: any): any;
  export const Handler: any
  export const plugin: any
}