# Working Session Memo - 2025-09-10

Context: ECS/Fargate deploy of CostFX (frontend + backend) behind ALB; RDS Postgres; SSM; us-west-2, Account 568530517605.

What we changed
- Docker images: ensured linux/amd64 builds using buildx. Frontend is built with Vite and served by nginx:alpine on port 80. Backend image runs Node on port 3001 with dumb-init.
- Terraform: tightened SGs (ALB→ECS, ECS→RDS). ALB path routing: frontend default; /api(v1) to backend. CloudWatch log group /ecs/costfx-dev.
- Backend config: hardened Sequelize PostgreSQL config to enable SSL automatically when needed; normalize DATABASE_URL to enforce sslmode=no-verify and set dialectOptions.ssl { require:true, rejectUnauthorized:false }.
- SSM: ensured DATABASE_URL has URL-encoded password; experimented with ssl and sslmode flags; final direction is to keep URL clean in SSM and let app enforce SSL with no-verify.

Problems encountered and fixes
1) 503 from ALB
   - Cause: no healthy targets; containers failing.
   - Fix: build images for linux/amd64; corrected frontend packaging to nginx. ECS targets became healthy for frontend.

2) Backend task crash: "Missing script: start"
   - Cause: Docker context/scripts mismatch.
   - Fix: updated backend Dockerfile and used CMD "node src/index.js".

3) CannotPullContainerError (platform mismatch)
   - Cause: image manifest had no linux/amd64 descriptor.
   - Fix: rebuild with buildx --platform linux/amd64 and push.

4) DB URL parsing failures (special chars in password)
   - Cause: DATABASE_URL constructed without URL-encoding.
   - Fix: changed Terraform to use urlencode(random_password.db_password.result) when building SSM param.

5) Postgres SSL requirement errors
   - Symptoms: initially "no pg_hba.conf entry... no encryption", then "SELF_SIGNED_CERT_IN_CHAIN" when adding ssl=true.
   - Fix: app-level ssl enforcement: detect RDS/flags and enable Sequelize ssl with rejectUnauthorized:false; normalize URL to include sslmode=no-verify to satisfy pg client. Rebuilt and redeployed backend image and retagged latest.

Current state (end of session)
- Frontend: healthy on ALB HTTP. HTTPS wiring exists but pending valid ACM cert.
- Backend: still failing to connect; latest stopped task shows either no-encryption or self-signed chain issues depending on URL flags. We committed app code to prefer SSL with no-verify, and retagged/pushed. Need one more deploy cycle to confirm stability. DATABASE_URL in SSM currently has no query params; app should add sslmode=no-verify at runtime.
- Security groups: locked down appropriately.

Items left undone / next steps
- Verify backend task reaches RUNNING and target group healthy; if errors persist:
  - Double-check that the latest image is actually used by service (consider bumping task definition revision or image tag immutability).
  - Add explicit environment variable PGSSLMODE=no-verify in ECS task definition to be safe.
  - Optionally add RDS CA bundle trust instead of no-verify, if required for compliance.
- Re-enable HTTPS once a valid ACM certificate (issued in us-west-2) is available; apply Terraform and update listener to redirect 80→443.
- CI/CD: add GitHub Actions workflows for backend and frontend to build and push images to ECR and force ECS deployments.
- Observability: increase CloudWatch log retention, add metrics/alarms for target group unhealthy hosts and ECS task failures.
- Secrets hygiene: replace placeholder OpenAI API key SSM param with a real value in the target environment.
