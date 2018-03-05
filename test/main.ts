import * as QC from '../src/main'
import * as Gen from '../src/main'
import * as Utils from '../src/Utils'
import * as test from 'tape'

const check = QC.adaptTape(test)

const string_permute = (s: string) => Gen.permute(s.split('')).map(xs => xs.join(''))

import * as assert from 'assert'

check(
  'permute',
  Gen.record({
    a: string_permute('aaaaaaacaaaa'),
    b: string_permute('dbbbbbbbbbbb'),
  }),
  r => r.a < r.b,
  QC.expectFailure
)

check.skip('skips false property', Gen.of({}), _ => false)

check(
  'lower-upper record',
  Gen.record({l: Gen.nestring(Gen.lower), u: Gen.nestring(Gen.upper)}).map(r => r.l + r.u),
  s => null != s.match(/^[a-z]+[A-Z]+$/)
)

check(
  'lower-upper sequence',
  Gen.sequence([Gen.nestring(Gen.lower), Gen.nestring(Gen.upper)]).map(xs => xs.join('')),
  s => null != s.match(/^[a-z]+[A-Z]+$/)
)

check(
  'lower-upper QC.expectFailure',
  Gen.sequence([Gen.nestring(Gen.lower), Gen.nestring(Gen.upper)]).map(xs => xs.join('')),
  s => null != s.match(/^([a-zA-Z]){0,20}$/),
  QC.expectFailure
)

check(
  'traverse homomorphic',
  Gen.nat.pojo().replicate(2),
  ([a, b], p) => {
    const k = (r: typeof a) => Utils.record_traverse(r, (v, k) => ({k, v}))
    return p.equals(k(a).concat(k(b)), k({...a, ...b}))
  },
  QC.option({
    expectFailure: true,
    maxShrinks: 10, // shrinking is very slow for this example so let's disable it for now
  })
)

check('traverse homomorphic with no overlap', Gen.nat.pojo().replicate(2), ([a, b], p) => {
  const k = (r: typeof a) => Utils.record_traverse(r, (v, k) => ({k, v}))
  const overlap = Object.keys(a).some(k => Object.keys(b).some(k2 => k == k2))
  p.cover(!overlap, 75, '!overlap')
  return overlap || p.equals(k(a).concat(k(b)), k({...a, ...b}))
})

check('gen join left', Gen.record({i: Gen.bin, seed: Gen.nat, size: Gen.pos}), d =>
  Utils.deepEquals(
    Gen.of(Gen.of(d.i))
      .chain(g => g)
      .sample(d.size, d.seed),
    Gen.of(d.i).sample(d.size, d.seed)
  )
)

check('gen join right', Gen.record({i: Gen.bin, seed: Gen.nat, size: Gen.pos}), d =>
  Utils.deepEquals(
    Gen.of(d.i)
      .chain(j => Gen.of(j))
      .sample(d.size, d.seed),
    Gen.of(d.i).sample(d.size, d.seed)
  )
)

check('one', Gen.bin.one(), xs => xs.length == 1)
check('two', Gen.bin.two(), xs => xs.length == 2)
check('three', Gen.bin.three(), xs => xs.length == 3)
check('four', Gen.bin.four(), xs => xs.length == 4)

check('nat', Gen.nat, x => x >= 0)
check('nat', Gen.nat, x => x > 0, QC.expectFailure)
check('nat', Gen.nat, x => x < 0, QC.expectFailure)

check('int', Gen.int, x => x >= 0, QC.expectFailure)
check('int', Gen.int, x => x <= 0, QC.expectFailure)

check('pos', Gen.pos, x => x > 0)
check('pos', Gen.pos, x => x <= 0, QC.expectFailure)

check('neg', Gen.neg, x => x < 0)
check('neg', Gen.neg, x => x >= 0, QC.expectFailure)

check('replicate', Gen.nat.replicate(10), xs => xs.length == 10)
check('array', Gen.nat.array(), xs => xs.length >= 0)
check('array', Gen.nat.array(), xs => xs.length > 0, QC.expectFailure)
check('nearray', Gen.nat.nearray(), xs => xs.length > 0)
check('upper', Gen.upper, s => null != s.match(/^[A-Z]$/))
check('lower', Gen.lower, s => null != s.match(/^[a-z]$/))
check('alpha', Gen.alpha, s => null != s.match(/^[A-Za-z]$/))
check('whitespace', Gen.whitespace, s => null != s.match(/^[ \n\t]$/))
check('alphanum', Gen.alphanum, s => null != s.match(/^[A-Za-z0-9]$/))
check('digit', Gen.digit, s => null != s.match(/^[0-9]$/))
check('upper->lower', Gen.upper.map(u => u.toLowerCase()), s => null != s.match(/^[a-z]$/))

check('char.string', Gen.char('ab').nestring(), s => s.length > 0)

const within = (l: number, x: number, u: number) => x >= l && x < u

const R = Utils.fromTo(1, 4)
R.forEach(l =>
  R.forEach(
    u =>
      Math.abs(u - l) == 1 ||
      check(
        `between(${l}, ${u})`,
        Gen.between(u, l),
        (x, p) =>
          Utils.fromTo(l, u + 1).forEach(i => p.cover(x == i, 20, i + '')) ||
          within(Math.min(l, u), x, Math.max(l, u) + 1)
      )
  )
)

R.forEach(b =>
  check(
    `range(${b})`,
    Gen.range(b),
    (x, p) => Utils.range(b).forEach(i => p.cover(x == i, 20, i + '')) || within(0, x, b)
  )
)

const u32gens = {
  natural: QC.natural,
  positive: QC.positive.map(x => x - 1),
  integer: QC.integer.map(x => Math.abs(x)),
  negative: QC.negative.map(x => -x),
}

Utils.record_forEach(u32gens, (g, name) => {
  check(
    'u32 distribution ' + name,
    g,
    (x, p) => {
      const mid = 1 << 30
      p.cover(x < mid, 49, 'small')
      p.cover(x >= mid, 49, 'big')
      return true
    },
    QC.option({tests: 10000})
  )

  check('u32 range ' + name, g, x => within(0, x, ~(1 << 31)), QC.option({tests: 10000}))
})

check(
  'integer negative distribution',
  QC.integer,
  (x, p) => p.cover(x < 0, 49, 'negative') || true,
  QC.option({tests: 10000})
)

test('unexpected success', t => {
  const res = QC.search(Gen.nat, x => x >= 0, QC.expectFailure)
  const reason = res.ok ? '?' : res.reason
  t.deepEquals(reason, 'unexpected success')
  t.end()
})

test('unexpected success', t => {
  const res = QC.search(Gen.nat, x => x > 0, QC.expectFailure)
  t.deepEquals(res.ok, true)
  t.true((res as any).expectedFailure)
  t.end()
})

test('exception evaluating', t => {
  const res = QC.search(Gen.of({}), _ => {
    throw 'OOPS'
  })
  t.deepEquals(res.ok, false)
  t.deepEquals((res as any).reason, 'exception')
  t.deepEquals((res as any).when, 'evaluating')
  t.end()
})

test('exception generating', t => {
  const res = QC.search(
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
  const res = QC.search(Gen.nat, (x, p) => {
    p.cover(x > 10, 75, '>10')
    return x >= 0
  })
  const reason = res.ok ? '?' : res.reason
  t.deepEquals(reason, 'insufficient coverage', JSON.stringify(res.covers))
  t.end()
})

check('permute', Gen.permute(Utils.range(5)), (xs, p) => {
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

test('forall exceptions catches counterexamples, fully shrunk', t => {
  t.plan(3)
  try {
    QC.forall(QC.nat.replicate(2), ([x, y]) => {
      assert(x + 10 > y)
      return true
    })
  } catch (e) {
    t.true(e.message.toString().match(/^Exception when evaluating/m))
    t.true(e.message.toString().match(/^Exception occured with this input/m))
    t.true(e.message.toString().match(/^\[0, 10\]/m))
  }
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
