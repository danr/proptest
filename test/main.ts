import {Gen, tape_adapter, option, QuickCheck} from '../src/main'
import * as main from '../src/main'
import * as test from 'tape'

const qc = tape_adapter(test)

qc('nat', Gen.nat, x => x >= 0)
qc('nat', Gen.nat, x => x > 0, option({expectFailure: true}))

qc('replicate', Gen.nat.replicate(10), xs => xs.length == 10)
qc('array', Gen.nat.array(), xs => xs.length > 0, option({expectFailure: true}))
qc('nearray', Gen.nat.nearray(), xs => xs.length > 0)
qc('upper', Gen.upper, s => null != s.match(/^[A-Z]$/))
qc('lower', Gen.lower, s => null != s.match(/^[a-z]$/))
qc('alpha', Gen.alpha, s => null != s.match(/^[A-Za-z]$/))
qc('upper->lower', Gen.upper.map(u => u.toLowerCase()), s => null != s.match(/^[a-z]$/))
qc('nestring', Gen.nearray(Gen.alpha), s =>( console.log(s), s.length > 0))

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

