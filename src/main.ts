import * as Utils from './Utils'

import * as P from './Property'
import {Property, Options, search, searchAsync, searchAndThen, searchAndThenAsync} from './Property'
export {Property, Options, search, searchAsync, searchAndThen, searchAndThenAsync}

import {Gen} from './Gen'
export {Gen}
export * from './Gen'

export const expectFailure: Partial<Options> = {expectFailure: true}
export const randomSeed: Partial<Options> = {seed: undefined}
export const seed = (seed: number): Partial<Options> => ({seed})
export const tests = (tests: number): Partial<Options> => ({tests})
export const maxShrinks = (maxShrinks: number): Partial<Options> => ({maxShrinks})

/** Searches for a counterexample and prints it on stdout if it is found.

Returns whether a counterexample was found.

TODO: Remove in favour of forallStrings? */
export const stdoutForall = searchAndThen(res => {
  if (!res.ok) {
    P.Stdout.SearchResult(res)
  }
  return res.ok
})

/** Searches for a counterexample and throws an error if one is found */
export const assertForall = searchAndThen(res => {
  if (!res.ok) {
    const w = P.Write()
    w.SearchResult(res)
    throw new Error(w.messages.map(xs => xs.join(' ')).join('\n'))
  }
})

/** Searches for a counterexample to an asynchronous property and throws an error if one is found */
export const assertForallAsync = searchAndThenAsync(res => {
  if (!res.ok) {
    const w = P.Write()
    w.SearchResult(res)
    throw new Error(w.messages.map(xs => xs.join(' ')).join('\n'))
  }
})

/** Searches for a counterexample and returns the result formatted as an array of strings */
export const forallStrings = searchAndThen(res => {
  const w = P.Write()
  w.SearchResult(res)
  return {ok: res.ok, messages: w.messages.map(xs => xs.join(' '))}
})

/** Searches for a counterexample to an asynchronous property and returns the result formatted as an array of strings */
export const forallStringsAsync = searchAndThenAsync(res => {
  const w = P.Write()
  w.SearchResult(res)
  return {ok: res.ok, messages: w.messages.map(xs => xs.join(' '))}
})

export interface TestCreator<R> {
  (description: string, callback: () => void): R
  only(description: string, callback: () => void): R
  skip(description: string, callback: () => void): void
}

export type TestFunction<P, R> = <A>(
  description: string,
  g: Gen<A>,
  prop: (a: A, p: Property) => P,
  options?: Partial<Options>
) => R

export type PropertyCreator<P, R> = TestFunction<P, R> & {
  only: TestFunction<P, R>
  skip: TestFunction<P, void>
}

export function createProperty<R>(test: TestCreator<R>): PropertyCreator<boolean, R> {
  const testCreator: any = ((description, g, prop, options) => {
    test(description, () => assertForall(g, prop, options))
  }) as TestFunction<boolean, R>
  const only: TestFunction<boolean, R> = (description, g, prop, options?) => {
    return test.only(description, () => assertForall(g, prop, options))
  }
  const skip: TestFunction<boolean, void> = (description, g, prop, options) => {
    return test.skip(description, () => assertForall(g, prop, options))
  }
  testCreator.only = only
  testCreator.skip = skip
  return testCreator
}

export interface TapeTest {
  pass(msg: string): void
  fail(msg: string): void
  comment(msg: string): void
  end(): void
}

function _adapt_tape(
  test: (name: string, cb: (t: TapeTest) => void) => void
): TestFunction<boolean, void> {
  return (name, g, prop, options) =>
    test(name, t => {
      const res = forallStrings(g, prop, options)
      const [head, ...tail] = res.messages
      if (res.ok) {
        t.pass(head)
      }
      if (!res.ok) {
        tail.forEach(msg => t.comment(msg))
        t.fail(name + ': ' + head)
      }
      t.end()
    })
}

/** Adapt tape using forallStrings */
export function adaptTape(
  test: (name: string, cb: (t: TapeTest) => void) => void
): PropertyCreator<boolean, void> {
  const t: PropertyCreator<boolean, void> = _adapt_tape(test) as any
  // typings for tape don't properly know there are only and skip methods
  t.only = _adapt_tape((test as any).only)
  t.skip = _adapt_tape((test as any).skip)
  return t
}
