// Bundles the API for production. The API's own dependencies stay external (they
// are installed next to dist/). Workspace packages (@bolsillo/*) export TypeScript
// source and their third-party dependencies are not visible from apps/api under
// pnpm's strict layout, so both are bundled.
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const ownDependencies = Object.keys(pkg.dependencies ?? {}).filter(
  (name) => !name.startsWith('@bolsillo/'),
);

const isOwnDependency = (path) =>
  ownDependencies.some((name) => path === name || path.startsWith(`${name}/`));

await build({
  entryPoints: ['src/index.ts'],
  outfile: 'dist/index.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  sourcemap: true,
  logLevel: 'info',
  // Optional native binding that `pg` only loads on demand.
  external: ['pg-native'],
  // Bundled CommonJS packages (pg) still call `require` for Node built-ins.
  banner: {
    js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);",
  },
  plugins: [
    {
      name: 'external-own-dependencies',
      setup(pluginBuild) {
        pluginBuild.onResolve({ filter: /^[^./]/ }, (args) =>
          isOwnDependency(args.path) ? { path: args.path, external: true } : undefined,
        );
      },
    },
  ],
});
