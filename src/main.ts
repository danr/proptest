import * as Utils from './Utils'

import * as P from './Property'
import {Property, Options, search, searchAndThen} from './Property'
export {Property, Options, search, searchAndThen}

import {Gen} from './Gen'
export {Gen}
export * from './Gen'

export function option(opts: Partial<Options>): Options {
  return {...P.default_options, ...opts}
}

export const expectFailure = option({expectFailure: true})
export const verbose = option({verbose: true})
export const randomSeed = option({seed: undefined})

/** Searches for a counterexample and prints it on stdout if it is found.

Returns whether a counterexample was found. */
export const stdoutForall = searchAndThen((res, options) => {
  if (!res.ok) {
    P.Stdout(options.verbose).SearchResult(res)
  }
  return res.ok
})

/** Searches for a counterexample and throws an error if one is found */
export const forall = searchAndThen((res, options) => {
  if (!res.ok) {
    const w = P.Write(options.verbose)
    w.SearchResult(res)
    throw new Error(w.messages.map(xs => xs.join(' ')).join('\n'))
  }
})

/** Searches for a counterexample and returns it as a string if found */
export const forallStrings = searchAndThen((res, options) => {
  const w = P.Write(options.verbose)
  w.SearchResult(res)
  return {ok: res.ok, messages: w.messages.map(xs => xs.join(' '))}
})

export interface TapeTest {
  pass(msg: string): void
  fail(msg: string): void
  comment(msg: string): void
  end(): void
}

/** Adapt tape using forall_stdout */
export function adaptTape(
  test: (name: string, cb: (t: TapeTest) => void) => void
): <A>(name: string, g: Gen<A>, prop: (a: A, p: Property) => boolean, options?: Options) => void {
  return (name, g, prop, options) =>
    test(name, t => {
      const res = forallStrings(g, prop, options)
      const [head, ...tail] = res.messages
      if (res.ok) {
        options && options.verbose && tail.forEach(msg => (t as any).comment(msg))
        t.pass(head)
      }
      if (!res.ok) {
        tail.forEach(msg => t.comment(msg))
        t.fail(name + ': ' + head)
      }
      t.end()
    })
}
