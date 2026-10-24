/**
 * Minimale Typen für die Node-Testmodule.
 *
 * Die Tests laufen mit `node --test`, ganz ohne npm-Pakete. Damit
 * `npm run typecheck` die Testkörper trotzdem prüft, beschreiben wir hier
 * genau so viel von `node:test` und `node:assert/strict`, wie die Tests
 * benutzen – nicht mehr. Wer eine weitere Zusicherung braucht, ergänzt sie
 * hier; die Wahrheit bleibt immer das, was Node tatsächlich ausführt.
 */

declare module 'node:test' {
  export function describe(name: string, fn: () => void): void
  export function it(name: string, fn: () => void | Promise<void>): void
}

declare module 'node:assert/strict' {
  interface AssertStrict {
    (value: unknown, message?: string): asserts value
    ok(value: unknown, message?: string): asserts value
    equal<T>(actual: unknown, expected: T, message?: string): void
    notEqual(actual: unknown, expected: unknown, message?: string): void
    deepEqual<T>(actual: unknown, expected: T, message?: string): void
    match(value: string, pattern: RegExp, message?: string): void
    doesNotMatch(value: string, pattern: RegExp, message?: string): void
    throws(fn: () => unknown, expected?: RegExp | ErrorConstructor, message?: string): void
    fail(message?: string): never
  }
  const assert: AssertStrict
  export default assert
}
