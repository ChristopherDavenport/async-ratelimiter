'use strict'

const assert = require('assert')

const microtime = require('./microtime')

// String to number in base10
const toNumber = str => parseInt(str, 10)

module.exports = class Limiter {
  // max: The maximum number of requests within duration.
  // duration: How long keep records of requests in milliseconds.
  // namespace: The prefix used for compound the key.
  constructor ({ id, db, max = 2500, duration = 3600000, namespace = 'limit' }) {
    assert(db, 'db required')
    this.db = db
    this.id = id
    this.max = max
    this.duration = duration
    this.namespace = namespace
  }

  async get ({
    id = this.id,
    max = this.max,
    duration = this.duration,
    decrease = true
  } = {}) {
    assert(id, 'id required')
    assert(max, 'max required')
    assert(duration, 'duration required')

    const key = `${this.namespace}:${id}` // compound key
    const now = microtime.now() // current time in microseconds since 

    // what position to drop all entries before current microseconds 
    // converted to microseconds
    const start = now - duration * 1000 - duration 

    const operations = [
      ['zremrangebyscore', key, 0, start], // removes all entries before start period, guarantees removal of expired keys
      ['zcard', key], // count
      // zadd spliced into this position
      ['zrange', key, 0, 0], // oldest -  first element in the set
      ['zrange', key, -max, -max], // oldestInRange - n elements that are within the set, 
      // gets the element at last position allowed in size by max 
      ['pexpire', key, duration] // Expire within redis even if unaccessed
    ]

    if (decrease) operations.splice(2, 0, ['zadd', key, now, now])

    const res = await this.db.multi(operations).exec()
   
    const count = toNumber(res[1][1])
    const oldest = toNumber(res[decrease ? 3 : 2][1])
    const oldestInRange = toNumber(res[decrease ? 4 : 3][1])
    const resetMicro = // ? If there are not more than max elements then return oldest
      // otherwise return element at position oldest in range whix is the maximum size of entries
      // Rate limiting period will end at duration length from that point
      (Number.isNaN(oldestInRange) ? oldest : oldestInRange) + duration * 1000

    return {
      remaining: count < max ? max - count : 0,
      reset: Math.floor(resetMicro / 1000000),
      total: max
    }
  }
}
