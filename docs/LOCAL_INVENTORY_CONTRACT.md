# Local Repository Inventory Contract

**Status:** Defined for Milestone 1
**Schema version:** 1

This document defines the command, JSON report, exclusions, limits, and failure behavior for the local repository inventory. Traversal and CLI validation are implemented, while filtering and end-to-end report output are completed in M1-04.

## Command

The command will be invoked from the RepoMind project root as:

```sh
npm run inventory -- <repository-path>
```

It accepts exactly one local path. Relative paths are resolved from the caller's current working directory. The path must resolve to an existing directory. The root itself may be a symlink; RepoMind resolves it to its real path before walking. The resolved root is used for containment checks and is not written into the report.

On success, stdout contains only one JSON report followed by a newline. Diagnostics go to stderr. Invalid arguments, an invalid root, an unexpected traversal error, or a hard limit breach produce a nonzero exit code and no JSON report. The command never runs repository scripts, package managers, builds, or tests.

## JSON report

```json
{
  "schemaVersion": 1,
  "directories": ["app", "app/models"],
  "files": [
    { "path": "README.md", "sizeBytes": 420 }
  ],
  "summary": {
    "directoryCount": 2,
    "fileCount": 1,
    "inventoryBytes": 420,
    "excludedEntryCounts": {
      "generated": 0,
      "dependency": 0,
      "secretOrLocalConfig": 0,
      "binary": 0,
      "symlink": 0,
      "oversized": 0,
      "tooDeep": 0,
      "unreadable": 0,
      "unsupported": 0
    }
  }
}
```

- Paths are repository-relative, use `/` separators, and do not begin with `/` or `./`.
- `directories` contains included, non-root directories. `files` contains included regular files and their filesystem size in bytes.
- The summary counts match the arrays. `inventoryBytes` is the sum of included file sizes. Exclusion counts count excluded entries where a rule is applied; an excluded directory is counted once and is not walked to count its descendants.
- The report does not contain file contents, absolute local paths, timestamps, file modification times, or inferred technology claims.
- All arrays are sorted by ordinal path order (Unicode code-point order; no locale-dependent comparison). Exclusion count keys always appear in the order shown, including zero values. JSON object keys and serialization follow the documented schema order.
- The report is stable for the same tree and metadata. Changes to file paths, sizes, or exclusion counts can naturally change it.

## Exclusions

Rules are applied to path names and filesystem metadata. Matching of directory and filename rules is ASCII case-insensitive; original path spelling is retained for included entries. Excluded paths are not emitted in the report, and their names and contents are not logged.

- **Generated/build/cache directories:** `.git`, `.hg`, `.svn`, `coverage`, `dist`, `build`, `out`, `target`, `.next`, `.nuxt`, `.turbo`, `.cache`, `.parcel-cache`, `.vite`, `__pycache__`, `.pytest_cache`, `.mypy_cache`, `Pods`, `DerivedData`, `tmp`, and `log`.
- **Dependency directories:** `node_modules`, `bower_components`, and `vendor`. This default may omit first-party code placed under a conventionally third-party directory; the v1 report exposes the aggregate excluded count.
- **Generated/minified files:** filenames ending in `.min.js`, `.min.css`, or `.map`.
- **Secrets and local credentials:** `.env` and `.env.*` except files ending in `.example`, `.sample`, or `.template`; exact names `.npmrc`, `.pypirc`, `.netrc`, `id_rsa`, and `id_ed25519`; files ending in `.pem`, `.key`, `.p12`, `.pfx`, or `.jks`; and directories named `.ssh`, `.aws`, `credentials`, or `secrets`.
- **Binary files:** filenames ending in `.7z`, `.a`, `.apk`, `.avi`, `.bin`, `.bmp`, `.class`, `.dll`, `.dmg`, `.doc`, `.docx`, `.eot`, `.exe`, `.gif`, `.gz`, `.ico`, `.jar`, `.jpeg`, `.jpg`, `.mp3`, `.mp4`, `.o`, `.otf`, `.pdf`, `.png`, `.ppt`, `.pptx`, `.psd`, `.pyc`, `.so`, `.tar`, `.tif`, `.tiff`, `.ttf`, `.wasm`, `.wav`, `.webm`, `.webp`, `.woff`, `.woff2`, `.xls`, `.xlsx`, or `.zip`. Extension matching is case-insensitive; original path spelling is retained in included paths. Binary detection is intentionally path-based in v1: an unrecognized binary extension may remain in the inventory, and no content sniffing is performed.
- **Symlinks and special files:** all symlinks are skipped without following them, including links that point inside the root. Sockets, FIFOs, devices, and other non-regular entries are skipped as unsupported.

Do not exclude manifests, lockfiles, migrations, tests, CI/Docker configuration, application configuration, or schema files solely because of their names. Example/sample/template environment files are retained. Secret handling in this milestone is path/name based; it does not scan file contents for arbitrary secret patterns.

## Safety limits

Milestone 1 uses fixed defaults; no per-run override flags are included in v1.

| Limit | Default | Behavior |
|---|---:|---|
| Maximum path depth | 50 components below the root | Skip that entry/subtree and increment `tooDeep`. |
| Maximum included file size | 20 MiB | Skip that file and increment `oversized`. |
| Maximum included files | 200,000 | Abort with an error and no JSON if the next included file exceeds the cap. |
| Maximum included directories | 200,000 | Abort with an error and no JSON if the next readable, included directory exceeds the cap. |
| Maximum included total size | 2 GiB | Abort with an error and no JSON if including the next file exceeds the cap. |

The file-count, directory-count, and total-size caps are hard failures so callers cannot mistake an incomplete report for a complete inventory. Oversized files and over-depth entries are skipped with explicit counts. File counts and byte limits apply after path exclusions and before adding the file to the report. The directory count applies after path exclusions and depth checks; unreadable directories do not count as included. These v1 defaults allow larger repositories and lockfiles while bounding the amount of metadata and report output retained in memory. They are not calibrated against the pilot repository because its path is not currently available.

## Errors and partial inventory

- Missing, malformed, non-directory, or inaccessible root: fail with a concise stderr message and no JSON.
- Unreadable child file or directory: continue where possible, increment `unreadable`, and return a partial report. Do not include the affected path in the report or log it.
- Symlink: skip without dereferencing and increment `symlink`.
- File over the per-file limit: skip and increment `oversized`.
- Entry beyond the depth limit: skip the entry/subtree and increment `tooDeep`.
- Included-file count or total-byte hard cap exceeded: fail the whole command; do not emit a partial JSON document.
- Included-directory hard cap exceeded: fail the whole command; do not emit a partial JSON document.
- Unexpected I/O failure: fail with a nonzero exit code and no JSON.

## Implementation notes

Traversal must compare resolved paths against the canonical root and must not follow symlinks. Inventory reads filesystem metadata only; it does not open repository files. Secret exclusion is based on path/name rules, and binary detection uses the documented extension list. Unknown binary formats may be listed by path and size until later detection work adds a safe, explicitly scoped content-inspection policy.
