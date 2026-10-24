/**
 * Minimale Typen für die Node-Module, die die Tests benutzen.
 *
 * Die Tests laufen mit `node --test`, ganz ohne npm-Pakete. Damit
 * `npm run typecheck` die Testkörper trotzdem prüft, beschreiben wir hier
 * genau so viel von `node:test`, `node:assert/strict` und `node:fs/promises`,
 * wie die Tests tatsächlich aufrufen – nicht mehr. Wer eine weitere Zusicherung
 * braucht, ergänzt sie hier; die Wahrheit bleibt immer das, was Node
 * tatsächlich ausführt.
 */

declare module 'node:test' {
  export function describe(name: string, fn: () => void): void
  export function it(name: string, fn: () => void | Promise<void>): void
}

declare module 'node:assert/strict' {
  type ErrorMatcher = RegExp | ErrorConstructor | ((error: unknown) => boolean)

  interface AssertStrict {
    (value: unknown, message?: string): asserts value
    ok(value: unknown, message?: string): asserts value
    equal<T>(actual: unknown, expected: T, message?: string): void
    notEqual(actual: unknown, expected: unknown, message?: string): void
    deepEqual<T>(actual: unknown, expected: T, message?: string): void
    notDeepEqual(actual: unknown, expected: unknown, message?: string): void
    match(value: string, pattern: RegExp, message?: string): void
    doesNotMatch(value: string, pattern: RegExp, message?: string): void
    throws(fn: () => unknown, expected?: ErrorMatcher, message?: string): void
    doesNotThrow(fn: () => unknown, message?: string): void
    rejects(
      fn: (() => Promise<unknown>) | Promise<unknown>,
      expected?: ErrorMatcher,
      message?: string,
    ): Promise<void>
    fail(message?: string): never
  }
  const assert: AssertStrict
  export default assert
}

declare module 'node:fs/promises' {
  export function readFile(path: string | URL): Promise<Uint8Array>
  export function writeFile(path: string | URL, data: Uint8Array | string): Promise<void>
}
