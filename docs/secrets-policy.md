# Secrets Operations Policy

## Scope

This policy applies to every server-side credential used by Nabd AI Assistant, including:

- database credentials
- AI provider keys
- Supabase server credentials
- Redis credentials
- debug/admin tokens
- third-party integration credentials such as GitHub

## Storage Standard

- Production secrets must live in a dedicated secret manager.
- Supported operational targets in this repo:
  - AWS Secrets Manager
  - HashiCorp Vault
- `.env` is allowed only for local development and must never be committed.
- Browser-exposed `VITE_*` variables must not contain secrets.

## Least Privilege Baseline

### Supabase

- `SUPABASE_ANON_KEY` may be used by browser clients only when RLS is enabled and policies are verified.
- `SUPABASE_SERVICE_ROLE_KEY` is server-only and must never appear in frontend code, Vite env, logs, or client bundles.
- Database roles used by application code should not have migration or admin privileges.

### OpenAI / AI Providers

- Use project-scoped keys where available.
- Keys must be server-only.
- Restrict usage to the models and endpoints actually needed by the app.
- Separate development and production credentials.

### GitHub

- Prefer GitHub App installations over long-lived personal access tokens.
- If a token is unavoidable, use a fine-grained PAT scoped to a single repository and the minimum required permissions.
- Never use a classic PAT unless there is no supported alternative.

## Rotation Policy

- Exposed secret: rotate immediately.
- Admin, service-role, and debug tokens: rotate every 30 days.
- Database passwords and provider API keys: rotate every 60 to 90 days.
- Integration credentials tied to CI/CD or deployment: rotate after staff changes and after every suspected exposure.

Every rotation must update:

1. the provider-side secret value
2. the secret manager payload
3. any dependent deployment/runtime references
4. the audit trail entry

## Revocation Policy

When exposure is suspected:

1. revoke or disable the credential at the provider immediately
2. issue a replacement credential
3. update the secret manager entry
4. redeploy affected services
5. review access logs for abuse before and after revocation
6. invalidate related sessions or downstream credentials if lateral movement is possible

## Audit Requirements

- Every secret read path must be attributable to a workload identity, runtime, or operator action.
- Access logs from AWS/Vault/provider consoles must be retained according to the organization retention policy.
- Run `npm run security:audit` before production deploys and after credential changes.
- Alert on:
  - new geographies
  - unexpected services reading secrets
  - repeated failed secret reads
  - use of deprecated or rotated credentials

## Frontend Leak Prevention

- Any `VITE_*` variable matching `TOKEN`, `SECRET`, `PASSWORD`, `PRIVATE`, `SERVICE_ROLE`, or `API_KEY` is treated as a build/start failure.
- Client code must only consume public runtime configuration.
- Service-role and admin credentials must stay behind server routes or server-side functions.

## Incident Response

- treat every exposed secret as compromised, not merely suspicious
- preserve logs before redeploying
- rotate upstream first, then application storage
- document blast radius, impacted systems, and remediation time
- open a follow-up task for root-cause prevention
