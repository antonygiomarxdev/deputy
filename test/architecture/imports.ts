// One regex over `from "x"` (import/export), side-effect `import "x"`, `import("x")` and `require("x")`.
// shortcut: it also matches those forms inside strings and comments; upgrade to a parser if that ever bites.
const IMPORT = /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)["']([^"']+)["']/g;

export function listImports(source: string): string[] {
  return [...source.matchAll(IMPORT)].map((m) => m[1] as string);
}
