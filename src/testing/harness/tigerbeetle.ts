
import assert from "assert"
import { execAsync } from "../exec-async"
import Logger from "@mojaloop/central-services-logger"
import { randomAvailablePort } from "../util"
import { DependencyOptions } from "./harness";
import path from "node:path";
import fs, { createWriteStream, unlink } from "node:fs"
import crypto from "node:crypto";
import { Transform } from "node:stream";
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { ChildProcess, spawn } from "node:child_process";

const logger = Logger.child({ scope: 'harness' }) 

interface DependencyOptionsTigerBeetle extends DependencyOptions {
  pathToBinary: string,
  dataDir: string,
  version: string
}

interface ConnectionOptionsTigerBeetle {
  port: number,
}

/**
 * @class TigerBeetle
 * @description Runs a single replica tigerbeetle cluster from the binary. If no binary is found,
 *   downloads the binary from https://github.com/tigerbeetle/tigerbeetle/releases 
 */
export class TigerBeetle {
  private logger = logger.child({ scope: 'Redis' })
  private _connectionOptions: ConnectionOptionsTigerBeetle | null = null
  private pathToBinary: string
  private dataFileName: string
  private pathToDataFile: string
  private child: ChildProcess | null = null

  private readonly releases = [
    {
      url: 'https://github.com/tigerbeetle/tigerbeetle/releases/download/0.17.9/tigerbeetle-aarch64-linux.zip',
      checksum: '413994920fe48b04f5aa86895b7a1d9d98d14803b29d4e91d2a6d0098fff4ef2',
    },
    {
      url: 'https://github.com/tigerbeetle/tigerbeetle/releases/download/0.17.9/tigerbeetle-universal-macos.zip',
      checksum: '4e085eaffc66c2ed82e7f94a8137c468256d2fb0b35152ccf903cc6676c22940'
    },
    {
      url: 'https://github.com/tigerbeetle/tigerbeetle/releases/download/0.17.9/tigerbeetle-x86_64-linux.zip',
      checksum: 'af71f2c0057e3b409bf79940fa94894b738187b0d4f1e711097bca15df5d8cd4',
    },
    {
      url: 'https://github.com/tigerbeetle/tigerbeetle/releases/download/0.17.9/tigerbeetle-x86_64-windows.zip',
      checksum: 'aaac96a69380b33a0e63f981635c24924d610f28c3f41637f9e57b8caa0e5e77'
    }
  ]
  
  constructor (private options: DependencyOptionsTigerBeetle) {
    assert(options)
    assert(options.harnessId)
    assert(options.pathToBinary)

    if (options.version !== '0.17.9') {
      throw new Error(`Currently only TigerBeetle verion '0.17.9' is supported.`)
    }

    this.dataFileName = `0_0.${options.harnessId}.tigerbeetle`
    this.pathToDataFile = path.join(this.options.dataDir, this.dataFileName)
    this.pathToBinary = options.pathToBinary
  }

  public async up(): Promise<void> {
    const timerStart = performance.now()
    this.logger.debug(`up()`)
    const port = await randomAvailablePort()

    await this.checkBinaryOrDownload()
    await this.createDataFileIfNotExists()

    this.logger.info(`TigerBeetle starting at localhost:${port}`)
    this.logger.debug(`$ ${this.pathToBinary} start --addresses=${port} ${this.pathToDataFile}`)
    this.child = spawn(this.pathToBinary, [
      'start',
      `--addresses=${port}`,
      this.pathToDataFile
    ], {
      stdio: 'ignore',
      detached: false
    })

    this._connectionOptions = { port }
    const timerEnd = performance.now()
    this.logger.info(`up() - took: ${Math.floor(timerEnd - timerStart)}ms`)
  }

  get connectionOptions() {
    if (!this._connectionOptions) {
      throw new Error(`Connection options not defined. Have you called up()?`)
    }
    return this._connectionOptions
  }

  public async down(): Promise<void> {
    // Kill the TigerBeetle Process.
    if (this.child) {
      await new Promise<void>(resolve => {
        if (!this.child) return

        this.child.on('exit', () => resolve())
        this.child.kill('SIGTERM')
      })
      this.child = null
    }

    // Clean up the datafile.
    fs.rmSync(this.pathToDataFile, { force: true})
  }

  private async checkBinaryOrDownload(): Promise<void> {
    const dir = path.dirname(this.pathToBinary)
    fs.mkdirSync(dir, {recursive: true})
    const stats = fs.statSync(this.pathToBinary, { throwIfNoEntry: false })
    if (stats) {
      // We have a TigerBeetle binary. 
      return
    }

    const release = this.getRelease()
    await this.downloadRelease(release.url, this.pathToBinary, release.checksum)
  } 

  private async createDataFileIfNotExists(): Promise<void> {
    fs.mkdirSync(this.options.dataDir, {recursive: true})
    const stats = fs.statSync(this.pathToDataFile, { throwIfNoEntry: false })
    if (stats) {
      this.logger.info(`createDataFileIfNotExists() - datafile exists at ${this.options.dataDir}.`)
      // Data file already exists. Don't do anything.
      return
    }

    this.logger.info(`createDataFileIfNotExists() - no datafile found at ${this.options.dataDir}. ` 
      + `Creating a new one with\n`
      + `'tigerbeetle format --cluster=0 --replica=0 --replia-count=1 --development ${this.pathToDataFile}'.`)
    await execAsync(`${this.pathToBinary} format --cluster=0 `+
      `--replica=0 --replica-count=1 --development ${this.pathToDataFile}`
    )
  }

  private async downloadRelease(url: string, to: string, checksum: string): Promise<void> {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`downloadRelease() failed with error: ${response.status}.`)
    }
    const hash = crypto.createHash('sha256')
    const hashTransform = new Transform({
      transform(chunk, encoding, callback ) {
        hash.update(chunk)
        callback(null, chunk)
      }
    })

    assert(response.body, 'Expected response.body to be defined.')

    // Download while calculating the hash as we go.
    const toZip = to + '.zip'
    await pipeline(
      Readable.fromWeb(response.body),
      hashTransform,
      createWriteStream(toZip)
    )
    const hashFound = hash.digest('hex')
    if (hashFound !== checksum) {
      fs.unlinkSync(to)
      throw new Error(`downloadRelease() checksum mismatch. Expected: ${checksum}, got ${hashFound}.`)
    }

    // Extract zip.
    const destDir = path.dirname(to)
    await execAsync(`unzip -o "${toZip}" tigerbeetle -d "${destDir}"`)
    fs.unlinkSync(toZip)

    // Make executable.
    fs.chmodSync(to, '0755')
  }

  private getRelease(): { url: string, checksum: string} {
    let suffix = ''
    switch (process.arch) {
      case "arm":
      case "arm64":
        switch (process.platform) {
          case "darwin":
            suffix = 'universal-macos.zip'
            break;
          case "linux":
            suffix = 'aarch64-linux.zip'
            break;
          default:
            throw new Error(`getRelease() unsupported arch: ${process.arch} + platform: ${process.platform}`)        
        } 
        break;
      case "x64":
        switch (process.platform) {
          case "darwin":
            suffix = 'universal-macos.zip'
            break;
          case "linux":
            suffix = 'x86_64-linux.zip'
            break;
          case "win32": 
            suffix = 'x86_64-windows.zip'
          default:
            throw new Error(`getRelease() unsupported arch: ${process.arch} + platform: ${process.platform}`)
        }
        break;
      default:
        throw new Error(`getRelease() unsupported arch: ${process.arch}`)        
    }

    assert(suffix)  
    const filtered = this.releases.find(release => release.url.endsWith(suffix))
    assert(filtered, `No release found in list for ${suffix}`)

    return filtered
  }
}
