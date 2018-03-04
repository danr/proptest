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

export interface TestCase {
  true(x: any): void
  end(): void
}

/** Adapt tape using forall_stdout */
export function adaptTape(
  test: (name: string, cb: (t: TestCase) => void) => void
): <A>(name: string, g: Gen<A>, prop: (a: A, p: Property) => boolean, options?: Options) => void {
  return (name, g, prop, options) =>
    test(name, t => (t.true(stdoutForall(g, prop, options)), t.end()))
}
