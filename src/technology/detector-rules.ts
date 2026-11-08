/** Declarative v1 language rules. Additions should be accompanied by fixtures and contract updates. */
export const LANGUAGE_EXTENSION_RULES = [
  { name: "Ruby", extensions: [".rb", ".rake", ".gemspec"] },
  {
    name: "JavaScript",
    extensions: [".js", ".jsx", ".mjs", ".cjs"],
  },
  { name: "TypeScript", extensions: [".ts", ".tsx", ".mts", ".cts"] },
] as const;

/** Exact, case-sensitive root or nested basenames identifying package managers. */
export const PACKAGE_MANAGER_LOCKFILE_RULES = [
  { name: "npm", filenames: ["package-lock.json", "npm-shrinkwrap.json"] },
  { name: "Yarn", filenames: ["yarn.lock"] },
  { name: "pnpm", filenames: ["pnpm-lock.yaml"] },
  { name: "Bun", filenames: ["bun.lock", "bun.lockb"] },
  { name: "Bundler", filenames: ["Gemfile.lock"] },
] as const;

/** Recognized packageManager prefixes from supported package.json manifests. */
export const PACKAGE_MANAGER_DECLARATION_RULES = [
  { prefix: "npm", name: "npm" },
  { prefix: "yarn", name: "Yarn" },
  { prefix: "pnpm", name: "pnpm" },
  { prefix: "bun", name: "Bun" },
] as const;
