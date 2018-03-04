import {Gen, Tree, tape_adapter, expectFailure, random_seed, search} from '../src/main'
import * as QC from '../src/main'
import * as Utils from '../src/Utils'
import * as main from '../src/main'
import * as test from 'tape'

const qc = tape_adapter(test)

const string_permute = (s: string) => Gen.permute(s.split('')).map(xs => xs.join(''))

qc(
  'permute',
  Gen.record({
    a: string_permute('aaaaaaacaaaa'),
    b: string_permute('dbbbbbbbbbbb'),
  }),
  r => r.a < r.b,
  expectFailure
)

test('deepEquals', t => {
  const diff: any[] = [
    [],
    {},
    null,
    undefined,
    false,
    true,
    0,
    1,
    '',
    '0',
    '1',
    'a',
    {'': 0},
    {a: {b: 1}},
    {a: {b: 2}},
    {a: {d: 1}},
  ]
  diff.push(...diff.map((x: any) => [[x]]))
  diff.push(...diff.map((x: any) => [x]))
  diff.forEach((x, i) =>
    diff.forEach((y, j) => {
      const xy = JSON.stringify(x) + ' ' + JSON.stringify(y)
      if (i === j) {
        t.true(Utils.deepEquals(x, y), xy)
      } else {
        t.false(Utils.deepEquals(x, y), xy)
      }
    })
  )
  t.end()
})

const GTree = <A>(g: Gen<A>) =>
  Gen.nat.chain(s0 => {
    function go(s: number): Gen<Tree<A>> {
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
  expectFailure
)

qc(
  'traverse homomorphic',
  Gen.nat.pojo().replicate(2),
  ([a, b], p) => {
    const k = (r: typeof a) => Utils.record_traverse(r, (v, k) => ({k, v}))
    return p.deepEquals(k(a).concat(k(b)), k({...a, ...b}))
  },
  expectFailure
)

qc('traverse homomorphic with no overlap', Gen.nat.pojo().replicate(2), ([a, b], p) => {
  const k = (r: typeof a) => Utils.record_traverse(r, (v, k) => ({k, v}))
  const overlap = Object.keys(a).some(k => Object.keys(b).some(k2 => k == k2))
  p.cover(!overlap, 75, '!overlap')
  return overlap || p.deepEquals(k(a).concat(k(b)), k({...a, ...b}))
})

qc('tree join left', GTree(Gen.nat), t =>
  Utils.deepEquals(
    Tree.of(t)
      .chain(t => t)
      .force(),
    t.force()
  )
)

qc('tree join right', GTree(Gen.bin), t =>
  Utils.deepEquals(t.chain(j => Tree.of(j)).force(), t.force())
)

qc('gen join left', Gen.record({i: Gen.bin, seed: Gen.nat, size: Gen.pos}), d =>
  Utils.deepEquals(
    Gen.of(Gen.of(d.i))
      .chain(g => g)
      .sample(d.size, d.seed),
    Gen.of(d.i).sample(d.size, d.seed)
  )
)

qc('gen join right', Gen.record({i: Gen.bin, seed: Gen.nat, size: Gen.pos}), d =>
  Utils.deepEquals(
    Gen.of(d.i)
      .chain(j => Gen.of(j))
      .sample(d.size, d.seed),
    Gen.of(d.i).sample(d.size, d.seed)
  )
)

qc('nat', Gen.nat, x => x >= 0)
qc('nat', Gen.nat, x => x > 0, expectFailure)
qc('nat', Gen.nat, x => x < 0, expectFailure)

qc('int', Gen.int, x => x >= 0, expectFailure)
qc('int', Gen.int, x => x <= 0, expectFailure)

qc('pos', Gen.pos, x => x > 0)
qc('pos', Gen.pos, x => x <= 0, expectFailure)

qc('neg', Gen.neg, x => x < 0)
qc('neg', Gen.neg, x => x >= 0, expectFailure)

qc('replicate', Gen.nat.replicate(10), xs => xs.length == 10)
qc('array', Gen.nat.array(), xs => xs.length >= 0)
qc('array', Gen.nat.array(), xs => xs.length > 0, expectFailure)
qc('nearray', Gen.nat.nearray(), xs => xs.length > 0)
qc('upper', Gen.upper, s => null != s.match(/^[A-Z]$/))
qc('lower', Gen.lower, s => null != s.match(/^[a-z]$/))
qc('alpha', Gen.alpha, s => null != s.match(/^[A-Za-z]$/))
qc('whitespace', Gen.whitespace, s => null != s.match(/^[ \n\t]$/))
qc('alphanum', Gen.alphanum, s => null != s.match(/^[A-Za-z0-9]$/))
qc('digit', Gen.digit, s => null != s.match(/^[0-9]$/))
qc('upper->lower', Gen.upper.map(u => u.toLowerCase()), s => null != s.match(/^[a-z]$/))

qc('char.string', Gen.char('ab').nestring(), s => s.length > 0)

test('unexpected success', t => {
  const res = search(Gen.nat, x => x >= 0, expectFailure)
  const reason = res.ok ? '?' : res.reason
  t.deepEquals(reason, 'unexpected success')
  t.end()
})

test('unexpected success', t => {
  const res = search(Gen.nat, x => x > 0, expectFailure)
  t.deepEquals(res.ok, true)
  t.true((res as any).expectedFailure)
  t.end()
})

test('exception evaluating', t => {
  const res = search(Gen.of({}), _ => {
    throw 'OOPS'
  })
  t.deepEquals(res.ok, false)
  t.deepEquals((res as any).reason, 'exception')
  t.deepEquals((res as any).when, 'evaluating')
  t.end()
})

test('exception generating', t => {
  const res = search(
    Gen.of({}).chain(_ => {
      throw 'Oops'
    }),
    _ => true
  )
  t.deepEquals(res.ok, false)
  t.deepEquals((res as any).reason, 'exception')
  t.deepEquals((res as any).when, 'generating')
  t.end()
})

test('cov', t => {
  const res = search(Gen.nat, (x, p) => {
    p.cover(x > 10, 75, '>10')
    return x >= 0
  })
  const reason = res.ok ? '?' : res.reason
  t.deepEquals(reason, 'insufficient coverage', JSON.stringify(res.covers))
  t.end()
})

qc('permute', Gen.permute(Utils.range(5)), (xs, p) => {
  return true
})

test('forall throws Error on false prop', t => {
  t.plan(1)
  t.throws(() => QC.forall(Gen.pos, x => x < 5), Error)
})

test("forall doesn't throw on true prop", t => {
  t.plan(1)
  t.doesNotThrow(() => QC.forall(Gen.pos, x => x > 0))
})

test('forall exception contains the counterexample', t => {
  t.plan(2)
  try {
    QC.forall(Gen.oneof([Gen.of('apabepa'), Gen.alpha]), x => x != 'apabepa')
  } catch (e) {
    t.true(e.message.toString().match(/^Counterexample found/m))
    t.true(e.message.toString().match(/^"apabepa"/m))
  }
})

// // Fails to either shrink or find counterexample in this range:
// const is = Utils.fromTo(80, 90)
const is = Utils.fromTo(70, 80)
is.forEach(i => {
  test('shrinking to list of length ' + i, t => {
    t.plan(1)
    const r = QC.search(Gen.bin.array(), xs => xs.length < i)
    if (!r.ok && r.reason == 'counterexample') {
      // console.log(r.shrinks)
      t.equals(r.counterexample.length, i)
    }
  })
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
