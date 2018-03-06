# QuickCheck for TypeScript

This is an implementation of property-based testing a'la QuickCheck for TypeScript.
(It works with plain JavaScript and languages like CoffeeScript too)

Shrinking is done by generating lazy rose trees of values directly.
This means that you can map and chain generators and get correct
shrinking functions "for free". This is a deviation from the original
Haskell library but works well in languages without typeclasses.
(The same approach is taken in other implementations
such as Hedgehog for Haskell, Hypothesis for Python and test.check for Clojure)

#### Usage with mocha/jest

```typescript
const property = QC.createProperty(it)

describe('f', () => {
  property(
    'is commutative',
    QC.nat.pair(),
    ([x, y]) => (expect(f(x, y)).toEqual(f(y, x)), true)
  )
})
```

(to be improved; remove returning a boolean: [discussion](https://github.com/danr/ts-quickcheck/pull/6#issuecomment-370249397))

#### Usage with tape/ava

```typescript
test('f commutative', t => {
    t.true(QC.stdoutForall(QC.nat.pair(), ([x, y]) => f(x, y) === f(y, x)))
})
```

(to be improved)

#### Usage without a library as an assertion

```typescript
QC.assertForall(QC.nat.pair(), ([x, y]) => f(x, y) === f(y, x))
```


The API exports a function `search` which return returns `{'ok': true}` if the property
passed or `{'ok': false}` and the counterexample (or other information) if it did not.

### Installation

Right now there is no npm release because I am still ironing out
quirks and the api, but you can test it by linking it to your
own library:

```
yarn run tsc
yarn link
cd ../my-cool-project
yarn link ts-quickcheck # viola
```

### Contributors

* Simon Friis Vindum [@paldepind](https://github.com/paldepind) ([commits](https://github.com/danr/ts-quickcheck/commits?author=paldepind))

### Ongoing discussions

* Rename package: [#7](https://github.com/danr/ts-quickcheck/issues/7)

### License

MIT
