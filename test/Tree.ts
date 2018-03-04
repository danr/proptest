import {Tree} from '../src/Tree'
import * as QC from '../src/main'
import * as Gen from '../src/main'
import * as test from 'tape'

const check = QC.tape_adapter(test)

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
                .map(tree => new Tree(top, () => tree))
            )
          ),
        ],
      ])
    }
    return go(s0)
  })

check('tree join left', GTree(Gen.nat), (t, p) =>
  p.deepEquals(
    Tree.of(t)
      .chain(t => t)
      .force(),
    t.force()
  )
)

check('tree join right', GTree(Gen.bin), (t, p) =>
  p.deepEquals(t.chain(j => Tree.of(j)).force(), t.force())
)
