export function pair<A, B>(a: A, b: B): [A, B] {
  return [a, b]
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

export function charRange(begin: string, end: string): string[] {
  return fromTo(begin.charCodeAt(0), end.charCodeAt(0)).map(x => String.fromCharCode(x))
}

export function record_create<K extends string, V>(xs: {k: K; v: V}[]): Record<K, V> {
  const out = {} as Record<K, V>
  xs.forEach(x => (out[x.k] = x.v))
  return out
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
  if (x === y || x === null || y === null) {
    return x === y
  } else if (Array.isArray(x) || Array.isArray(y)) {
    return (
      Array.isArray(x) &&
      Array.isArray(y) &&
      x.length == y.length &&
      x.every((e, i) => deepEquals(e, y[i]))
    )
  } else if (typeof x === 'object' && typeof y === 'object') {
    const xk = Object.keys(x).sort()
    const yk = Object.keys(y).sort()
    return deepEquals(xk, yk) && xk.every(k => deepEquals(x[k], y[k]))
  } else {
    return false
  }
}

export function size(x: any): number {
  if (x === null || typeof x !== 'object') {
    return 1
  } else if (Array.isArray(x)) {
    return x.reduce((p, n) => p + size(n), 1)
  } else {
    return size(Object.keys(x).map(k => x[k]))
  }
}

const leftpad = (i: number, s: string) =>
  range(i - s.length)
    .map(_ => ' ')
    .join('') + s

export const pct = (i: number) => leftpad(3, '' + Math.round(i)) + '%'

export function succ(x: Record<string, number>, s: string): number {
  return (x[s] = (x[s] || (x[s] = 0)) + 1)
}

export const serialize = (s: any) => (typeof s == 'string' ? s : JSON.stringify(s))

declare const require: (file: string) => any
const stringify = require('json-stringify-pretty-compact') as (s: any) => string

/** Show a JSON object with indentation */
export function show(x: any): string {
  return stringify(x)
  // return JSON.stringify(x, undefined, 2)
}
