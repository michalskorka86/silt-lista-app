// Testy w Node (bez bundlera): pozwala importować pliki .ts bez rozszerzenia, jak w aplikacji.
// Uruchamianie: node --test --experimental-strip-types --no-warnings --import ./testy/rejestruj.mjs testy/
import { register } from 'node:module';

register(
  'data:text/javascript,' +
    encodeURIComponent(`
export async function resolve(spec, ctx, next) {
  if ((spec.startsWith('./') || spec.startsWith('../')) && !/\\.[cm]?[jt]sx?$/.test(spec)) {
    for (const ext of ['.ts', '.tsx', '/index.ts']) {
      try { return await next(spec + ext, ctx); } catch {}
    }
  }
  return next(spec, ctx);
}`),
  import.meta.url,
);
