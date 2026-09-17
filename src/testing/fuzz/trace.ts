import { isDeepStrictEqual } from "node:util"
import { logger } from "../../shared/logger"

export type TraceItem = {
  step: number,
  action: string,
  path: string,
  payload: any,
  code: number
  body: any
  prngCalls: number
}

export default class Trace {
  public inner: Array<TraceItem> = []

  public push(item: TraceItem): void {
    this.inner.push(item)
  }
  
  public compare(other: Trace, options: {nameLeft: string, nameRight: string}) {
    let lengthMin = Math.min(this.inner.length, other.inner.length)
    if (this.inner.length !== other.inner.length) {
      logger.warn(`compare() length mismatch - left: ${this.inner.length} right: ${other.inner.length}`)
    }
    if (lengthMin === 0) {
      throw new Error('Empty trace.')
    }

    for (let idx = 0; idx < lengthMin; idx++) {
      const itemLeft = this.inner[idx]
      const itemRight = other.inner[idx]

      if (!isDeepStrictEqual(itemLeft, itemRight)) {
        logger.warn(`compare() traces drifted at idx: ${idx}.`)
        // Get up to the last 5 elements for context.
        const lastNLeft = this.inner.slice(Math.max(0, idx - 4), idx + 1)
        const lastNRight = other.inner.slice(Math.max(0, idx - 4), idx + 1)

        this.printSideBySide(lastNLeft, lastNRight, options)

        throw new Error(`compare() traces mismatched at step: ${idx + 1}.`)
      }
    }
  }

  private printSideBySide(left: Array<TraceItem>, right: Array<TraceItem>, options: { nameLeft: string, nameRight: string }) {
    const BG_YELLOW = '\x1b[43m'
    const RESET = '\x1b[0m'

    let maxWidth = 200
    const strLeft = this.formatItems(left)
    const strRight = this.formatItems(right)

    const linesLeft = strLeft.split('\n')
    const linesRight = strRight.split('\n')

    let maxLineWidth = linesLeft.reduce((acc, curr) => {
      if (curr.length > acc) return curr.length
      return acc
    }, 56)
    let maxLines = Math.max(linesLeft.length, linesRight.length)
    if (maxLineWidth > maxWidth) {
      logger.warn(`printSideBySide() maxLineWidth: ${maxLineWidth} capping at 200.`)
      maxLineWidth = maxWidth
    }

    let builder = `left(${options.nameLeft})`.padEnd(maxLineWidth)
    builder += `|` + `right(${options.nameRight})`.padEnd(maxLineWidth) + '\n'
    for (let idx = 0; idx < maxLines; idx++) {
      const left = linesLeft[idx] || ``
      const right = linesRight[idx] || ``

      let open = ''
      let close = ''
      if (left !== right) {
        open = BG_YELLOW
        close = RESET
      }
      
      builder += open
      builder += left.slice(0, maxLineWidth).padEnd(maxLineWidth)
      builder += `|`
      builder += right
      builder += close
      builder += `\n`
    }

    console.log(builder)
  }

  private formatItems(items: Array<TraceItem>): string {
    return items
      .map(item => {
        return [
          `${item.step}`,
          `${item.action}:`,
          `path=${item.path}`,
          `payload=${JSON.stringify(item.payload)}`,
          `body=${JSON.stringify(item.body, null, 2)}`,
          `prngCalls=${item.prngCalls}`,
          `-----`
        ].join('\n')
      })
      .join('\n')
  }

  public toString(): string {
    return this.inner
      .map(item => {
        return [
          `${item.step}`,
          `${item.action}:`,
          `\tpath=${item.path}`,
          `\tpayload=${JSON.stringify(item.payload)}`,
          `\tbody=${JSON.stringify(item.body, null, 2)}`,
          `\tprngCalls=${item.prngCalls}`,
        ].join('\n')
      })
      .join('\n')
  }
}
