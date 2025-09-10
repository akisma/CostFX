# CostFX Lean Infrastructure (Dev & Prod)

This is the fresh, minimal, *idempotent* Terraform infrastructure scaffold replacing the prior implementation (kept temporarily in `deploy/terraform` until removal). It is designed for:

* Two environments: **dev** (lean) and **prod** (scalable)
* Separate state (via S3 + DynamoDB) – bootstrap first
* No hard‑coded secrets (all through SSM Parameter Store, SecureString)
* Additive growth: private subnets, autoscaling, Redis, HTTPS, CloudFront later
* Clear module boundaries to avoid rewrite debt

## High-Level Modules
| Module | Purpose | Current Scope |
|--------|---------|---------------|
| network | VPC + public subnets (dev) | 2 public subnets, future-ready outputs |
| iam | ECS task + execution roles, SSM access | Least-privilege SSM path |
| ecr | Repositories + lifecycle | Backend + Frontend |
| ecs (optional) | Cluster + task definitions + services | Guarded by create_ecs flag |
| alb | Application Load Balancer + listeners | HTTP only (dev), optional HTTPS later |
| rds | PostgreSQL single-AZ | Random password output only |
| ssm | Secure parameters (database_url, jwt_secret, openai placeholder) | SecureString values |

## Environment Toggle Variables
| Variable | Dev Default | Prod Example | Notes |
|----------|-------------|--------------|-------|
| create_rds | true | true | Must be true for application DB |
| multi_az_db | false | true | Add Multi-AZ later |
| enable_https | false | true | ACM + HTTPS listener later |
| desired_backend_count | 1 | 2 | Scale out prod |
| desired_frontend_count | 1 | 2 | |
| create_redis | false | true (future) | Not implemented yet |
| enable_autoscaling | false | true | Placeholder for future module |

## Bootstrap (One-Time)
Per-environment state keys (no Terraform workspaces). One S3 bucket + DynamoDB table reused across envs; state isolated by key prefix `env/<env>/infra.tfstate`.

Use the provided script to create (idempotently) an S3 bucket + DynamoDB lock table for Terraform state. Pass ENV for per-env backend config.

```bash
AWS_REGION=us-west-2 ENV=dev deploy/infra/scripts/bootstrap-remote-state.sh
AWS_REGION=us-west-2 ENV=prod deploy/infra/scripts/bootstrap-remote-state.sh
```

This produces `backend-dev.hcl` and `backend-prod.hcl` with appropriate `key = env/<env>/infra.tfstate`.

## Apply Flow (Dev)
First apply WITHOUT ECS to create ECR repos, then build & push images, then apply with ECS.

### Phase 1 – Infra Core (no ECS)
```bash
terraform init -reconfigure -backend-config=backend-dev.hcl -input=false
terraform apply -var-file=environments/dev/terraform.tfvars -var create_ecs=false \
	-var backend_image=placeholder -var frontend_image=placeholder
```

### Build & Push Images
Handled by CI (see GitHub Actions workflow) or locally via `scripts/build-push-images.sh`.

### Phase 2 – Deploy Services
CI supplies concrete digest-pinned image URIs via generated auto.tfvars file.
```bash
terraform apply -var-file=environments/dev/terraform.tfvars \
	-var backend_image=$(cat environments/dev/.backend_image) \
	-var frontend_image=$(cat environments/dev/.frontend_image)
```

## Secrets Handling
## Image Build & Promotion Strategy
Images are built in CI, tagged with: `repo:git-sha` and additionally `repo:env-latest`. Terraform is passed immutable digest form `repo_url@sha256:<digest>` to ensure deployments are reproducible. Promotion to prod reuses digest (no rebuild) for provenance.

* `random_password` in rds module generates DB password; only composed connection URL stored in `/costfx/<env>/database_url` (SecureString).
* JWT secret random 64 chars — rotate by tainting resource or using future Secrets Manager integration.
* OPENAI key placeholder requires **manual** overwrite after first apply.

## Future Enhancements (Additive)
* Private subnets + NAT (network module expansion)
* Redis (cache module)
* Autoscaling (ecs module extension)
* HTTPS (alb module variable enable_https)
* CloudFront + S3 (new frontend_static module)
* WAF, alarms, metrics exporter

## Removal of Legacy Infra
After validating this stack, remove or archive `deploy/terraform` to prevent drift.

---
Prepared initial scaffold. Expand cautiously; keep modules small & composable.

## Orchestration (Ansible)
Replaced Makefile with Ansible playbooks (`ansible/`). Provides tagged, idempotent phases:

Playbooks:
* `deploy.yml` (master) – includes all phases
* Tags: `bootstrap`, `core`, `images`, `services`, `verify`

Example full deploy (dev):
```bash
cd deploy/infra/ansible
ansible-playbook -i inventory deploy.yml -e env=dev -e region=us-west-2 --tags "bootstrap,core,images,services,verify"
```

Run only core (no ECS):
```bash
ansible-playbook -i inventory deploy.yml -e env=dev --tags core
```

Build/push images only:
```bash
ansible-playbook -i inventory deploy.yml -e env=dev --tags images
```

Deploy services with existing images:
```bash
ansible-playbook -i inventory deploy.yml -e env=dev --tags services
```

Verification (health checks):
```bash
ansible-playbook -i inventory deploy.yml -e env=dev --tags verify
```

Variables:
* `env` (default dev)
* `region` (default us-west-2)
* `app_name` (default costfx)

Outputs: backend/frontend image digest files stored in `environments/<env>/.backend_image` & `.frontend_image`.

