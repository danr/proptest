import * as Utils from './Utils'

export interface StrictTree<A> {
  readonly top: A
  readonly forest: StrictTree<A>[]
}

export class Tree<A> {
  constructor(readonly top: A, readonly forest: () => Tree<A>[]) {}
  static pure<A>(a: A): Tree<A> {
    return new Tree(a, () => [])
  }
  static tree<A>(top: A, forest: () => Tree<A>[]): Tree<A> {
    return new Tree(top, forest)
  }
  static tree$<A>(top: A, forest: Tree<A>[]): Tree<A> {
    return new Tree(top, () => forest)
  }
  map<B>(f: (a: A, depth: number) => B): Tree<B> {
    return this.then((a: A, depth: number) => Tree.pure(f(a, depth)))
  }
  then<B>(f: (a: A, depth: number) => Tree<B>, depth = 0): Tree<B> {
    const t = f(this.top, depth)
    return new Tree(t.top, () => [...this.forest().map(t => t.then(f, depth + 1)), ...t.forest()])
  }

  left_first_pair<B>(tb: Tree<B>): Tree<[A, B]> {
    return this.then(a => tb.then(b => Tree.pure(Utils.pair(a, b))))
  }
  fair_pair<B>(tb: Tree<B>): Tree<[A, B]> {
    return Tree.dist({a: this, b: tb}).map(p => Utils.pair(p.a, p.b))
  }

  left_first_search(p: (a: A) => boolean, fuel = -1): Tree<A> | undefined {
    // used for shrinking
    // returns the last but leftmost subtree without any backtracking where the property is true
    if (p(this.top)) {
      if (fuel == 0) {
        return this
      }
      const forest = this.forest()
      for (let i = 0; i < forest.length; i++) {
        const res = forest[i].left_first_search(p, fuel - 1)
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
      return trees[k].forest().map(t => Tree.dist({...(trees as any), [k]: t}) as Tree<T>)
    }
    return new Tree<T>(Utils.dict(keys, k => trees[k].top), () =>
      Utils.flatten(keys.map(shrink_one))
    )
  }

  /** distribute array fairly */
  static dist_array<A>(trees: Tree<A>[]): Tree<A[]> {
    const length = trees.length
    return Tree.dist(trees as any).map(t => Array.from({...t, length}))
  }

  force(depth: number = -1): StrictTree<A> {
    return {
      top: this.top,
      forest: depth == 0 ? [] : this.forest().map(t => t.force(depth - 1)),
    }
  }
}
