import * as Utils from './Utils'
import {Tree} from './Tree'
import * as Random from 'random-js'

const resolution = 0.01

const halves = (n: number, round = (x: number) => Math.floor(x)): number[] =>
  Utils.writer(write => {
    let i = n
    do {
      i = round(i / 2)
      write(i)
    } while (i > resolution)
  })

export function shrink_number(n: number, towards: number = 0): Tree<number> {
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

interface GenEnv {
  readonly rng: Random
  readonly size: number
}

export class Gen<A> {
  private constructor(private readonly gen: (env: GenEnv) => Tree<A>) {}
  static pure<A>(a: A): Gen<A> {
    return new Gen(() => Tree.pure(a))
  }
  map<B>(f: (a: A) => B): Gen<B> {
    return new Gen(env => this.gen(env).map(f))
  }
  then<B>(f: (a: A) => Gen<B>): Gen<B> {
    return new Gen(env => {
      // could distribute size over the two arms here
      const ta = this.gen(env)
      return ta.then(a => {
        const fa = f(a)
        return fa.gen(env)
      })
    })
  }
  with_tree<B>(f: (ta: Tree<A>) => Tree<B>): Gen<B> {
    return new Gen(env => f(this.gen(env)))
  }
  private static trees<A, R>(gs: Gen<A>[], f: (ts: Tree<A>[]) => Tree<R>): Gen<R> {
    return new Gen(env => f(gs.map(g => g.gen(env))))
  }
  static sequence<A>(gs: Gen<A>[]): Gen<A[]> {
    return Gen.trees(gs, Tree.dist_array)
  }
  static concat(gs: Gen<string>[], sep = ''): Gen<string> {
    return Gen.sequence(gs).map(xs => xs.join(sep))
  }
  static record<T extends Record<string, any>>(r: {[K in keyof T]: Gen<T[K]>}): Gen<T> {
    const keys = Object.keys(r)
    const ts = keys.map(k => r[k])
    return Gen.trees<T[string], T>(ts, arr => Tree.dist(Utils.dict(keys, (_k, i) => arr[i]) as any))
  }
  static pair<A, B>(ga: Gen<A>, gb: Gen<B>): Gen<[A, B]> {
    return new Gen(env => {
      const ta = ga.gen(env)
      const tb = gb.gen(env)
      return ta.fair_pair(tb)
    })
  }
  pair<B>(b: Gen<B>): Gen<[A, B]> {
    return Gen.pair(this, b)
  }
  wrap<K extends string>(k: K): Gen<Record<K, A>> {
    return Gen.record(({[k as string]: this} as any) as Record<K, Gen<A>>)
  }

  /** max exclusive */
  static range(max: number) {
    return Gen.between(0, max)
  }

  /** max exclusive */
  static range_float(max: number = 1) {
    return Gen.between_float(0, max)
  }

  /** hi exclusive */
  static between(lo: number, hi: number): Gen<number> {
    return Gen._between(lo, hi, (rng, lo, hi) => rng.integer(lo, hi - 1))
  }

  /** hi exclusive */
  static between_float(lo: number, hi: number): Gen<number> {
    return Gen._between(lo, hi, (rng, lo, hi) => rng.real(lo, hi))
  }

  /** hi exclusive */
  private static _between(
    lo: number,
    hi: number,
    random: (rng: Random, lo: number, hi: number) => number
  ): Gen<number> {
    const w0 = hi - lo
    if (hi === undefined || lo === undefined) {
      throw 'Range bounds must be proper numbers:' + {hi, lo}
    }
    if (w0 < 0) {
      return Gen._between(lo, hi, random).map(x => hi - x + lo)
    } else if (w0 == 0) {
      throw 'Gen.range of zero width'
    } else {
      return new Gen(env => {
        const w = hi - lo
        // Math.max(1, Math.min(w0, Math.ceil(w0 * r)))
        return shrink_number(random(env.rng, lo, lo + w), lo)
      })
    }
  }

  /** hi inclusive */
  static char_range(lo: string, hi: string): Gen<string> {
    return Gen.between(lo.charCodeAt(0), hi.charCodeAt(0)).map(i => String.fromCharCode(i))
  }
  static char(chars: string): Gen<string> {
    if (chars.length == 0) {
      throw 'Gen.choose empty string'
    } else {
      return Gen.between(0, chars.length).map(i => chars[i])
    }
  }
  static choose<A>(xs: A[]): Gen<A> {
    if (xs.length == 0) {
      throw 'Gen.choose empty array'
    } else {
      return Gen.between(0, xs.length).map(i => xs[i])
    }
  }
  static oneof<A>(gs: Gen<A>[]): Gen<A> {
    return Gen.choose(gs).then(g => g)
  }
  static frequency<A>(table: [number, Gen<A>][]): Gen<A> {
    let sum = 0
    table.forEach(([f, g]) => {
      if (f >= 0) {
        sum += f
      }
    })
    return Gen.between(0, sum).then(i => {
      for (const [f, g] of table) {
        if (f > 0) {
          i -= f
        }
        if (i < 0) {
          return g
        }
      }
      throw 'Gen.frequency unreachable'
    })
  }
  replicate(n: number): Gen<A[]> {
    if (n <= 0) {
      return Gen.pure([] as A[])
    } else {
      return this.pair(this.replicate(n - 1)).map(([x, xs]) => [x, ...xs])
    }
  }

  static replicate<A>(n: number, g: Gen<A>): Gen<A[]> {
    return g.replicate(n)
  }

  replace_shrinks(f: (forest: Tree<A>[]) => Tree<A>[]): Gen<A> {
    return new Gen(env => {
      const {top, forest} = this.gen(env)
      return new Tree(top, () => f(forest()))
    })
  }
  sample(size = 10, seed?: number): A {
    return this.sampleWithShrinks(size, seed).top
  }
  sampleWithShrinks(size = 10, seed?: number): Tree<A> {
    return this.gen({rng: Gen._rng(seed), size})
  }

  private static _rng(seed?: number): Random {
    const mt0 = Random.engines.mt19937()
    const mt = (seed && mt0.seed(seed)) || mt0.autoSeed()
    return new Random(mt)
  }

  static bool: Gen<boolean> = Gen.choose([false, true])

  static nat: Gen<number> = Gen.size().then(size => Gen.range(size + 1))
  static int: Gen<number> = Gen.oneof([Gen.nat, Gen.nat.map(x => -x)])
  static pos: Gen<number> = Gen.nat.map(x => x + 1)
  static neg: Gen<number> = Gen.nat.map(x => -x - 1)

  static digit: Gen<string> = Gen.char_range('0', '9')
  static lower: Gen<string> = Gen.char_range('a', 'z')
  static upper: Gen<string> = Gen.char_range('A', 'Z')
  static alpha: Gen<string> = Gen.oneof([Gen.lower, Gen.upper])
  static alphanum: Gen<string> = Gen.oneof([Gen.alpha, Gen.digit])
  static ascii: Gen<string> = Gen.char_range('!', '~')
  static whitespace: Gen<string> = Gen.char(` \n\t`)

  static string(g: Gen<string>, sep = ''): Gen<string> {
    return g.array().map(xs => xs.join(sep))
  }
  static nestring(g: Gen<string>, sep = ''): Gen<string> {
    return g.nearray().map(xs => xs.join(sep))
  }

  static pojo<A>(
    v: Gen<A>,
    k: Gen<string> = Gen.nestring(Gen.lower).resize(s => s / 5)
  ): Gen<Record<string, A>> {
    return Gen.record({k, v})
      .array()
      .map(Utils.record_create)
  }

  pojo(keygen?: Gen<string>): Gen<Record<string, A>> {
    return Gen.pojo(this, keygen)
  }

  array(): Gen<A[]> {
    return Gen.nat.then(i => this.replicate(i))
  }
  nearray(): Gen<A[]> {
    return Gen.pos.then(i => this.replicate(i))
  }

  static array<A>(g: Gen<A>): Gen<A[]> {
    return g.array()
  }
  static nearray<A>(g: Gen<A>): Gen<A[]> {
    return g.nearray()
  }

  static size(): Gen<number> {
    return new Gen(env => shrink_number(env.size, 0))
  }
  resize(op: (size: number) => number): Gen<A> {
    return new Gen(env => this.gen({...env, size: Math.max(1, op(env.size))}))
  }

  /** Permute using Fisher-Yates shuffle */
  static permute<A>(xs: A[]): Gen<A[]> {
    const m_swaps: Gen<{i: number; j: number}>[] = []
    for (let i = 0; i < xs.length - 1; i++) {
      m_swaps.push(Gen.between(i, xs.length).map(j => ({i, j})))
    }
    return Gen.sequence(m_swaps).map(swaps => {
      const ys = xs.slice()
      swaps.forEach(({j, i}) => {
        ;[ys[i], ys[j]] = [ys[j], ys[i]]
      })
      return ys
    })
  }
}
