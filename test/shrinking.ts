import * as QC from '../src/main'
import * as Gen from '../src/main'
import * as Utils from '../src/Utils'
import * as Tree from '../src/Tree'
import * as test from 'tape'

{
  // Fails to either shrink fully or find counterexample for larger upper bound
  const is = Utils.fromTo(78, 80)
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
}

{
  // Fails to either shrink fully or find counterexample for larger upper bound
  const is = Utils.fromTo(78, 80)
  is.forEach(i => {
    test(`shrinking to ${i},${i} pair`, t => {
      t.plan(1)
      const r = QC.search(
        Gen.nat.replicate(2),
        ([x, y]) => x < i || y < i,
        QC.option({maxShrinks: 1000})
      )
      if (!r.ok && r.reason == 'counterexample') {
        // console.log(r.shrinks, r.tests)
        t.deepEquals(r.counterexample, [i, i])
      }
    })
  })
}

test(`shrinking finds counter example in few steps`, t => {
  t.plan(2)
  let found = false
  let called = 0
  const r = QC.search(
    Gen.natural,
    x => {
      const result = 10 < x && x < 10000
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
  t.ok(called < 20)
  if (!r.ok && r.reason == 'counterexample') {
    t.deepEquals(r.counterexample, 0)
  }
})
