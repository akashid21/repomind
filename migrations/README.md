# Database migrations

RepoMind starts with plain, ordered SQL migrations so schema changes remain explicit and reviewable without committing to an ORM. Name files with a zero-padded sequence and a short description, for example `0001_create_projects.sql`. Apply them in order using `psql` against `DATABASE_URL`, and record the applied filenames in deployment notes until an automated migration runner is introduced.

Keep migrations forward-only. Do not put repository-derived data or credentials in migrations. A migration runner and schema are intentionally deferred until a feature defines the first persistent entities.
