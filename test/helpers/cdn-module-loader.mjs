// Node ESM loader hook (registered via `module.register`, Node >=20.6) that
// redirects the hardcoded CDN specifiers used by public/components/**/*.js
// (browser-only, no bundler) to the equivalent local npm package, so
// component tests can import the real source files unmodified.
const REDIRECTS = {
  'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js': 'lit',
  'https://cdn.jsdelivr.net/npm/@lit/context@1.1.0/index.js': '@lit/context'
};

export async function resolve (specifier, context, nextResolve) {
  const target = REDIRECTS[specifier];
  if (target) return nextResolve(target, context);
  return nextResolve(specifier, context);
}
