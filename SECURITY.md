# Security Policy

## Reporting a vulnerability

Please use GitHub's private vulnerability reporting for this repository when it is available under the **Security** tab. Include the affected NSDB version or commit, impact, reproduction steps, and any suggested mitigation.

If private vulnerability reporting is not available, open a minimal issue asking the maintainers to establish a private contact channel. Do not include exploit details, credentials, private user data, or an unpatched proof of concept in a public issue.

Do not use vulnerability reports for ordinary support questions or feature requests.

## Supported code

`1.0.0-rc.2` is the current release candidate and has not yet been published. Security fixes target the current development branch and the most recent published package version, if one exists. Older pre-release versions may require upgrading rather than receiving a backport.

## Security boundaries

- Supabase Auth authenticates users.
- PostgreSQL Row Level Security authorizes database access.
- Supabase Storage policies authorize file access.
- NSDB table and column exposure metadata is a client-side least-exposure control, not authorization.
- Store persistence is opt-in and user-scoped data must remain quarantined until the current Supabase identity is verified.
- Generated forms must not send readonly, hidden, or server-only values as mutation payloads.
- Remote generation configuration executes trusted developer-provided SSH and shell fragments; it is not safe for untrusted input.

Never commit service-role keys, npm tokens, database credentials, production `.env` files, signing keys, or personal data. Use only the disposable local Supabase fixtures for repository tests. If a credential is ever committed, rotate it first and then decide explicitly whether Git history and tags must be rewritten.
