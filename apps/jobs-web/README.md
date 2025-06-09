# Jobs Web

This simple Fastify server aggregates job listings from multiple Applicant Tracking Systems (ATS) and serves them on a small web page.

## Running

```bash
pnpm install
pnpm --filter jobs-web start
```

Environment variables can be used to set company slugs for the different ATS providers:

- `LEVER_SLUG`
- `GREENHOUSE_SLUG`
- `WORKABLE_SLUG`

If not provided, example slugs are used.
