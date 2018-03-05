import {Tree, shrinkNumber} from '../src/Tree'
import * as Lz from '../src/lazylist'
import * as QC from '../src/main'
import * as Gen from '../src/main'
import * as test from 'tape'

const check = QC.adaptTape(test)

const GTree = <A>(g: QC.Gen<A>) =>
  Gen.nat.chain(s0 => {
    function go(s: number): QC.Gen<Tree<A>> {
      return Gen.frequency([
        [1, g.map(Tree.of)],
        [
          s,
          g.chain(top =>
            Gen.between(2, 5).chain(n =>
              go(Math.max(0, Math.round(s / n)))
                .replicate(n)
                .map(tree => new Tree(top, Lz.fromArray(tree)))
            )
          ),
        ],
      ])
    }
    return go(s0)
  })

check('tree join left', GTree(Gen.nat), (t, p) =>
  p.equals(
    Tree.of(t)
      .chain(t => t)
      .force(),
    t.force()
  )
)

check('tree join right', GTree(Gen.bin), (t, p) =>
  p.equals(t.chain(j => Tree.of(j)).force(), t.force())
)

test('dfs only forces the path it takes', t => {
  t.plan(1)
  let called = 0
  const tree = shrinkNumber(100000, 0).map(n => {
    called++
    return n
  })
  tree.left_first_search(n => n > 0)
  t.ok(called < 22)
})
