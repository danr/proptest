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
  return fromTo(0, to)
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

export function deepEquals(x: any, y: any): boolean {
  if (Array.isArray(x) && Array.isArray(y)) {
    return x.length == y.length && x.every((e, i) => deepEquals(e, y[i]))
  } else if (typeof x === 'object' && typeof y === 'object') {
    if (x === null) {
      return y === null
    }
    const xk = Object.keys(x).sort()
    const yk = Object.keys(x).sort()
    return deepEquals(xk, yk) && xk.every(k => deepEquals(x[k], y[k]))
  } else if (typeof x === 'boolean' && typeof y === 'boolean') {
    return x === y
  } else if (typeof x === 'number' && typeof y === 'number') {
    return x === y
  } else if (typeof x === 'string' && typeof y === 'string') {
    return x === y
  } else if (typeof x === 'undefined' && typeof y === 'undefined') {
    return x === y
  } else {
    return false
  }
}

export function size(x: any): number {
  if (Array.isArray(x)) {
    return x.reduce((p, n) => p + size(n), 1)
  } else if (typeof x === 'object') {
    if (x === null) {
      return 1
    }
    return size(Object.keys(x).map(k => x[k]))
  } else {
    return 1
  }
}

const leftpad = (i: number, s: string) =>
  range(i - s.length)
    .map(_ => ' ')
    .join('') + s

export const pct = (i: number) => leftpad(3, '' + Math.round(i)) + '%'

export function succ(x: Record<string, number>, s: string) {
  x[s] = (x[s] || (x[s] = 0)) + 1
}

export const serialize = (s: any) => (typeof s == 'string' ? s : JSON.stringify(s))
