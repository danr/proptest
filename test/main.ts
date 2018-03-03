import {
  Gen,
  Tree,
  tape_adapter,
  expectFailure,
  random_seed,
  QuickCheck,
} from '../src/main'
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
  Gen.letrec1(g.map(Tree.pure), (tree, size) =>
    g.then(top =>
      Gen.between(2, 5).then(n =>
        tree(size / n)
          .replicate(n)
          .map(forest => new Tree(top, () => forest))
      )
    )
  )

export type List<A> = null | { hd: A, tl : List<A>}

const list = Gen.letrec1<List<number>>(
  Gen.pure(null),
  more => Gen.record({hd: Gen.bin, tl: more()})
)

qc(
  'list sizes',
  list,
  (xs, p) => console.log(Utils.show(xs)) || p.label(Utils.size(xs)) || true
  , undefined,
//  t => t.only
)


const list2 = Gen.pure(null as List<number>).letrec1(
  more => Gen.record({hd: Gen.bin, tl: more()})
)

export type Even<A, B> = null | { hd: A, tl : Odd<A, B>}
export type Odd<A, B> = null | { hd: B, tl : Even<A, B> }

const eo = <A, B>(a: Gen<A>, b: Gen<B>) => Gen.letrec<{Even: Even<A, B>, Odd: Odd<A, B>}>({
  Even: Gen.pure(null),
  Odd: Gen.pure(null),
}, {
  Even: (rec, s) =>  Gen.record({hd: a, tl: rec.Odd()}),
  Odd:  (rec, s) =>  Gen.record({hd: b, tl: rec.Even()}),
})

qc(
  'eo sizes',
  eo(Gen.bin, Gen.char('ab')).map(r => r.Even),
  (e, p) => console.log(Utils.show(e)) || p.label(Utils.size(e)) || true
  ,
  QC.option({tests: 12}),
   t => t.only
)




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
  p.cover(!overlap, 85, '!overlap')
  return overlap || p.deepEquals(k(a).concat(k(b)), k({...a, ...b}))
})

qc('tree join left', GTree(Gen.nat), t =>
  Utils.deepEquals(
    Tree.pure(t)
      .then(t => t)
      .force(),
    t.force()
  )
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

test('unexpected success', t => {
  const res = QuickCheck(Gen.nat, x => x >= 0, expectFailure)
  const reason = res.ok ? '?' : res.reason
  t.deepEquals(reason, 'unexpected success')
  t.end()
})

test('unexpected success', t => {
  const res = QuickCheck(Gen.nat, x => x > 0, expectFailure)
  t.deepEquals(res.ok, true)
  t.true((res as any).expectedFailure)
  t.end()
})

test('exception evaluating', t => {
  const res = QuickCheck(Gen.pure({}), _ => {
    throw 'OOPS'
  })
  t.deepEquals(res.ok, false)
  t.deepEquals((res as any).reason, 'exception')
  t.deepEquals((res as any).when, 'evaluating')
  t.end()
})

test('exception generating', t => {
  const res = QuickCheck(
    Gen.pure({}).then(_ => {
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
  const res = QuickCheck(Gen.nat, (x, p) => {
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