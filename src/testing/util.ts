
import assert from 'node:assert'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { createServer } from 'node:net';
import { Request, ReqRefDefaults } from '@hapi/hapi';
import { Snapshot } from './snapshot';

export const PROJECT_ROOT = path.resolve(__dirname, '../..')

export const TAP_XUNIT_BIN = path.join(PROJECT_ROOT, 'node_modules/.bin/tap-xunit')
/**
 * @function enumeratePaths
 * @description Iterate through a nested object and return the paths as a list of `|` delimited path
 *   strings.
 * @example
 *  
 * enumeratePaths({a:{b:{c: 123}}}) => ['a', 'a|b', 'a|b|c']
 */
export function enumeratePaths(input: any): Array<string> {
  const paths: Array<string> = []
  const _enumerateNode = (input: any, path: string) => {
    if (input === null || input === undefined) {
      paths.push(path.replace(/\|$/, ''))
      return
    }
    if (typeof input === 'string'
      || typeof input === 'number'
      || typeof input === 'boolean'
      || typeof input === 'bigint'
    ) {
      paths.push(path.replace(/\|$/, ''))
      return
    }

    assert(typeof input === 'object')

    for (const leaf of Object.keys(input)) {
      const node = input[leaf]
      paths.push(path.replace(/\|$/, ''))
      _enumerateNode(node, `${path}${leaf}|`)
    }
    return []
  }

  _enumerateNode(input, '')

  // Deduplicate the intermediate paths.
  return Object.keys(paths.reduce((acc: Record<string, true>, curr) => {
    if (curr === '') return acc
    acc[curr] = true
    return acc
  }, {}))
}

/**
 * @function deleteAtPath
 * @description Delete an element from a complex object. Replaces the object in place.
 * @param path: `|` delimited path string
 */
export function deleteAtPath(input: any, path: string): void {
  const pathComponents = path.split('|')
  assert(pathComponents.length > 0)
  for (let pathComponent of pathComponents) {
    if (pathComponent === pathComponents.at(-1)) {
      delete input[pathComponent]
      return
    }
    input = input[pathComponent]
  }
}

/**
 * @function replaceAtPath
 * @description Replace an element with a new value from a complex object. Replaces the object in 
 *  place.
 * @param path: `|` delimited path string
 */
export function replaceAtPath(input: any, path: string, newValue: any): void {
  const pathComponents = path.split('|')
  assert(pathComponents.length > 0)
  for (let pathComponent of pathComponents) {
    if (pathComponent === pathComponents.at(-1)) {
      input[pathComponent] = newValue
      return
    }
    input = input[pathComponent]
  }
}

/**
 * @function findFiles
 * @description Find all files matching a glob pattern.
 */
export function findFiles(baseDir: string, pattern: string): string[] {
  const results: string[] = []

  // Convert glob pattern to regex.
  const regexPattern = pattern
    .replaceAll('.', String.raw`\.`)
    .replaceAll('**', '{{DOUBLESTAR}}')
    .replaceAll('*', String.raw`[^/]*`)
    .replaceAll('{{DOUBLESTAR}}', '.*')

  const regex = new RegExp(`^${regexPattern}$`)

  function walkDir(dir: string, relativePath: string = '') {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)
        const relPath = relativePath ? `${relativePath}/${entry.name}` : entry.name

        if (entry.isDirectory()) {
          if (entry.name !== 'node_modules' && entry.name !== '.git') {
            walkDir(fullPath, relPath)
          }
        } else if (entry.isFile()) {
          if (regex.test(relPath)) {
            results.push(relPath)
          }
        }
      }
    } catch (err: any) {
      // Ignore permission errors.
      console.error('findFiles() - ignoring err', err.message)
    }
  }

  walkDir(baseDir)
  return results
}

/**
 * @function convertToXunit
 * @description Convert TAP output to xunit XML format.
 */
export async function convertToXunit(output: string, outputFile: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(TAP_XUNIT_BIN, [], {
      cwd: PROJECT_ROOT,
      stdio: ['pipe', 'pipe', 'pipe']
    })

    let xml = ''
    let stderr = ''

    proc.stdout.on('data', (data: Buffer) => {
      xml += data.toString()
    })

    proc.stderr.on('data', (data: Buffer) => {
      stderr += data.toString()
    })

    proc.on('close', (code) => {
      if (code !== 0 || !xml) {
        console.warn('Warning: Could not generate xunit report:', stderr)
        reject(stderr)
        return
      }
      // Ensure directory exists.
      const dir = path.dirname(outputFile)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      fs.writeFileSync(outputFile, xml)
      console.log(`\nXUnit report written to: ${outputFile}`)
      resolve()
    })

    proc.on('error', () => {
      console.warn('Warning: tap-xunit not available')
      resolve()
    })

    proc.stdin.write(output)
    proc.stdin.end()
  })
}

/**
 * @function randomAvailablePort
 * @description Finds a randomly available port by quickly running a server and stopping a server
 *   on port 0.
 */
export async function randomAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0)
    server.on('listening', () => {
      try {
        const address = server.address() as unknown as { port: number }
        assert.equal(typeof address, 'object')
        assert(address.port)

        server.close(() => {
          resolve(address.port);
        });
      } catch (err) {
        reject(err)
      }
    })

    server.on('error', (err) => {
      reject(err)
    });
  });
}

/** 
 * @description A hacky method to sleep in JS. For testing purposes only.
 */
export async function sleepSeconds(seconds: number) {
  return new Promise(resolve => setTimeout(resolve, seconds * 1000))
}

/**
 * @function createRequest
 *
 * @description Create a mock hapi request handler.
 */
export const createRequest = (
  { payload, params, query }: { payload: any, params: any, query: any }
): Request<ReqRefDefaults> => {
  const requestPayload = payload || {}
  const requestParams = params || {}
  const requestQuery = query || {}

  const mock = {
    payload: requestPayload,
    params: requestParams,
    query: requestQuery,
    server: {
      log: () => { },
      methods: {}
    }
  } as unknown as Request<ReqRefDefaults>

  return mock
}


/**
 * @function unwrapResponse
 *
 * @description Unwrap the innner response body and code from an async Handler.
 */
export const unwrapResponse = async (asyncFunction: (reply: any) => any) => {
  let responseBody: any
  let responseCode: number = -1
  const nestedReply = {
    response: (response: any) => {
      responseBody = response
      return {
        code: (statusCode: number) => {
          responseCode = statusCode
        }
      }
    }
  }
  // Sometimes the handlers call `h.response().code()`, but if they return directly,
  // we should capture the direct response.
  const directResponse = await asyncFunction(nestedReply)
  if (directResponse) {
    // Default when everything went well!
    let responseCode = 200
    // Sometimes the handler puts it here!
    if (directResponse.httpStatusCode) {
      responseCode = directResponse.httpStatusCode
    }
    return {
      responseBody: directResponse,
      responseCode
    }
  }

  return {
    responseBody,
    responseCode
  }
}

/**
 * @function unwrapResponseSettlement
 *
 * @description A version of unwrap response which maps the response slightly differently for the
 *   settlement handlers.
 */
export const unwrapResponseSettlement = async (asyncFunction: (reply: any) => any) => {
  let body: any
  let code: number = 200 // Default.
  const nestedReply = {
    response: (response: any) => {
      body = response
      return {
        code: (statusCode: number) => {
          code = statusCode
        }
      }
    }
  }
  // Sometimes the handlers call `h.response().code()`, but if they return directly,
  // we should capture the direct response.
  const directResponse = await asyncFunction(nestedReply)
  if (directResponse) {
    // Default when everything went well!
    let code = 200
    if (directResponse.httpStatusCode) {
      code = directResponse.httpStatusCode
    }

    // On error the body isn't that useful, so return the message.
    if (code > 300) {
      body = directResponse.message
    } else {
      body = directResponse
    }
    return {
      body,
      code
    }
  }

  return {
    body,
    code
  }
}



export const unwrapResponseWithError = async (asyncFunction: (reply: any) => any) => {
  try {
    return await unwrapResponse(asyncFunction)
  } catch (err: any) {
    // Handle FSPIOP errors
    if (err.httpStatusCode && typeof err.toApiErrorObject === 'function') {
      return {
        responseBody: err.toApiErrorObject({ includeCauseExtension: false, truncateExtensions: false }),
        responseCode: err.httpStatusCode
      }
    }
    // Re-throw unexpected errors
    throw err
  }
}


// Re-typing this here so we don't need to import from ParticipantService
type GetAccountsResponseAccount = {
  id: number,
  value: string;
  reservedValue: string;
}

/**
 * Assert that the position account for the DFSP changed as expected.
 */
export const assertPositionDiff = (
  role: 'payer' | 'payee',
  start: GetAccountsResponseAccount,
  end: GetAccountsResponseAccount,
  diff: {
    pending?: number
    posted?: number,
  }
) => {
  assert(start)
  assert(start.value)
  assert(start.reservedValue)
  assert(end)
  assert(end.value)
  assert(end.reservedValue)
  assert(start.id === end.id, 'Did you get the accounts mixed up?')

  if (!diff.pending) {
    diff.pending = 0
  }
  if (!diff.posted) {
    diff.posted = 0
  }

  const valuePostedStart = Number.parseFloat(start.value)
  const valuePendingStart = Number.parseFloat(start.reservedValue)

  const endExpected: GetAccountsResponseAccount = {
    id: start.id,
    reservedValue: (valuePendingStart + diff.pending).toFixed(4),
    value: (valuePostedStart + diff.posted).toFixed(4)
  }

  const expectedStr = prettyPrintPosition(role, start, endExpected)
  const actualStr = prettyPrintPosition(role, start, end)

  Snapshot.from(expectedStr, { stripWhitespace: false, updateable: false })
    .checkStringUnwrap(actualStr)
}

export const prettyPrintPosition = (
  role: 'payer' | 'payee', 
  start: GetAccountsResponseAccount,
  end: GetAccountsResponseAccount,
) => {
  const lenColumns = 15
  return `
  ${role}   | ${'start'.padEnd(lenColumns)}| ${'end'.padEnd(lenColumns)}
  pending | ${start.reservedValue.padEnd(lenColumns)}| ${end.reservedValue.padEnd(lenColumns)}
  posted  | ${start.value.padEnd(lenColumns)}| ${end.value.padEnd(lenColumns)}`
}


/**
 * @description Returns a date a specified amount of time in the future.
 */
export const futureDate = (
  amount: number, 
  unit: 'ms' | 's' | 'm' | 'h' | 'd' = 'ms', 
  now: Date = new Date(),
): Date => {
  assert(amount > 0, `Invalid amount: ${amount}.`)
  if (Number.isNaN(now.getTime())) {
    throw new Error(`now must be a valid date.`)
  }
  let multiplier = 1
  switch (unit) {
    case 'ms': 
      multiplier = 1;
      break;
    case 's': 
      multiplier = 1000;
      break;
    case 'm':
      multiplier = 1000 * 60;
      break;
    case 'h':
      multiplier = 1000 * 60 * 60;
      break;
    case 'd':
      multiplier = 1000 * 60 * 60 * 24;
      break;
    default:
      throw new Error(`unit must be one of: 'ms' | 's' | 'm' | 'h' | 'd'`)
  }
  const msToJump = Math.floor(amount * multiplier)
  const then = new Date(now.getTime() + msToJump)

  return then
}

export function envOrDefaultNumber(envName: string, backup: number): number {
  assert(envName)
  assert(backup !== undefined && backup !== null )
  assert(typeof envName === 'string')
  assert(typeof backup === 'number')

  let envString = process.env[envName]
  if (Array.isArray(envString)) {
    envString = envString[0]
  }
  
  if (envString) {
    return Number.parseInt(envString)
  }

  return backup
}

export function envOrDefaultString(envName: string, backup: string): string {
  assert(envName)
  assert(backup !== undefined && backup !== null)
  assert(typeof envName === 'string')
  assert(typeof backup === 'string')

  let envString = process.env[envName]
  if (Array.isArray(envString)) {
    envString = envString[0]
  }

  if (envString) {
    return envString
  }

  return backup
}

/**
 * Remove / and _ from a test name, to make it a valid directory name.
 */
export function sanitizeTestName(name: string): string {
  return name.replaceAll(' ', '_')
    .replaceAll('/', '_')
}