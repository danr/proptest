import * as QC from '../src/main'
import * as Gen from '../src/main'
import * as Utils from '../src/Utils'
import * as Tree from '../src/Tree'
import * as test from 'tape'

const check = QC.adaptTape(test)

check('shrinks to a small list of small nats', Gen.nat.array().small(), (target, p) => {
  const r = QC.search(
    Gen.nat.replicate(target.length),
    xs => xs.some((x, i) => x < target[i]),
    QC.option({maxShrinks: 1000})
  )
  if (!r.ok && r.reason == 'counterexample') {
    return p.equals(r.counterexample, target)
  } else {
    return false
  }
})

check(
  'shrinks to a list of zeroes',
  Gen.nat,
  (i, p) => {
    const target = Utils.range(i).map(_ => 0)
    const r = QC.search(Gen.bin.array().big(), xs => xs.length < i, QC.option({maxShrinks: i * 20}))
    if (!r.ok && r.reason == 'counterexample') {
      return p.equals(r.counterexample, target)
    } else {
      return false
    }
  },
  QC.option({tests: 20})
)

test(`shrinking finds counter example in few steps`, t => {
  t.plan(2)
  let found = false
  let called = 0
  const r = QC.search(
    Gen.natural,
    x => {
      const result = x < 10000
      if (result === false) {
        if (found) {
          called++
        } else {
          found = true
        }
      }
      return result
    },
    QC.option({maxShrinks: 1000})
  )
  t.ok(called < 25)
  if (!r.ok && r.reason == 'counterexample') {
    t.deepEquals(r.counterexample, 10000)
  }
})

check('binary search natural', Gen.natural.map(i => Math.ceil(i * 0.75)), i => {
  const r = QC.search(Gen.natural, x => x < i, QC.option({maxShrinks: 500}))
  if (!r.ok && r.reason == 'counterexample') {
    return r.counterexample === i
  } else {
    return false
  }
})

check('binary search float', Gen.floatBetween(0, 1 << 29), i => {
  const r = QC.search(Gen.floatBetween(0, 1 << 30), x => x < i, QC.option({maxShrinks: 500}))
  if (!r.ok && r.reason == 'counterexample') {
    const d = Math.abs(r.counterexample - i)
    return d < 1
  } else {
    return false
  }
})

check(
  'binary search three naturals',
  Gen.natural.map(i => Math.ceil(i * 0.5)).three(),
  (is, p) => {
    const r = QC.search(
      Gen.natural.three(),
      xs => xs.some((x, i) => x < is[i]),
      QC.option({maxShrinks: 5000})
    )
    if (!r.ok && r.reason == 'counterexample') {
      return p.equals(r.counterexample, is)
    } else {
      return false
    }
  },
  QC.option({tests: 20})
)

test('smallest failing log returned after shrinking', t => {
  let last: null | number =  null
  const r = QC.search(Gen.natural, (x, p) => {
    last = x
    p.log(x)
    return x < 84000
  })
  if (!r.ok && r.reason == 'counterexample') {
    t.equal(r.counterexample, 84000)
    t.deepEqual(r.log, [[84000]])
    t.deepEqual(last, 83999)
    t.end()
  } else {
    t.fail()
  }
})
