---
paths:
  - "packages/cli/src/**/*.ts"
---

# AWS

- PREFER AWS SDK over the `aws` CLI for all AWS operations
- ALWAYS create SDK clients using generators from `src/util/aws/clients/` — never instantiate clients directly
