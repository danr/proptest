import * as Utils from './Utils'
import {LazyList} from './lazylist'
import * as Lz from './lazylist'

export interface StrictTree<A> {
  readonly top: A
  readonly forest: StrictTree<A>[]
}

export class Tree<A> {
  constructor(readonly top: A, readonly forest: LazyList<Tree<A>>) {}
  static of<A>(a: A): Tree<A> {
    return new Tree(a, Lz.nil)
  }
  static tree<A>(top: A, forest: LazyList<Tree<A>>): Tree<A> {
    return new Tree(top, forest)
  }
  static tree$<A>(top: A, forest: Tree<A>[]): Tree<A> {
    return new Tree(top, Lz.fromArray(forest))
  }
  map<B>(f: (a: A) => B): Tree<B> {
    return this.chain((a: A) => Tree.of(f(a)))
  }
  chain<B>(f: (a: A) => Tree<B>): Tree<B> {
    const t = f(this.top)
    return new Tree(t.top, Lz.concat(Lz.map(t => t.chain(f), this.forest), t.forest))
  }

  left_first_pair<B>(tb: Tree<B>): Tree<[A, B]> {
    return this.chain(a => tb.chain(b => Tree.of(Utils.pair(a, b))))
  }
  fair_pair<B>(tb: Tree<B>): Tree<[A, B]> {
    return Tree.dist({a: this, b: tb}).map(p => Utils.pair(p.a, p.b))
  }

  /** distribute fairly */
  static dist<T extends Record<string, any>>(trees: {[K in keyof T]: Tree<T[K]>}): Tree<T> {
    const keys: (keyof T)[] = Object.keys(trees)
    function shrink_one(k: keyof T): LazyList<Tree<T>> {
      return Lz.map(t => Tree.dist({...(trees as any), [k]: t}) as Tree<T>, trees[k].forest)
    }
    return new Tree<T>(
      Utils.dict(keys, k => trees[k].top),
      Lz.flatten(Lz.map(shrink_one, Lz.fromArray(keys)))
    )
  }

  /** distribute array fairly */
  static dist_array<A>(trees: Tree<A>[]): Tree<A[]> {
    const length = trees.length
    return Tree.dist(trees as any).map(t => Array.from({...t, length}))
  }

  /** debugging function to view the tree evaluated */
  force(depth: number = -1): StrictTree<A> {
    return {
      top: this.top,
      forest: depth == 0 ? [] : Lz.toArray(this.forest).map(t => t.force(depth - 1)),
    }
  }

  /** returns the last but leftmost subtree without any backtracking
   where the property is true */
  left_first_search<B>(p: (a: A) => B | undefined, fuel = -1): {match: B; fuel: number} | undefined {
    const b = p(this.top)
    if (b) {
      return dfs(b, p, this, fuel)
    } else {
      return undefined
    }
  }

  async left_first_search_async<B>(p: (a: A) => Promise<B | undefined>, fuel = -1): Promise<{match: B; fuel: number} | undefined> {
    const b = await p(this.top)
    if (b !== undefined) {
      return dfsAsync(b, p, this, fuel)
    } else {
      return undefined
    }
  }
}


/** Searches from the children of the tree */
export function dfs<A, B>(
  b: B,
  p: (a: A) => B | undefined,
  tree: Tree<A>,
  fuel: number
): {match: B; fuel: number} {
  let child = Lz.force(tree.forest)
  while (child !== undefined) {
    if (fuel == 0) {
      break
    }
    fuel--
    const b2 = p(child.head.top)
    if (b2 !== undefined) {
      return dfs(b2, p, child.head, fuel)
    }
    child = Lz.force(child.tail)
  }
  return {match: b, fuel}
}

/** Searches from the children of the tree */
export async function dfsAsync<A, B>(
  b: B,
  p: (a: A) => Promise<B | undefined>,
  tree: Tree<A>,
  fuel: number
): Promise<{match: B, fuel: number}> {
  let child = Lz.force(tree.forest)
  while (child !== undefined) {
    if (fuel == 0) {
      break
    }
    fuel--
    const b2 = await p(child.head.top)
    if (b2 !== undefined) {
      return dfsAsync(b2, p, child.head, fuel)
    }
    child = Lz.force(child.tail)
  }
  return {match: b, fuel}
}

export function shrinkNumber(n: number, towards: number = 0): Tree<number> {
  if (towards != 0) {
    return shrinkNumber(towards - n).map(i => towards - i)
  } else if (n < 0) {
    return shrinkNumber(-n).map(i => -i)
  } else {
    return (function go(x: number): Tree<number> {
      return new Tree(x, Lz.map(go, halves(x)))
    })(n)
  }
}

const resolution = 0.01

// less(a, b) is "morally" abs a < abs b, but taking care of overflow.
function less(a: number, b: number): boolean {
  const nna = a >= 0
  const nnb = b >= 0

  if (nna && nnb) {
    return a < b
  } else if (!nna && !nnb) {
    return a > b
  } else if (nna && !nnb) {
    return a + b < 0
  } else {
    return a + b > 0
  }
}

const half = (i: number) => Math.floor(i / 2)

// This is Test.QuickCheck.Arbitrary.shrinkIntegral from Haskell QuickCheck:
// https://github.com/nick8325/quickcheck/blob/0d547a497b6608c34310ab604f63e4ee6721fd21/Test/QuickCheck/Arbitrary.hs#L1079
function halves(x: number): Lz.LazyList<number> {
  if (x != Math.round(x)) {
    return halves(Math.round(x))
  }
  return Lz.takeWhile<number>(
    i => less(i, x),
    Lz.cons(0, Lz.map(i => x - i, Lz.iterate(half(x), half)))
  )



}
