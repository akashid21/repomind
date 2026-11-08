/** Declarative v1 language rules. Additions should be accompanied by fixtures and contract updates. */
export const LANGUAGE_EXTENSION_RULES = [
  { name: "Ruby", extensions: [".rb", ".rake", ".gemspec"] },
  {
    name: "JavaScript",
    extensions: [".js", ".jsx", ".mjs", ".cjs"],
  },
  { name: "TypeScript", extensions: [".ts", ".tsx", ".mts", ".cts"] },
  { name: "Python", extensions: [".py", ".pyi", ".pyw"] },
  { name: "Java", extensions: [".java"] },
  { name: "Go", extensions: [".go"] },
  { name: "PHP", extensions: [".php", ".phtml"] },
  { name: "C#", extensions: [".cs", ".csx"] },
] as const;

/** Exact, case-sensitive root or nested basenames/suffixes identifying managers. */
export const PACKAGE_MANAGER_FILE_RULES = [
  {
    name: "npm",
    method: "lockfile-name",
    filenames: ["package-lock.json", "npm-shrinkwrap.json"],
  },
  { name: "Yarn", method: "lockfile-name", filenames: ["yarn.lock"] },
  { name: "pnpm", method: "lockfile-name", filenames: ["pnpm-lock.yaml"] },
  {
    name: "Bun",
    method: "lockfile-name",
    filenames: ["bun.lock", "bun.lockb"],
  },
  { name: "Bundler", method: "lockfile-name", filenames: ["Gemfile.lock"] },
  { name: "pip", method: "manifest-name", filenames: ["requirements.txt"] },
  { name: "Pipenv", method: "manifest-name", filenames: ["Pipfile"] },
  { name: "Pipenv", method: "lockfile-name", filenames: ["Pipfile.lock"] },
  { name: "Poetry", method: "lockfile-name", filenames: ["poetry.lock"] },
  { name: "uv", method: "lockfile-name", filenames: ["uv.lock"] },
  { name: "Maven", method: "manifest-name", filenames: ["pom.xml"] },
  {
    name: "Gradle",
    method: "manifest-name",
    filenames: ["build.gradle", "build.gradle.kts"],
  },
  {
    name: "Gradle",
    method: "lockfile-name",
    filenames: ["gradle.lockfile"],
  },
  { name: "Go Modules", method: "manifest-name", filenames: ["go.mod"] },
  { name: "Go Modules", method: "lockfile-name", filenames: ["go.sum"] },
  { name: "Composer", method: "manifest-name", filenames: ["composer.json"] },
  { name: "Composer", method: "lockfile-name", filenames: ["composer.lock"] },
  {
    name: "NuGet",
    method: "lockfile-name",
    filenames: ["packages.lock.json"],
  },
  {
    name: "NuGet",
    method: "manifest-name",
    suffixes: [".csproj", ".fsproj", ".vbproj"],
  },
] as const;

/** Recognized packageManager prefixes from supported package.json manifests. */
export const PACKAGE_MANAGER_DECLARATION_RULES = [
  { prefix: "npm", name: "npm" },
  { prefix: "yarn", name: "Yarn" },
  { prefix: "pnpm", name: "pnpm" },
  { prefix: "bun", name: "Bun" },
] as const;
