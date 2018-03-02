# QuickCheck for TypeScript

This is an implementation of property-based testing a'la QuickCheck for TypeScript.
(It works with plain JavaScript and languages like CoffeeScript too)

Shrinking is done by generating lazy rose trees of values directly.
This means that you can map and chain generators and get correct
shrinking functions "for free". This is a deviation from the original
Haskell library but works well in languages without typeclasses.
(The same approach is taken in other implementations
such as Hedgehog for Haskell, Hypothesis for Python and EasyCheck for Clojure)

The API exports a function which essentially returns a true if the property
passed or a counterexample if it did not.
The only test suite runner adapter right now is for `tape`.

Right now there is no npm release because I am still ironing out
quirks and the api, but you can test it by linking it to your
own library:

```
yarn run tsc
yarn link
cd ../my-cool-project
yarn link ts-quickcheck # viola
```


### License

MIT
