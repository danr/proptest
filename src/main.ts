import * as Utils from './Utils'
import {Tree} from './Tree'
import {Gen, shrink_number} from './Gen'
export {Gen, Tree}

export type TestDetails = {covers: Covers; stamps: Stamps; last_log: any[][]; tests: number}
export type CoverData = {req: number; hit: number; miss: number}
export type Covers = Record<string, CoverData>
export type Stamps = Record<string, number>

export function expand_cover_data(data: CoverData) {
  const N = data.hit + data.miss
  const ratio = data.hit * 1.0 / N
  const pct = 100 * ratio
  return {N, ratio, pct}
}

export type TestResult<A> = TestDetails &
  (
    | {ok: true; expectedFailure?: TestResult<A>}
    | {ok: false; reason: 'counterexample'; counterexample: A; shrinks: number}
    | {ok: false; reason: 'insufficient coverage'; label: string}
    | {ok: false; reason: 'exception'; exception: any; when: 'generating' | 'evaluating'}
    | {ok: false; reason: 'unexpected success'})

const leftpad = (i: number, s: string) =>
  Utils.range(i - s.length)
    .map(_ => ' ')
    .join('') + s

const pct = (i: number) => leftpad(3, '' + Math.round(i)) + '%'

export function PrintTestDetails(details: TestDetails) {
  details.last_log.forEach(objs => console.log(...objs))

  Utils.record_traverse(details.stamps, (occs, stamp) => ({occs, stamp}))
    .sort((x, y) => y.occs - x.occs)
    .map(({occs, stamp}) => console.log(pct(100 * occs / details.tests), stamp))

  Utils.record_forEach(details.covers, (data, label) => {
    const expanded = expand_cover_data(data)
    console.log(pct(expanded.pct), '/' + pct(data.req), ' ', label)
  })
}

export function PrintTestResult(result: TestResult<any>, verbose: boolean=false) {
  if (result.ok) {
    if (result.expectedFailure) {
      console.log(`Ok, failing as expected:`)
      PrintTestResult(result.expectedFailure, verbose)
      console.log(`(expected failure)`)
    } else {
      verbose && PrintTestDetails(result)
      console.log(`Ok, passed ${result.tests} tests.`)
    }
  } else {
    PrintTestDetails(result)
    switch (result.reason) {
      case 'counterexample':
        console.log(
          `Counterexample found after ${result.tests} tests and ${result.shrinks} shrinks:`
        )
        console.log(result.counterexample)
        return
      case 'exception':
        console.log(`Exception when ${result.when} after ${result.tests}:`)
        console.log(result.exception)
        return
      case 'insufficient coverage':
        console.log(`Insufficient coverage for label ${result.label}`)
        return

      case 'unexpected success':
        console.log(`Unexpected success in presence of expectFailure`)
        return

      default:
        const _: never = result
    }
  }
}

interface Property {
  cover(pred: boolean, required_percentage: number, label: string): void
  fail(msg: any): void
  label(stamp: string | any): void
  log(...msg: any[]): void
}

function succ(x: Record<string, number>, s: string) {
  x[s] = (x[s] || (x[s] = 0)) + 1
}

const serialize = (s: any) => (typeof s == 'string' ? s : JSON.stringify(s))

function Property() {
  let last_log: any[][] = []
  let last_stamps: Record<string, boolean> = {}
  const stamps: Record<string, number> = {}
  let last_cover: Record<string, boolean> = {}
  const cover_req: Record<string, number> = {}
  const cover_hit: Record<string, number> = {}
  const cover_miss: Record<string, number> = {}
  let sealed: boolean = false

  return {
    api: {
      log(...msg) {
        last_log.push(msg)
      },
      label(stamp) {
        last_stamps[serialize(stamp)] = true
      },
      cover(pred, req, label) {
        const req0 = cover_req[label]
        if (req0 !== undefined && req0 != req) {
          throw `Different coverage requirements for ${label}: ${req0} and ${req}`
        }
        if (last_cover[label]) {
          throw `Label already registered: ${label}`
        }
        last_cover[label] = true
        cover_req[label] = req
        if (pred) {
          succ(cover_hit, label)
        } else {
          succ(cover_miss, label)
        }
      },
      fail(msg) {
        throw msg
      },
    } as Property,
    round<A>(f: () => A): A {
      last_log = []
      last_stamps = {}
      last_cover = {}
      const res = f()
      Utils.record_forEach(last_stamps, (b, stamp) => b && succ(stamps, stamp))
      return res
    },
    test_details(tests: number): TestDetails {
      return {
        stamps,
        last_log,
        covers: Utils.record_map(cover_req, (req, label) => ({
          req,
          hit: cover_hit[label],
          miss: cover_miss[label],
        })),
        tests,
      }
    },
  }
}

export const default_options = {
  tests: 100,
  maxShrinks: 1000,
  seed: 43 as number | undefined,
  expectFailure: false,
  verbose: false
}

export function option(opts: Partial<typeof default_options>): typeof default_options {
  return {...default_options, ...opts}
}

export function qc<A>(
  g: Gen<A>,
  prop: (a: A, p: Property) => boolean,
  options = default_options
): boolean {
  const res = QuickCheck(g, prop, options)
  if (!res.ok) {
    PrintTestResult(res)
  }
  return res.ok
}

type Tape = (name: string, cb: (t: {true(x: any): void, end(): void}) => void) => void

export function tape_adapter(test: Tape): <A>(
  name: string,
  g: Gen<A>,
  prop: (a: A, p: Property) => boolean,
  options?: typeof default_options
) => void {
  return (name, g, prop, options) => test(name, t => (t.true(qc(g, prop, options)), t.end()))
}

export function QuickCheck<A>(
  g: Gen<A>,
  prop: (a: A, p: Property) => boolean,
  options = default_options
): TestResult<A> {
  const p = Property()
  function ret(res: TestResult<A>): TestResult<A> {
    if (options.expectFailure) {
      if (res.ok) {
        return {...res, ok: false, reason: 'unexpected success'}
      } else {
        return {...res, ok: true, expectedFailure: res}
      }
    } else {
      return res
    }
  }
  for (let tests = 0; tests < options.tests; ++tests) {
    let t0
    try {
      t0 = g.sampleWithShrinks(tests % 100, options.seed)
    } catch (exception) {
      return ret({
        ok: false,
        reason: 'exception',
        exception,
        when: 'generating',
        ...p.test_details(tests),
      })
    }
    const t = t0.map((counterexample, shrinks) => ({counterexample, shrinks}))
    let failtree: typeof t | undefined
    const prop_ = (a: typeof t.top) => p.round(() => !prop(a.counterexample, p.api))
    try {
      failtree = t.left_first_search(prop_, options.maxShrinks)
    } catch (exception) {
      return ret({
        ok: false,
        reason: 'exception',
        exception,
        when: 'evaluating',
        ...p.test_details(tests),
      })
    }
    if (failtree) {
      return ret({ok: false, reason: 'counterexample', ...failtree.top, ...p.test_details(tests)})
    }
  }
  const test_details = p.test_details(options.tests)
  for (const {data, label} of Utils.record_traverse(test_details.covers, (data, label) => ({
    data,
    label,
  }))) {
    const expanded = expand_cover_data(data)
    if (expanded.pct < data.req) {
      return ret({ok: false, reason: 'insufficient coverage', label, ...test_details})
    }
  }
  return ret({ok: true, ...test_details})
}

/*
const [tree, pure] = [Tree.tree$, Tree.pure]

declare var require: Function
const pp = require('json-stringify-pretty-compact') as (s: any) => string
const log = (...s: any[]) => {
  console.dir(s, {depth: null, colors: true})
}

log(
  QuickCheck(Gen.record({a: Gen.range(0, 100000), b: Gen.range(0, 100000)}),
    ({a, b}) => a * b < 1814 || a < b // tricky
  )
)

log(
  QuickCheck(Gen.record({a: Gen.range(0, 10000), b: Gen.range(0, 10000)}),
    ({a, b}) => a * b < 1814 || a < b
  )
)

log(
  QuickCheck(Gen.record({a: Gen.range(0, 1000), b: Gen.range(0, 1000)}),
    ({a, b}, p) => (p.label('a even', a % 2 == 0), a * b < 1814 || a < b)
  )
)

log(
  QuickCheck(replicate(10, Gen.range(0, 1250)), xs => {
    const sum = xs.reduce((a, b) => a + b, 0)
    // log({xs, sum})
    return ret(sum < 9000)
  })
)

log(
  QuickCheck(Gen.range(0, 20).then(i => replicate(i, Gen.range(0, 1250))), (xs, p) => {
    const sum = xs.reduce((a, b) => a + b, 0)
    p.label(sum)
    p.label(xs)
    p.cover(xs.length > 10, 50, 'non-trivial')
    // log({xs, sum})
    return ret(sum < 9000)
  })
)

log(Tree.dist({a: shrink_number(4), b: shrink_number(2), c: shrink_number(1)}).force(2))
log(Tree.dist_array([shrink_number(4), shrink_number(2), shrink_number(1)]).force(2))
log(
  shrink_number(4)
    .fair_pair(shrink_number(2))
    .force(2)
)
log(shrink_number(-18.2, 8.1).force(1))
log(shrink_number(2.5).force(2))
log({a: 1}.toString())
*/
