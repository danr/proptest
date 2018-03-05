export type Thunk<A> = {
  forced: boolean
  expr: (() => A) | undefined
  memorized: A | undefined
}

function thunk<A>(expr: () => A): Thunk<A> {
  return {expr, memorized: undefined}
}

export function force<A>(thunk: Thunk<A>): A {
  if (thunk.expr !== undefined) {
    thunk.memorized = thunk.expr!()
    thunk.expr = undefined
  }
  return thunk.memorized!
}

/**
 * A lazy list is a thunk that is either a pair of a value an a tail or the
 * empty list (represented as undefined)
 */
export type LazyList<A> = Thunk<{head: A; tail: LazyList<A>} | undefined>

export const nil = thunk(() => undefined)

export function cons<A>(head: A, tail: LazyList<A>) {
  return thunk(() => ({head, tail}))
}

export function map<A, B>(f: (a: A) => B, l: LazyList<A>): LazyList<B> {
  return thunk(() => {
    const as = force(l)
    return as ? {head: f(as.head), tail: map(f, as.tail)} : undefined
  })
}

export function concat<A>(l1: LazyList<A>, l2: LazyList<A>): LazyList<A> {
  return thunk(() => {
    const as = force(l1)
    return as ? {head: as.head, tail: concat(as.tail, l2)} : force(l2)
  })
}

export function flatten<A>(ls: LazyList<LazyList<A>>): LazyList<A> {
  return thunk(() => {
    const as = force(ls)
    return as ? force(concat(as.head, flatten(as.tail))) : undefined
  })
}

export function fromArray<A>(arr: A[]): LazyList<A> {
  function go(idx: number, arr: A[]): LazyList<A> {
    return thunk(() => (idx === arr.length ? undefined : {head: arr[idx], tail: go(idx + 1, arr)}))
  }
  return go(0, arr)
}

export function toArray<A>(l: LazyList<A>): A[] {
  const out = []
  let child = force(l)
  while (child !== undefined) {
    out.push(child.head)
    child = force(child.tail)
  }
  return out
}
