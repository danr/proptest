export function pair<A, B>(a: A, b: B): [A, B] {
  return [a, b]
}
export function sigma<A, B>(a: A, f: (a: A) => B): [A, B] {
  return [a, f(a)]
}

export function writer<A>(handle: (write: (...xs: A[]) => void) => void): A[] {
  const out: A[] = []
  handle(out.push.bind(out))
  return out
}

export function record<K extends string, V>(
  handle: (write: (k: K, v: V) => void) => void
): Record<K, V> {
  const obj = {} as Record<K, V>
  handle((k, v) => (obj[k] = v))
  return obj
}

export function dict<K extends string, V>(keys: K[], f: (k: K, index: number) => V): Record<K, V> {
  return record<K, V>(w => keys.map((k, i) => w(k, f(k, i))))
}

export function flatten<X>(xss: X[][]): X[] {
  return ([] as X[]).concat(...xss)
}

export function range(to: number) {
  const out = []
  for (let i = 0; i < to; ++i) {
    out.push(i)
  }
  return out
}

export function fromTo(begin: number, end: number) {
  const out = []
  for (let i = begin; i < end; ++i) {
    out.push(i)
  }
  return out
}

export function char_range(begin: string, end: string): string[] {
  return fromTo(begin.charCodeAt(0), end.charCodeAt(0)).map(x => String.fromCharCode(x))
}

export function record_forEach<K extends string, A>(
  x: Record<K, A>,
  k: (a: A, id: K) => void
): void {
  ;(Object.keys(x) as K[]).forEach((id: K) => k(x[id], id))
}

export function record_traverse<K extends string, A, B>(
  x: Record<K, A>,
  k: (a: A, id: K) => B,
  sort_keys: boolean = false
): B[] {
  const ks = Object.keys(x) as K[]
  if (sort_keys) {
    ks.sort()
  }
  return ks.map((id: K) => k(x[id], id))
}

export function record_map<K extends string, A, B>(
  x: Record<K, A>,
  k: (a: A, id: K) => B
): Record<K, B> {
  const out = {} as Record<K, B>
  record_forEach(x, (a, id) => (out[id] = k(a, id)))
  return out
}

export function record_filter<A>(
  x: Record<string, A>,
  k: (a: A, id: string) => boolean
): Record<string, A> {
  const out = {} as Record<string, A>
  record_forEach(x, (a, id) => k(a, id) && (out[id] = a))
  return out
}
