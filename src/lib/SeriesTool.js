const { performance } = require('perf_hooks')

class SeriesTool {
  constructor (id) {
    this.id = id
    this.dataPoints = []
    this.delayedDisplayTriggered = false
  }

  addDatapoint (x) {
    this.dataPoints.push(x)
    this.triggerDisplay()
  }

  displayStats () {
    const stats = {
      sum: 0,
      cnt: 0
    }
    this.dataPoints.forEach((point) => {
      stats.sum += point
      stats.cnt++
    })
    stats.avg = stats.sum / stats.cnt
    console.log(this.id, stats)
  }

  triggerDisplay () {
    if (!this.delayedDisplayTriggered) {
      this.delayedDisplayTriggered = true
      setTimeout(() => {
        this.delayedDisplayTriggered = false
        this.displayStats()
      },
      4000
      )
    }
  }
}

const mangleExports = (prefix, oldExports) => {
  const newExports = {}
  const timings = {}
  for (const methodName in oldExports) {
    const key = prefix + '::' + methodName
    console.log(key)
    timings[key] = new SeriesTool(key)
    newExports[methodName] = async (...args) => {
      console.log(key)
      const tick = performance.now()
      const rv = await oldExports[methodName](...args)
      const toe = performance.now()
      timings[key].addDatapoint(toe - tick)
      return rv
    }
  }
  return newExports
}


module.exports = {
  SeriesTool,
  mangleExports
}
