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

/** Framework and test-tool dependencies returned by the bounded readers. */
export const DECLARED_TECHNOLOGY_RULES = [
  {
    category: "framework",
    name: "Rails",
    source: "gemfile",
    dependencies: ["rails"],
  },
  {
    category: "framework",
    name: "Express",
    source: "package-json",
    dependencies: ["express"],
  },
  {
    category: "framework",
    name: "NestJS",
    source: "package-json",
    dependencies: ["@nestjs/core"],
  },
  {
    category: "framework",
    name: "React",
    source: "package-json",
    dependencies: ["react"],
  },
  {
    category: "framework",
    name: "Next.js",
    source: "package-json",
    dependencies: ["next"],
  },
  {
    category: "framework",
    name: "Angular",
    source: "package-json",
    dependencies: ["@angular/core"],
  },
  {
    category: "framework",
    name: "Vue",
    source: "package-json",
    dependencies: ["vue"],
  },
  {
    category: "framework",
    name: "Svelte",
    source: "package-json",
    dependencies: ["svelte"],
  },
  {
    category: "testTool",
    name: "RSpec",
    source: "gemfile",
    dependencies: ["rspec"],
  },
  {
    category: "testTool",
    name: "Minitest",
    source: "gemfile",
    dependencies: ["minitest"],
  },
  {
    category: "testTool",
    name: "Jest",
    source: "package-json",
    dependencies: ["jest"],
  },
  {
    category: "testTool",
    name: "Vitest",
    source: "package-json",
    dependencies: ["vitest"],
  },
  {
    category: "testTool",
    name: "Playwright",
    source: "package-json",
    dependencies: ["@playwright/test", "playwright"],
  },
  {
    category: "testTool",
    name: "Cypress",
    source: "package-json",
    dependencies: ["cypress"],
  },
] as const;

/** Exact config basenames; these provide medium-confidence path evidence. */
export const CONFIGURATION_TECHNOLOGY_RULES = [
  {
    category: "testTool",
    name: "Jest",
    filenames: [
      "jest.config.js",
      "jest.config.cjs",
      "jest.config.mjs",
      "jest.config.ts",
    ],
  },
  {
    category: "testTool",
    name: "Vitest",
    filenames: ["vitest.config.js", "vitest.config.ts", "vitest.config.mts"],
  },
  {
    category: "testTool",
    name: "Playwright",
    filenames: ["playwright.config.js", "playwright.config.ts"],
  },
  {
    category: "testTool",
    name: "Cypress",
    filenames: ["cypress.config.js", "cypress.config.ts"],
  },
  { category: "framework", name: "Django", filenames: ["manage.py"] },
  { category: "framework", name: "Laravel", filenames: ["artisan"] },
] as const;

/** Database client dependencies exposed by the supported bounded readers. */
export const DATABASE_DECLARATION_RULES = [
  { name: "PostgreSQL", source: "gemfile", dependencies: ["pg"] },
  { name: "SQLite", source: "gemfile", dependencies: ["sqlite3"] },
  { name: "MySQL", source: "gemfile", dependencies: ["mysql2"] },
  { name: "MongoDB", source: "gemfile", dependencies: ["mongoid"] },
  { name: "Redis", source: "gemfile", dependencies: ["redis"] },
  { name: "PostgreSQL", source: "package-json", dependencies: ["pg"] },
  {
    name: "SQLite",
    source: "package-json",
    dependencies: ["sqlite3", "better-sqlite3"],
  },
  {
    name: "MySQL",
    source: "package-json",
    dependencies: ["mysql", "mysql2"],
  },
  {
    name: "MongoDB",
    source: "package-json",
    dependencies: ["mongodb", "mongoose"],
  },
  {
    name: "Redis",
    source: "package-json",
    dependencies: ["redis", "ioredis"],
  },
] as const;

/** Generic database configuration markers do not identify a database vendor. */
export const DATABASE_CONFIGURATION_RULES = [
  { name: "Database configuration", filenames: ["database.yml"] },
] as const;

/** Exact infrastructure configuration names and extensions; no content reads. */
export const INFRASTRUCTURE_PATH_RULES = [
  {
    name: "Docker",
    filenames: ["Dockerfile", ".dockerignore"],
    filenamePrefixes: ["Dockerfile."],
  },
  {
    name: "Docker Compose",
    filenames: [
      "compose.yaml",
      "compose.yml",
      "docker-compose.yaml",
      "docker-compose.yml",
    ],
  },
  {
    name: "Terraform",
    extensions: [".tf", ".tf.json"],
  },
  {
    name: "Terraform",
    filenames: ["terraform.lock.hcl"],
    method: "lockfile-name",
  },
  {
    name: "Kubernetes",
    filenames: ["kustomization.yaml", "kustomization.yml"],
  },
  { name: "Helm", filenames: ["Chart.yaml"] },
  { name: "AWS CDK", filenames: ["cdk.json"] },
  {
    name: "Serverless Framework",
    filenames: ["serverless.yml", "serverless.yaml"],
  },
] as const;
