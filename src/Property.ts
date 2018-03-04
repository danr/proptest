import * as Utils from './Utils'
import {Tree} from './Tree'
import {Gen} from './Gen'

export type TestDetails = {
  covers: Covers
  stamps: Stamps
  last_log: any[][]
  tests: number
}
export type CoverData = {req: number; hit: number; miss: number}
export type Covers = Record<string, CoverData>
export type Stamps = Record<string, number>

export function expand_cover_data(data: CoverData) {
  const N = data.hit + data.miss
  const ratio = data.hit * 1.0 / N
  const pct = 100 * ratio
  return {N, ratio, pct}
}

export type SearchResult<A> = TestDetails &
  (
    | {ok: true; expectedFailure?: SearchResult<A>}
    | {ok: false; reason: 'counterexample'; counterexample: A; shrinks: number}
    | {ok: false; reason: 'insufficient coverage'; label: string}
    | {
        ok: false
        reason: 'exception'
        exception: any
        when: 'generating' | 'evaluating'
        counterexample?: A
      }
    | {ok: false; reason: 'unexpected success'})

export function Format(verbose: boolean = false, log: (...objs: any[]) => void) {
  return {
    Stamps(details: TestDetails) {
      Utils.record_traverse(details.stamps, (occs, stamp) => ({occs, stamp}))
        .sort((x, y) => y.occs - x.occs)
        .map(({occs, stamp}) => log(Utils.pct(100 * occs / details.tests), stamp))
    },
    LastLog(details: TestDetails) {
      details.last_log.forEach(objs => log(...objs))
    },
    Covers(details: TestDetails) {
      Utils.record_forEach(details.covers, (data, label) => {
        const expanded = expand_cover_data(data)
        log(Utils.pct(expanded.pct), '/' + Utils.pct(data.req), ' ', label)
      })
    },
    SearchResult(result: SearchResult<any>) {
      if (result.ok) {
        if (result.expectedFailure) {
          log(`Ok, failing as expected:`)
          this.SearchResult(result.expectedFailure)
          log(`(expected failure)`)
        } else {
          verbose && this.Covers(result)
          this.Stamps(result)
          log(`Ok, passed ${result.tests} tests.`)
        }
      } else {
        verbose && this.Stamps(result)
        verbose && this.Covers(result)
        this.LastLog(result)
        switch (result.reason) {
          case 'counterexample':
            log(`Counterexample found after ${result.tests} tests and ${result.shrinks} shrinks:`)
            log(Utils.show(result.counterexample))
            return
          case 'exception':
            log(`Exception when ${result.when} after ${result.tests}:`)
            log(result.exception)
            if (result.counterexample) {
              log(`Exception occured with this input:`)
              log(Utils.show(result.counterexample))
            }
            return
          case 'insufficient coverage':
            verbose || this.Covers(result)
            log(`Insufficient coverage for label ${result.label}`)
            return

          case 'unexpected success':
            log(`Unexpected success in presence of expectFailure`)
            return

          default:
            const _: never = result
        }
      }
    },
  }
}

export const Stdout = (verbose: boolean) => Format(verbose, (...msg) => console.log(...msg))
export const Write = (verbose: boolean) => {
  const messages: any[][] = []
  return {
    ...Format(verbose, (...msg) => messages.push(msg)),
    messages,
  }
}

export interface Property {
  deepEquals(lhs: any, rhs: any): boolean
  cover(pred: boolean, required_percentage: number, label: string): void
  fail(msg: any): void
  label(stamp: string | any): void
  log(...msg: any[]): void
  tap<A>(x: A, msg?: string): A
}

function initProperty() {
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
      tap(x, msg) {
        msg && last_log.push([msg, Utils.show(x)])
        msg || last_log.push([Utils.show(x)])
        return x
      },
      log(...msg) {
        last_log.push(msg)
      },
      label(stamp) {
        last_stamps[Utils.serialize(stamp)] = true
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
          Utils.succ(cover_hit, label)
        } else {
          Utils.succ(cover_miss, label)
        }
      },
      fail(msg) {
        throw msg
      },
      deepEquals(lhs, rhs) {
        const e = Utils.deepEquals(lhs, rhs)
        if (!e) {
          this.log('Not deeply equal:')
          const a = Utils.show(lhs)
          const b = Utils.show(rhs)
          if (-1 != a.indexOf('\n') || -1 != b.indexOf('\n')) {
            this.log(a + '\n!=\n' + b)
          } else {
            this.log(a + ' != ' + b)
          }
        }
        return e
      },
    } as Property,
    round(f: () => boolean): boolean {
      const init_log = last_log
      last_log = []
      last_stamps = {}
      last_cover = {}
      const res = f()
      Utils.record_forEach(last_stamps, (b, stamp) => b && Utils.succ(stamps, stamp))
      if (!res) {
        last_log = init_log
      }
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
  maxShrinks: 100,
  seed: 43 as number | undefined,
  expectFailure: false,
  verbose: false,
}

export type Options = typeof default_options

/** Searches for a counterexample and returns as most information as possible. */
export function search<A>(
  g: Gen<A>,
  prop: (a: A, p: Property) => boolean,
  options = default_options
): SearchResult<A> {
  const p = initProperty()
  const not_ok = {ok: false as false}
  function ret(res: SearchResult<A>): SearchResult<A> {
    if (options.expectFailure) {
      if (res.ok) {
        const {expectedFailure, ...rest} = res
        return {...rest, ...not_ok, reason: 'unexpected success'}
      } else {
        return {...res, ok: true, expectedFailure: res}
      }
    } else {
      return res
    }
  }
  for (let tests = 0; tests < options.tests; ++tests) {
    let t: Tree<A>
    try {
      t = g.sampleWithShrinks(
        tests % 100,
        options.seed === undefined ? undefined : tests + options.seed
      )
    } catch (exception) {
      return ret({
        ...not_ok,
        reason: 'exception',
        exception,
        when: 'generating',
        ...p.test_details(tests),
      })
    }
    let current: A | undefined = undefined
    const prop_ = (a: typeof t.top) => p.round(() => ((current = a), !prop(a, p.api)))
    try {
      const failtree = t.left_first_search(prop_, options.maxShrinks)
      if (failtree) {
        const shrinks =
          options.maxShrinks == -1 ? -failtree.fuel : options.maxShrinks - failtree.fuel
        return ret({
          ...not_ok,
          reason: 'counterexample',
          counterexample: failtree.tree.top,
          shrinks,
          ...p.test_details(tests),
        })
      }
    } catch (exception) {
      return ret({
        ...not_ok,
        reason: 'exception',
        exception,
        when: 'evaluating',
        counterexample: current,
        ...p.test_details(tests),
      })
    }
  }
  const test_details = p.test_details(options.tests)
  for (const {data, label} of Utils.record_traverse(test_details.covers, (data, label) => ({
    data,
    label,
  }))) {
    const expanded = expand_cover_data(data)
    if (expanded.pct < data.req) {
      return ret({
        ...not_ok,
        reason: 'insufficient coverage',
        label,
        ...test_details,
      })
    }
  }
  return ret({ok: true, ...test_details})
}

export function search_then<R>(
  then: <A>(a: SearchResult<A>, options: Options) => R
): <A>(g: Gen<A>, prop: (a: A, p: Property) => boolean, options?: Options) => R {
  return (g, prop, options) => then(search(g, prop, options), options || default_options)
}
