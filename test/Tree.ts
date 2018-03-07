import {Tree, shrinkNumber} from '../src/Tree'
import * as Lz from '../src/lazylist'
import * as QC from '../src/main'
import * as Gen from '../src/main'
import * as Utils from '../src/Utils'
import * as test from 'tape'

const check = QC.adaptTape(test)

test('dfs only forces the path it takes', t => {
  t.plan(1)
  let called = 0
  const tree = shrinkNumber(100000, 0).map(n => {
    called++
    return n
  })
  tree.left_first_search(n => n > 0)
  t.ok(called < 40)
})

const recTree = <A>(g: QC.Gen<A>) =>
  Gen.rec<Tree<A>>((tie, size) =>
    g.chain(top =>
      (size > 0 ? Gen.between(2, 5) : Gen.of(0)).chain(n =>
        tie(size / (n + 1))
          .replicate(n)
          .map(forest => new Tree(top, Lz.fromArray(forest)))
      )
    )
  )

const letrecTree = <A>(g: QC.Gen<A>) =>
  Gen.letrec<{Tree: Tree<A>; List: Lz.LazyList<Tree<A>>}>({
    Tree(tie, size) {
      return g.chain(top =>
        (size > 0 ? Gen.between(2, 5) : Gen.of(1)).chain(n =>
          tie.List(size / n).map(forest => new Tree(top, forest))
        )
      )
    },
    List(tie, size) {
      return Gen.lazyFrequency<Lz.LazyList<Tree<A>>>([
        [1, () => Gen.of(Lz.nil)],
        [size, () => tie.Tree().chain(x => tie.List().map(xs => Lz.cons(x, xs)))],
      ])
    },
  })

const versions = {
  rec: recTree(Gen.bin),
  letrec: letrecTree(Gen.bin).Tree,
}

Utils.record_forEach(versions, (TreeGen, version) => {
  const tap = <A>(a: A) => console.log(JSON.stringify(a, undefined, 2)) || a

  check(version + ' tree join left', TreeGen, (t, p) =>
    p.equals(
      Tree.of(t)
        .chain(t => t)
        .force(),
      t.force()
    )
  )

  check(version + ' tree join right', TreeGen, (t, p) =>
    p.equals(t.chain(j => Tree.of(j)).force(), t.force())
  )
})
