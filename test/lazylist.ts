import * as Lz from '../src/lazylist'
import * as QC from '../src/main'
import * as Gen from '../src/main'
import * as Utils from '../src/Utils'
import * as test from 'tape'

const check = QC.adaptTape(test)

const ListGen = <A>(g: QC.Gen<A>) =>
  Gen.rec<Lz.LazyList<A>>((tie, size) =>
    Gen.frequency<Lz.LazyList<A>>([
      [1, Gen.of(Lz.nil)],
      [size, g.chain(x => tie().map(xs => Lz.cons(x, xs)))],
    ])
  )

check('assoc', ListGen(Gen.bin).three(), ([a, b, c], p) =>
  p.equals(Lz.toArray(Lz.concat(a, Lz.concat(b, c))), Lz.toArray(Lz.concat(Lz.concat(a, b), c)))
)

check('left ident', ListGen(Gen.bin), (a, p) =>
  p.equals(Lz.toArray(Lz.concat(Lz.nil, a)), Lz.toArray(a))
)

check('right ident', ListGen(Gen.bin), (a, p) =>
  p.equals(Lz.toArray(Lz.concat(a, Lz.nil)), Lz.toArray(a))
)
