import * as Utils from './Utils'
import {Tree} from './Tree'
import * as Random from 'random-js'

const resolution = 0.01

function halves(n: number, round = (x: number) => Math.floor(x)): number[] {
  const out: number[] = []
  let i = n
  do {
    i = round(i / 2)
    out.push(i)
  } while (i > resolution)
  return out
}

function shrink_number(n: number, towards: number = 0): Tree<number> {
  if (towards != 0) {
    return shrink_number(towards - n).map(i => towards - i)
  } else if (n < 0) {
    return shrink_number(-n).map(i => -i)
  } else {
    return (function go(i: number): Tree<number> {
      const candidates: number[] = []
      if (i > 0) {
        // binary search:
        candidates.push(...halves(i))
        // binary search with fractions
        if (Math.round(i) != i && i > resolution) {
          candidates.push(...halves(i, x => x))
        }
      }
      // fallback: linear search, although this is not really feasible in a big range
      const range = 10
      for (let j = i - 1, c = 0; j > Math.ceil(i / 2) && c < range; j--, c++) {
        candidates.push(j)
      }
      return new Tree(i, () => candidates.map(go))
    })(n)
  }
}

export interface GenEnv {
  readonly rng: Random
  readonly size: number
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

export function of<A>(a: A): Gen<A> {
  return Gen.of(a)
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
  pair<B>(b: Gen<B>): Gen<[A, B]> {
    return pair(this, b)
  }
  wrap<K extends string>(k: K): Gen<Record<K, A>> {
    return record(({[k as string]: this} as any) as Record<K, Gen<A>>)
  }
  replicate(n: number): Gen<A[]> {
    return replicate(n, this)
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

  pojo(keygen?: Gen<string>): Gen<Record<string, A>> {
    return pojo(this, keygen)
  }

  array(): Gen<A[]> {
    return array(this)
  }
  nearray(): Gen<A[]> {
    return nearray(this)
  }

  resize(op: (size: number) => number): Gen<A> {
    return resize(op, this)
  }
  small(): Gen<A> {
    return this.pow(0.5)
  }
  big(): Gen<A> {
    return this.pow(1.5)
  }
  huge(): Gen<A> {
    return this.pow(2)
  }
  pow(exponent: number): Gen<A> {
    return this.resize(x => Math.pow(x, exponent))
  }
}

function trees<A, R>(gs: Gen<A>[], f: (ts: Tree<A>[]) => Tree<R>): Gen<R> {
  return new Gen(env => f(gs.map(g => g.gen(env))))
}
export function sequence<A>(gs: Gen<A>[]): Gen<A[]> {
  return trees(gs, Tree.dist_array)
}
export function concat(gs: Gen<string>[], sep = ''): Gen<string> {
  return sequence(gs).map(xs => xs.join(sep))
}
export function record<T extends Record<string, any>>(r: {[K in keyof T]: Gen<T[K]>}): Gen<T> {
  const keys = Object.keys(r)
  const ts = keys.map(k => r[k])
  return trees<T[string], T>(ts, arr => Tree.dist(Utils.dict(keys, (_k, i) => arr[i]) as any))
}
export function pair<A, B>(ga: Gen<A>, gb: Gen<B>): Gen<[A, B]> {
  return new Gen(env => {
    const ta = ga.gen(env)
    const tb = gb.gen(env)
    return ta.fair_pair(tb)
  })
}
/** max exclusive */
export function range(max: number) {
  return between(0, max)
}

/** max exclusive */
export function rangeFloat(max: number = 1) {
  return betweenFloat(0, max)
}

/** hi exclusive */
export function between(lo: number, hi: number): Gen<number> {
  return _between(lo, hi, (rng, lo, hi) => rng.integer(lo, hi - 1))
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
    return _between(lo, hi, random).map(x => hi - x + lo)
  } else if (w0 == 0) {
    throw 'range of zero width'
  } else {
    return new Gen(env => {
      const w = hi - lo
      // Math.max(1, Math.min(w0, Math.ceil(w0 * r)))
      return shrink_number(random(env.rng, lo, lo + w), lo)
    })
  }
}

/** hi inclusive */
export function charRange(lo: string, hi: string): GenChar {
  return blessGenChar(between(lo.charCodeAt(0), hi.charCodeAt(0)).map(i => String.fromCharCode(i)))
}
export function char(chars: string): GenChar {
  if (chars.length == 0) {
    throw 'choose empty string'
  } else {
    return blessGenChar(between(0, chars.length).map(i => chars[i]))
  }
}
export function choose<A>(xs: A[]): Gen<A> {
  if (xs.length == 0) {
    throw 'choose empty array'
  } else {
    return between(0, xs.length).map(i => xs[i])
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
  return between(0, sum).chain(i => {
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

export const bool: Gen<boolean> = choose([false, true])

export const bin: Gen<number> = range(2)
export const nat: Gen<number> = size().chain(size => range(size + 1))
export const int: Gen<number> = oneof([nat, nat.map(x => -x)])
export const pos: Gen<number> = nat.map(x => x + 1)
export const neg: Gen<number> = nat.map(x => -x - 1)

export const digit: GenChar = charRange('0', '9')
export const lower: GenChar = charRange('a', 'z')
export const upper: GenChar = charRange('A', 'Z')
export const alpha: GenChar = blessGenChar(oneof([lower, upper]))
export const alphanum: GenChar = blessGenChar(oneof([alpha, digit]))
export const ascii: GenChar = charRange('!', '~')
export const whitespace: GenChar = char(` \n\t`)

export function string(g: Gen<string>, sep = ''): Gen<string> {
  return g.array().map(xs => xs.join(sep))
}
export function nestring(g: Gen<string>, sep = ''): Gen<string> {
  return g.nearray().map(xs => xs.join(sep))
}

export function pojo<A>(
  v: Gen<A>,
  k: Gen<string> = lower.nestring().small()
): Gen<Record<string, A>> {
  return record({k, v})
    .array()
    .map(Utils.record_create)
}

function size(): Gen<number> {
  return new Gen(env => shrink_number(env.size, 0))
}

export function resize<A>(op: (size: number) => number, g: Gen<A>): Gen<A> {
  return new Gen(env => g.gen({...env, size: Math.max(1, Math.round(op(env.size)))}))
}
/** Permute using Fisher-Yates shuffle */
export function permute<A>(xs: A[]): Gen<A[]> {
  const m_swaps: Gen<{i: number; j: number}>[] = []
  for (let i = 0; i < xs.length - 1; i++) {
    m_swaps.push(between(i, xs.length).map(j => ({i, j})))
  }
  return sequence(m_swaps).map(swaps => {
    const ys = xs.slice()
    swaps.forEach(({j, i}) => {
      ;[ys[i], ys[j]] = [ys[j], ys[i]]
    })
    return ys
  })
}

export function array<A>(g: Gen<A>): Gen<A[]> {
  return nat.chain(i => g.replicate(i))
}
export function nearray<A>(g: Gen<A>): Gen<A[]> {
  return pos.chain(i => g.replicate(i))
}

export function replicate<A>(n: number, g: Gen<A>): Gen<A[]> {
  if (n <= 0) {
    return Gen.of([] as A[])
  } else {
    return pair(g, replicate(n - 1, g)).map(([x, xs]) => [x, ...xs])
  }
}

function seedToRandom(seed?: number): Random {
  const mt0 = Random.engines.mt19937()
  const mt = (seed && mt0.seed(seed)) || mt0.autoSeed()
  return new Random(mt)
}
