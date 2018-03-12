# Property-based testing for TypeScript and JavaScript

This is an implementation of property-based testing a'la QuickCheck for TypeScript.
It works with plain JavaScript and languages like CoffeeScript too.

Shrinking is done by generating lazy rose trees of values directly.
This means that you can map and chain generators and get correct
shrinking functions "for free". This is a deviation from the original
Haskell library but works well in languages without typeclasses.
(The same approach is taken in other implementations
such as Hedgehog for Haskell, Hypothesis for Python and test.check for Clojure)

#### Usage with mocha and jest

```typescript
import * as QC from 'proptest'
const property = QC.createProperty(it)

describe('f', () => {
  property(
    'is commutative',
    QC.nat.two(),
    ([x, y]) => (expect(f(x, y)).toEqual(f(y, x)), true)
  )
})
```

(to be improved; remove returning a boolean: [discussion](https://github.com/danr/proptest/pull/6#issuecomment-370249397))

#### Usage with tape

```typescript
import * as QC from 'proptest'
const check = QC.adaptTape(test)

check('f commutative', QC.nat.two(), ([x, y]) => f(x, y) === f(y, x))
```

#### Usage with AVA

```typescript
import * as QC from 'proptest'
test('f commutative', t => {
  t.true(QC.stdoutForall(QC.nat.two(), ([x, y]) => f(x, y) === f(y, x)))
})
```

(to be improved, also see [ava#1692](https://github.com/avajs/ava/issues/1692))

#### Usage without a library as an assertion

```typescript
import * as QC from 'proptest'
QC.assertForall(QC.nat.two(), ([x, y]) => f(x, y) === f(y, x))
```


The API exports a function `search` which return returns `{'ok': true}` if the property
passed or `{'ok': false}` and the counterexample (or other information) if it did not.

### Installation

You can grab it from npm:

```
npm i -D proptest
```

You may use yarn:

```
yarn add --dev proptest
```


### Contributors

* Simon Friis Vindum [@paldepind](https://github.com/paldepind) ([commits](https://github.com/danr/proptest/commits?author=paldepind))

### Ongoing discussions

* Should properties return a boolean of success or just not throw an assertion? [#6](https://github.com/danr/proptest/pull/6)[#6]  [#5](https://github.com/danr/proptest/issues/5)[#5]

### License

MIT
