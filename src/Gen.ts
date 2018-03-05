import * as Utils from './Utils'
import {Tree, shrinkNumber} from './Tree'
import * as Random from 'random-js'

export interface GenEnv {
  readonly rng: Random
  readonly size: number
}

export class Gen<A> {
  constructor(readonly gen: (env: GenEnv) => Tree<A>) {}
  static of<A>(a: A): Gen<A> {
    return new Gen(() => Tree.of(a))
  }
  map<B>(f: (a: A) => B): Gen<B> {
    return new Gen(env => this.gen(env).map(f))
  }
  chain<B>(f: (a: A) => Gen<B>): Gen<B> {
    return new Gen(env => {
      // could distribute size over the two arms here
      const ta = this.gen(env)
      return ta.chain(a => {
        const fa = f(a)
        return fa.gen(env)
      })
    })
  }

  withTree<B>(f: (ta: Tree<A>) => Tree<B>): Gen<B> {
    return new Gen(env => f(this.gen(env)))
  }
  replaceShrinks(f: (forest: Tree<A>[]) => Tree<A>[]): Gen<A> {
    return new Gen(env => {
      const {top, forest} = this.gen(env)
      return new Tree(top, () => f(forest()))
    })
  }

  sample(size = 10, seed?: number): A {
    return this.sampleWithShrinks(size, seed).top
  }
  sampleWithShrinks(size = 10, seed?: number): Tree<A> {
    return this.gen({rng: seedToRandom(seed), size})
  }

  wrap<K extends string>(k: K): Gen<Record<K, A>> {
    return record(({[k as string]: this} as any) as Record<K, Gen<A>>)
  }

  pair<B>(b: Gen<B>): Gen<[A, B]> {
    return pair(this, b)
  }
  replicate(n: number): Gen<A[]> {
    return replicate(n, this)
  }
  pojo(keygen?: Gen<string>): Gen<Record<string, A>> {
    return pojo(this, keygen)
  }

  array(): Gen<A[]> {
    return array(this)
  }
  nearray(): Gen<A[]> {
    return nearray(this)
  }

  small(): Gen<A> {
    return small(this)
  }
  big(): Gen<A> {
    return big(this)
  }
  huge(): Gen<A> {
    return huge(this)
  }
  pow(exponent: number): Gen<A> {
    return pow(exponent, this)
  }
}

function seedToRandom(seed?: number): Random {
  const mt0 = Random.engines.mt19937()
  const mt = (seed && mt0.seed(seed)) || mt0.autoSeed()
  return new Random(mt)
}

function trees<A, R>(gs: Gen<A>[], f: (ts: Tree<A>[]) => Tree<R>): Gen<R> {
  return new Gen(env => f(gs.map(g => g.gen(env))))
}

function size(): Gen<number> {
  return new Gen(env => shrinkNumber(env.size, 0))
}

export function resize<A>(op: (size: number) => number, g: Gen<A>): Gen<A> {
  return new Gen(env => g.gen({...env, size: Math.max(1, Math.round(op(env.size)))}))
}

//////////////////////////////////////////////////////////////////////
// Generator combinators

export function record<T extends Record<string, any>>(r: {[K in keyof T]: Gen<T[K]>}): Gen<T> {
  const keys = Object.keys(r)
  const ts = keys.map(k => r[k])
  return trees<T[string], T>(ts, arr => Tree.dist(Utils.dict(keys, (_k, i) => arr[i]) as any))
}

export function sequence<A>(gs: Gen<A>[]): Gen<A[]> {
  return trees(gs, Tree.dist_array)
}

export function choose<A>(xs: A[]): Gen<A> {
  if (xs.length == 0) {
    throw 'choose empty array'
  } else {
    return range(xs.length).map(i => xs[i])
  }
}
export function oneof<A>(gs: Gen<A>[]): Gen<A> {
  return choose(gs).chain(g => g)
}

export function frequency<A>(table: [number, Gen<A>][]): Gen<A> {
  return frequencyLazy(table.map(([i, g]) => Utils.pair(i, () => g)))
}

export function frequencyLazy<A>(table: [number, () => Gen<A>][]): Gen<A> {
  let sum = 0
  table.forEach(([f, g]) => {
    if (f >= 0) {
      sum += f
    }
  })
  return range(sum).chain(i => {
    for (const [f, g] of table) {
      if (f > 0) {
        i -= f
      }
      if (i < 0) {
        return g()
      }
    }
    throw 'frequency unreachable'
  })
}

//////////////////////////////////////////////////////////////////////
// Member generator combinators

/** The constant generator: always generates the supplied value */
export function of<A>(a: A): Gen<A> {
  return Gen.of(a)
}

export function pair<A, B>(ga: Gen<A>, gb: Gen<B>): Gen<[A, B]> {
  return new Gen(env => {
    const ta = ga.gen(env)
    const tb = gb.gen(env)
    return ta.fair_pair(tb)
  })
}

export function replicate<A>(n: number, g: Gen<A>): Gen<A[]> {
  if (n <= 0) {
    return Gen.of([] as A[])
  } else {
    return pair(g, replicate(n - 1, g)).map(([x, xs]) => [x, ...xs])
  }
}

export function pojo<A>(
  v: Gen<A>,
  k: Gen<string> = lower.nestring().small()
): Gen<Record<string, A>> {
  return record({k, v})
    .array()
    .map(Utils.record_create)
}

export function array<A>(g: Gen<A>): Gen<A[]> {
  return nat.chain(i => replicate(i, g))
}
export function nearray<A>(g: Gen<A>): Gen<A[]> {
  return pos.chain(i => replicate(i, g))
}

export function small<A>(g: Gen<A>): Gen<A> {
  return pow(0.5, g)
}
export function big<A>(g: Gen<A>): Gen<A> {
  return pow(1.5, g)
}
export function huge<A>(g: Gen<A>): Gen<A> {
  return pow(2, g)
}
export function pow<A>(exponent: number, g: Gen<A>): Gen<A> {
  return resize(x => Math.pow(x, exponent), g)
}

//////////////////////////////////////////////////////////////////////
// Generators of primitives

/** max exclusive */
export function range(max: number): Gen<number> {
  return between(0, max - 1)
}

/** max exclusive */
export function rangeFloat(max: number = 1): Gen<number> {
  return betweenFloat(0, max)
}

/** hi inclusive */
export function between(lo: number, hi: number): Gen<number> {
  return _between(lo, hi + 1, (rng, lo, hi) => rng.integer(lo, hi - 1))
}

/** hi exclusive */
export function betweenFloat(lo: number, hi: number): Gen<number> {
  return _between(lo, hi, (rng, lo, hi) => rng.real(lo, hi))
}

/** hi exclusive */
function _between(
  lo: number,
  hi: number,
  random: (rng: Random, lo: number, hi: number) => number
): Gen<number> {
  const w0 = hi - lo
  if (hi === undefined || lo === undefined) {
    throw 'Range bounds must be proper numbers:' + {hi, lo}
  }
  if (w0 < 0) {
    return _between(hi, lo, random).map(x => hi - x + lo)
  } else if (w0 == 0) {
    throw new Error('range of zero width')
  } else {
    return new Gen(env => {
      const w = hi - lo
      // Math.max(1, Math.min(w0, Math.ceil(w0 * r)))
      return shrinkNumber(random(env.rng, lo, lo + w), lo)
    })
  }
}

/** Generate a binary number (0 or 1) */
export const bin: Gen<0 | 1> = choose<0 | 1>([0, 1])

/** Generate a small natural number */
export const nat: Gen<number> = size().chain(size => range(size + 1))

/** Generate a small integer */
export const int: Gen<number> = oneof([nat, nat.map(x => -x)])

/** Generate a small positive number */
export const pos: Gen<number> = nat.map(x => x + 1)

/** Generate a small negative number */
export const neg: Gen<number> = nat.map(x => -x - 1)

const min32 = 1 << 31
const max32 = ~(1 << 31)

/** Generate a nonnegative i32 */
export const natural: Gen<number> = between(0, max32)

/** Generate any i32 */
export const integer: Gen<number> = between(min32, max32)

/** Generate a positive i32 */
export const positive: Gen<number> = between(1, max32)

/** Generate a negative i32 */
export const negative: Gen<number> = between(min32, -1)

export const bool: Gen<boolean> = choose([false, true])

//////////////////////////////////////////////////////////////////////
// Character generators

export function string(g: Gen<string>, sep = ''): Gen<string> {
  return array(g).map(xs => xs.join(sep))
}
export function nestring(g: Gen<string>, sep = ''): Gen<string> {
  return nearray(g).map(xs => xs.join(sep))
}

export type GenChar = Gen<string> & {
  string(sep?: string): Gen<string>
  nestring(sep?: string): Gen<string>
}

export function blessGenChar(g: Gen<string>): GenChar {
  const gc = g as GenChar
  gc.string = sep => blessGenChar(string(g, sep))
  gc.nestring = sep => blessGenChar(nestring(g, sep))
  return gc
}

/** hi inclusive */
export function charRange(lo: string, hi: string): GenChar {
  return blessGenChar(between(lo.charCodeAt(0), hi.charCodeAt(0)).map(i => String.fromCharCode(i)))
}
export function char(chars: string): GenChar {
  if (chars.length == 0) {
    throw 'choose empty string'
  } else {
    return blessGenChar(range(chars.length).map(i => chars[i]))
  }
}

export const digit: GenChar = charRange('0', '9')
export const lower: GenChar = charRange('a', 'z')
export const upper: GenChar = charRange('A', 'Z')
export const alpha: GenChar = blessGenChar(oneof([lower, upper]))
export const alphanum: GenChar = blessGenChar(oneof([alpha, digit]))
export const ascii: GenChar = charRange('!', '~')
export const whitespace: GenChar = char(` \n\t`)

//////////////////////////////////////////////////////////////////////
// Exotic generators

export function concat(gs: Gen<string>[], sep = ''): Gen<string> {
  return sequence(gs).map(xs => xs.join(sep))
}

/** Permute using Fisher-Yates shuffle */
export function permute<A>(xs: A[]): Gen<A[]> {
  const m_swaps: Gen<{i: number; j: number}>[] = []
  for (let i = 0; i < xs.length - 1; i++) {
    m_swaps.push(between(i, xs.length - 1).map(j => ({i, j})))
  }
  return sequence(m_swaps).map(swaps => {
    const ys = xs.slice()
    swaps.forEach(({j, i}) => {
      ;[ys[i], ys[j]] = [ys[j], ys[i]]
    })
    return ys
  })
}
