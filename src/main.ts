function pair<A, B>(a: A, b: B): [A, B] { return [a, b] }
function sigma<A, B>(a: A, f: (a: A) => B): [A, B] { return [a, f(a)] }

export function writer<A>(handle: (write: (...xs: A[]) => void) => void): A[] {
  const out: A[] = []
  handle(out.push.bind(out))
  return out
}

export function record<K extends string, V>(handle: (write: (k: K, v: V) => void) => void): Record<K, V> {
  const obj = {} as Record<K, V>
  handle((k, v) => obj[k] = v)
  return obj
}

export function dict<K extends string, V>(keys: K[], f: (k: K, index: number) => V): Record<K, V> {
  return record<K, V>(w => keys.map((k, i) => w(k, f(k, i))))
}

export function flatten<X>(xss: X[][]): X[] {
  return ([] as X[]).concat(...xss)
}

// my fantastic RNG
class RNG {
  private constructor(
    private readonly seed: number // unused
  ) {}

  split(): [RNG, RNG] {
    return [this, this] // cheating
  }
  splitN(n: number): RNG[] {
    return new Array(n).fill(this) // cheating
  }
  rand(): number {
    return Math.floor(Math.random() * (1 << 30))
  }
  public static init(seed: number) {
    return new RNG(seed)
  }
}

interface StrictTree<A> {
  readonly top: A,
  readonly forest: StrictTree<A>[]
}

class Tree<A> {
  constructor(
    readonly top: A,
    readonly forest: () => Tree<A>[]
  ) {}
  static pure<A>(a: A): Tree<A> {
    return new Tree(a, () => [])
  }
  static tree<A>(top: A, forest: () => Tree<A>[]): Tree<A> {
    return new Tree(top, forest)
  }
  static tree$<A>(top: A, forest: Tree<A>[]): Tree<A> {
    return new Tree(top, () => forest)
  }
  map<B>(f: (a: A) => B): Tree<B> {
    return this.then((a: A) => Tree.pure(f(a)))
  }
  then<B>(f: (a: A) => Tree<B>): Tree<B> {
    const t = f(this.top)
    return new Tree(t.top, () => [...this.forest().map(t => t.then(f)), ...t.forest()])
  }

  left_first_pair<B>(tb: Tree<B>): Tree<[A, B]> {
    return this.then(a => tb.then(b => Tree.pure(pair(a, b))))
  }
  fair_pair<B>(tb: Tree<B>): Tree<[A, B]> {
    return Tree.dist({a: this, b: tb}).map(p => pair(p.a, p.b))
  }

  left_first_search(p: (a: A) => boolean, fuel=-1): Tree<A> | undefined {
    // used for shrinking
    // returns the last but leftmost subtree without any backtracking where the property is true
    if (p(this.top)) {
      if (fuel == 0) {
        return this
      }
      const forest = this.forest()
      for (let i = 0; i < forest.length; i++) {
        const res = forest[i].left_first_search(p, fuel-1)
        if (res != undefined) {
          return res
        }
      }
      return this
    }
    return undefined
  }

  /** distribute fairly */
  static dist<T extends Record<string, any>>(trees: {[K in keyof T]: Tree<T[K]>}): Tree<T> {
    const keys: (keyof T)[] = Object.keys(trees)
    function shrink_one(k: keyof T): Tree<T>[] {
      return trees[k].forest().map(t => Tree.dist({...trees as any, [k]: t}) as Tree<T>)
    }
    return new Tree<T>(
      dict(keys, k => trees[k].top),
      () => flatten(keys.map(shrink_one))
    )
  }

  /** distribute array fairly */
  static dist_array<A>(trees: Tree<A>[]): Tree<A[]> {
    const length = trees.length
    return Tree.dist(trees).map(t => Array.from({...t, length}))
  }

  force(depth: number=-1): StrictTree<A> {
    return {top: this.top, forest:
      depth == 0 ? [] :
      this.forest().map(t => t.force(depth-1))}
  }
}

const [tree, pure] = [Tree.tree$, Tree.pure]

declare var require: Function
const pp = require('json-stringify-pretty-compact') as (s: any) => string
const log = (...s: any[]) => console.log(...s.map(u => pp(u)))

const resolution = 0.1

const halves =
  (n: number, round = (x: number) => Math.floor(x)): number[] =>
  writer(write => {
    let i = n
    do {
      i = round(i / 2)
      write(i)
    } while (i > resolution)
  })

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
      // fallback: linear search, this is not really feasible in a big range
      const range = 10
      for (let j = i-1, c = 0; j > Math.ceil(i / 2) && c < range; j--, c++) {
        candidates.push(j)
      }
      return new Tree(i, () => candidates.map(go))
    })(n)
  }
}

/*
log(Tree.dist({a:shrink_number(4), b:shrink_number(2), c:shrink_number(1)}).force(2))
log(Tree.dist_array([shrink_number(4), shrink_number(2), shrink_number(1)]).force(2))
log(shrink_number(4).fair_pair(shrink_number(2)).force(2))
log(shrink_number(-18.2, 8.1).force(1))
log(shrink_number(2.5).force(2))
*/

class Gen<A> {
  private constructor(
     private readonly gen: (rng: RNG, size: number) => Tree<A>
  ) {}
  static pure<A>(a: A): Gen<A> {
    return new Gen(() => Tree.pure(a))
  }
  map<B>(f: (a: A) => B): Gen<B> {
    return new Gen((rng, size) => this.gen(rng, size).map(f))
  }
  then<B>(f: (a: A) => Gen<B>): Gen<B> {
    return new Gen(
      (rng, size) => {
        // could distribute size over the two arms here
        const [r1, r2] = rng.split()
        const ta = this.gen(r1, size)
        return ta.then(a => f(a).gen(r2, size))
      })
  }
  with_tree<B>(f: (ta: Tree<A>) => Tree<B>): Gen<B> {
    return new Gen((rng, size) => f(this.gen(rng, size)))
  }
  static range(lo: number, hi: number): Gen<number> {
    return new Gen((rng, size) => shrink_number(rng.rand() % (hi - lo) + lo, lo))
  }
  static trees<A, R>(gs: Gen<A>[], f: (ts: Tree<A>[]) => Tree<R>): Gen<R> {
    return new Gen(
      (rng, size) => {
        const rs = rng.splitN(gs.length)
        const ts = rs.map((r, i) => gs[i].gen(rs[i], size))
        return f(ts)
      })
  }
  static sequence<A>(gs: Gen<A>[]): Gen<A[]> {
    return Gen.trees(gs, Tree.dist_array)
  }
  static record<T extends Record<string, any>>(r: {[K in keyof T]: Gen<T[K]>}): Gen<T> {
    const keys = Object.keys(r)
    const ts = keys.map(k => r[k])
    return Gen.trees<T[string], T>(ts, arr => Tree.dist(dict(keys, (_k, i) => arr[i]) as any))
  }
  static pair<A, B>(ga: Gen<A>, gb: Gen<B>): Gen<[A, B]> {
    return new Gen(
      (rng, size) => {
        const [r1, r2] = rng.split()
        const ta = ga.gen(r1, size)
        const tb = gb.gen(r2, size)
        return ta.fair_pair(tb)
      })
  }
  pair<B>(b: Gen<B>): Gen<[A, B]> {
    return Gen.pair(this, b)
  }
  wrap<K extends string>(k: K): Gen<Record<K, A>> {
    return Gen.record({[k as string]: this} as any as Record<K, Gen<A>>)
  }

  union<T extends Record<string, any>>(r: {[K in keyof T]: Gen<T[K]>}): Gen<A & T> { throw 'TODO?' }
  static choose<A>(xs: A[]): Gen<A> { throw 'TODO' }
  static frequency<A>(table: [number, Gen<A>][]): Gen<A> { throw 'TODO' }
  static oneof<A>(gs: Gen<A>[]): Gen<A> { throw 'TODO' }

  resize(op: (size: number) => number): Gen<A> {
    return new Gen((rng, size) => this.gen(rng, op(size)))
  }
  replace_shrinks(f: (forest: Tree<A>[]) => Tree<A>[]): Gen<A> {
    return new Gen(
      (rng, size) => {
        const {top, forest} = this.gen(rng, size)
        return new Tree(top, () => f(forest()))
      })
  }
  sample(n: number = 10): A[] {
    return replicate(n, this).gen(RNG.init(0), 100).top
  }
  sampleWithShrinks(size=0): Tree<A> {
    return this.gen(RNG.init(1234), size)
  }
}

function replicate<A>(n: number, g: Gen<A>): Gen<A[]> {
  if (n == 0) {
    return Gen.pure([] as A[])
  } else {
    return g
      .pair(replicate(n-1, g))
      .map(([x, xs]) => [x, ...xs])
  }
}

export function range(to: number) {
  const out = []
  for (let i = 0; i < to; ++i) {
    out.push(i)
  }
  return out
}

export function fromTo(begin: number, end: number) {
  const out = []
  for (let i = begin; i < end; ++i) {
    out.push(i)
  }
  return out
}

type TestResult<A> = {ok: true} | {ok: false, counterexample: A} | {ok: false, error: any, when: 'generating' | 'evaluating'}
function QuickCheck<A>(g: Gen<A>, prop: (a: A) => boolean): TestResult<A> {
  for (let i = 0; i < 100; ++i) {
    let t
    try {
      t = g.sampleWithShrinks(i)
    } catch (error) {
      return {ok: false, error, when: 'generating'}
    }
    const a = t.top
    let failtree
    try {
      failtree = t.left_first_search(a => !prop(a), 500)
    } catch (error) {
      return {ok: false, error, when: 'evaluating'}
    }
    if (failtree) {
      return {ok: false, counterexample: failtree.top}
    }
  }
  return {ok: true}
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
    ({a, b}) => a * b < 1814 || a < b
  )
)
