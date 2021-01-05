'use strict'

const time = Date.now() * 1e3 // Program start time in microseconds
const start = process.hrtime() // Program start hrtime used to calculate running time

module.exports.now = function () {
  const diff = process.hrtime(start) // Amount of time application has been running for betwwen start and now
  return time + diff[0] * 1e6 + Math.round(diff[1] * 1e-3) // diff[0] is seconds, diff[1] is nanos
}
