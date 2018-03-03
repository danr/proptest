import * as Utils from './Utils'

export interface StrictTree<A> {
  readonly top: A
  readonly forest: StrictTree<A>[]
}

let then_count = 0

export class Tree<A> {
  constructor(readonly top: A, readonly forest: () => Tree<A>[]) {}
  static of<A>(a: A): Tree<A> {
    return new Tree(a, () => [])
  }
  static tree<A>(top: A, forest: () => Tree<A>[]): Tree<A> {
    return new Tree(top, forest)
  }
  static tree$<A>(top: A, forest: Tree<A>[]): Tree<A> {
    return new Tree(top, () => forest)
  }
  map<B>(f: (a: A) => B): Tree<B> {
    return this.then((a: A) => Tree.of(f(a)))
  }
  then<B>(f: (a: A) => Tree<B>): Tree<B> {
    const t = f(this.top)
    return new Tree(t.top, () => [...this.forest().map(t => t.then(f)), ...t.forest()])
  }

  left_first_pair<B>(tb: Tree<B>): Tree<[A, B]> {
    return this.then(a => tb.then(b => Tree.of(Utils.pair(a, b))))
  }
  fair_pair<B>(tb: Tree<B>): Tree<[A, B]> {
    return Tree.dist({a: this, b: tb}).map(p => Utils.pair(p.a, p.b))
  }

  left_first_search(p: (a: A) => boolean, fuel = -1): {tree: Tree<A>; fuel: number} | undefined {
    // used for shrinking
    // returns the last but leftmost subtree without any backtracking where the property is true
    function dfs(tree: Tree<A>, fuel: number): {tree: Tree<A>; fuel: number} | undefined {
      then_count = 0
      const forest = tree.forest()
      const count = then_count
      const N = forest.length
      for (let i = 0; i < forest.length; i++) {
        // console.log({fuel, N, count})
        if (fuel == 0) {
          break
        }
        fuel--
        if (p(forest[i].top)) {
          return dfs(forest[i], fuel)
        }
      }
      return {tree, fuel}
    }
    if (p(this.top)) {
      return dfs(this, fuel)
    } else {
      return undefined
    }
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
      forest: depth == 0 ? [] : this.forest().map(t => t.force(-1)),
    }
  }
}
