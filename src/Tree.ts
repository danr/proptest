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

  /** returns the last but leftmost subtree without any backtracking
   where the property is true */
  left_first_search(p: (a: A) => boolean, fuel = -1): {tree: Tree<A>; fuel: number} | undefined {
    if (p(this.top)) {
      return dfs(p, this, fuel)
    } else {
      return undefined
    }
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

/** Assumes that the property already holds for the top of the tree. */
export function dfs<A>(
  p: (a: A) => boolean,
  tree: Tree<A>,
  fuel: number
): {tree: Tree<A>; fuel: number} | undefined {
  let child = Lz.force(tree.forest)
  while (child !== undefined) {
    if (fuel == 0) {
      break
    }
    fuel--
    if (p(child.head.top)) {
      return dfs(p, child.head, fuel)
    }
    child = Lz.force(child.tail)
  }
  return {tree, fuel}
}
