

type TestResult<A> = {ok: true} | {ok: false, counterexample: A}
declare function qc<A>(g: Gen<A>, prop: (a: A) => boolean): TestResult<A>

type RNG = {}
const rng_seed: RNG = {}
function next(rng: RNG): number {
  return 0
}

function pair<A, B>(a: A, b: B): [A, B] { return [a, b] }
function sigma<A, B>(a: A, f: (a: A) => B): [A, B] { return [a, f(a)] }

class Gen<A> {
  private constructor(
     private readonly gen: (rng: RNG) => [A, A[] /* replace with lazy rose tree */],
  ) {}
  public static pure<A>(a: A): Gen<A> {
    return new Gen(() => pair(a, []))
  }
  public static range(lo: number, hi: number): Gen<number> {
    return new Gen(
      (rng) => sigma(
        next(rng) % (hi - lo) + lo,
        a => a - 1 > lo ? [a - 1] : []))
  }
  public static pair<A, B>(ga: Gen<A>, gb: Gen<B>): Gen<[A, B]> {
    return new Gen(
      (rng) => {
        const [a, as] = ga.gen(rng)
        const [b, bs] = gb.gen(rng)
        return pair(pair(a, b), [
            ...as.map(a => pair(a, b)),
            ...bs.map(b => pair(a, b))
         ])
      })
  }
  public static record<T extends Record<string, any>>(r: {[K in keyof T]: Gen<T[K]>}): Gen<T> { throw 'TODO' }
  public static choose<A>(xs: A[]): Gen<A> { throw 'TODO' }
  public static frequency<A>(table: [number, Gen<A>][]): Gen<A> { throw 'TODO' }
  public static oneof<A>(gs: Gen<A>[]): Gen<A> { throw 'TODO' }
  public static sequence<A>(gs: Gen<A>[]): Gen<A[]> { throw 'TODO' }
  public map<B>(f: (a: A) => B): Gen<B> {
    return new Gen(
      rng => {
        const [a, as] = this.gen(rng)
        return pair(f(a), as.map(f))
      })
  }
  public then<B>(f: (a: A) => Gen<B>): Gen<B> {
    return new Gen(
      rng => {
        const [a, as /* what about these shrinks? */] = this.gen(rng)
        const [b, bs] = f(a).gen(rng)
        return pair(b, [...bs, ...as.map(a => f(a).gen(rng)[0])])
      })
  }
  public pair<B>(b: Gen<B>): Gen<[A, B]> {
    return Gen.pair(this, b)
  }
  public wrap<K extends string>(k: K): Gen<Record<K, A>> {
    return Gen.record({[k as string]: this} as any as Record<K, Gen<A>>)
  }
  public union<T extends Record<string, any>>(r: {[K in keyof T]: Gen<T[K]>}): Gen<A & T> {
    throw 'TODO'
  }
  public smaller(): Gen<A> {
    return new Gen(
      rng => {
        const [a, as] = this.gen(rng)
        if (as.length == 0) {
          return pair(a, [])
        } else {
          const i = next(rng)
          return pair(as[as.length % i], [])
        }
      }
    )
  }
  public setShrinker(f: (a: A, current: A[]) => A[]): Gen<A> {
    return new Gen(
      rng => {
        const [a, as] = this.gen(rng)
        return pair(a, f(a, as))
      })
  }
  public sample(n: number = 10): A[] {
    return replicate(n, this).gen(rng_seed)[0]
  }
  public sampleWithShrinks(n?: number): {value: A, shrinks: A[]}[] {
    throw 'TODO'
  }
}

function replicate<A>(n: number, g: Gen<A>): Gen<A[]> {
  if (n == 0) {
    return Gen.pure([] as A[])
  } else if (n % 2 == 0) {
    return g
      .pair(replicate(n-1, g))
      .map(([x, xs]) => [x, ...xs])
  } else {
    return g
      .wrap('x')
      .union({xs: replicate(n-1, g)})
      .map(({x, xs}) => [x, ...xs])
  }
}

console.log(
  qc(Gen.record({a: Gen.range(0, 10), b: Gen.range(0, 10)}),
    ({a, b}) => a * b < 64
  )
)
