import * as test from 'tape'
import * as Utils from '../src/Utils'

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
