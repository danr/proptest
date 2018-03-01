import {Gen, Tree, tape_adapter, option, QuickCheck} from '../src/main'
import * as Utils from '../src/Utils'
import * as main from '../src/main'
import * as test from 'tape'

const qc = tape_adapter(test)

const GTree = <A>(g: Gen<A>) =>
  Gen.size().then(s0 => {
    function go(s: number): Gen<Tree<A>> {
      return Gen.frequency([
        [1, g.map(Tree.pure)],
        [
          s,
          g.then(top =>
            Gen.range(2, 5).then(n =>
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

qc(
  'lower-upper record',
  Gen.record({l: Gen.nestring(Gen.lower), u: Gen.nestring(Gen.upper)}).map(r => r.l + r.u),
  s => null != s.match(/^[a-z]+[A-Z]+$/)
)
qc(
  'lower-upper sequence',
  Gen.sequence([Gen.nestring(Gen.lower), Gen.nestring(Gen.upper)]).map(xs => xs.join('')),
  s => null != s.match(/^[a-z]+[A-Z]+$/)
)

qc(
  'lower-upper expectFailure',
  Gen.sequence([Gen.nestring(Gen.lower), Gen.nestring(Gen.upper)]).map(xs => xs.join('')),
  s => null != s.match(/^([a-zA-Z]){0,20}$/),
  main.option({expectFailure: true})
)

qc(
  'traverse homomorphic',
  Gen.nat.pojo().replicate(2),
  ([a, b], p) => {
    const k = (r: typeof a) => Utils.record_traverse(r, (v,k) => ({k,v}))
    return p.deepEquals(k(a).concat(k(b)), k({...a, ...b}))
  },
  main.option({expectFailure: true})
  )

qc(
  'traverse homomorphic with no overlap',
  Gen.nat.pojo().replicate(2),
  ([a, b], p) => {
    const k = (r: typeof a) => Utils.record_traverse(r, (v,k) => ({k,v}))
    const overlap = Object.keys(a).some(k => Object.keys(b).some(k2 => k == k2))
    p.cover(!overlap, 85, '!overlap')
    return overlap || p.deepEquals(
      k(a).concat(k(b)),
      k({...a, ...b}))
  },
  )


qc(
  'tree join left',
  GTree(Gen.nat),
  t =>
    Utils.deepEquals(
      Tree.pure(t)
        .then(t => t)
        .force(),
      t.force()
    ),
  option({verbose: true})
)

qc('tree join right', GTree(Gen.nat), t =>
  Utils.deepEquals(t.then(j => Tree.pure(j)).force(), t.force())
)

qc('gen join left', Gen.record({i: Gen.nat, seed: Gen.nat, size: Gen.size()}), d =>
  Utils.deepEquals(
    Gen.pure(Gen.pure(d.i))
      .then(g => g)
      .sample(d.size, d.seed),
    Gen.pure(d.i).sample(d.size, d.seed)
  )
)

qc('gen join right', Gen.record({i: Gen.nat, seed: Gen.nat, size: Gen.size()}), d =>
  Utils.deepEquals(
    Gen.pure(d.i)
      .then(j => Gen.pure(j))
      .sample(d.size, d.seed),
    Gen.pure(d.i).sample(d.size, d.seed)
  )
)

qc('nat', Gen.nat, x => x >= 0)
qc('nat', Gen.nat, x => x > 0, option({expectFailure: true}))
qc('nat', Gen.nat, x => x < 0, option({expectFailure: true}))

qc('int', Gen.int, x => x >= 0, option({expectFailure: true}))
qc('int', Gen.int, x => x <= 0, option({expectFailure: true}))

qc('pos', Gen.pos, x => x > 0)
qc('pos', Gen.pos, x => x <= 0, option({expectFailure: true}))

qc('neg', Gen.neg, x => x < 0)
qc('neg', Gen.neg, x => x >= 0, option({expectFailure: true}))

qc('replicate', Gen.nat.replicate(10), xs => xs.length == 10)
qc('array', Gen.nat.array(), xs => xs.length >= 0)
qc('array', Gen.nat.array(), xs => xs.length > 0, option({expectFailure: true}))
qc('nearray', Gen.nat.nearray(), xs => xs.length > 0)
qc('upper', Gen.upper, s => null != s.match(/^[A-Z]$/))
qc('lower', Gen.lower, s => null != s.match(/^[a-z]$/))
qc('alpha', Gen.alpha, s => null != s.match(/^[A-Za-z]$/))
qc('whitespace', Gen.whitespace, s => null != s.match(/^[ \n\t]$/))
qc('alphanum', Gen.alphanum, s => null != s.match(/^[A-Za-z0-9]$/))
qc('digit', Gen.digit, s => null != s.match(/^[0-9]$/))
qc('upper->lower', Gen.upper.map(u => u.toLowerCase()), s => null != s.match(/^[a-z]$/))

test('unexpected success', t => {
  const res = QuickCheck(Gen.nat, x => x >= 0, option({expectFailure: true}))
  const reason = res.ok ? '?' : res.reason
  t.deepEquals(reason, 'unexpected success')
  t.end()
})

test('unexpected success', t => {
  const res = QuickCheck(Gen.nat, x => x > 0, option({expectFailure: true}))
  t.deepEquals(res.ok, true)
  t.true((res as any).expectedFailure)
  t.end()
})

test('cov', t => {
  const res = QuickCheck(Gen.nat, (x, p) => {
    p.cover(x > 10, 75, '>10')
    return x >= 0
  })
  const reason = res.ok ? '?' : res.reason
  t.deepEquals(reason, 'insufficient coverage', JSON.stringify(res.covers))
  t.end()
})

/*

const STree = <A>(g: Gen<A>) => GTree(g).map(t => t.force())

Utils.fromTo(1,20).map(i =>
  console.log({
      i,
      size: Utils.size(STree(Gen.alpha).replicate(10).sample(i)),
      ssize: Utils.size(STree(STree(Gen.alpha)).replicate(10).sample(i)),
      sssize: Utils.size(STree(STree(STree(Gen.alpha))).replicate(10).sample(i)),
      // aa: Utils.size(Gen.nat.array().array().replicate(100).sample(i)),
      raa: Utils.size(Gen.nat.resize(i => i / 4).array().array().replicate(100).sample(i)),
      ara: Utils.size(Gen.nat.array().resize(i => i / 4).array().replicate(100).sample(i)),
      aar: Utils.size(Gen.nat.array().array().resize(i => i / 4).replicate(100).sample(i)),
      arar: Utils.size(Gen.nat.array().resize(i => i / 2).array().resize(i => i / 2).replicate(100).sample(i)),
      // dblsize: Utils.size(STree(STree(Gen.alpha)).replicate(10).sample(i))
    })
  )
  */
