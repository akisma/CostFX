# Backend Notes

- DATABASE_URL is required. It may be supplied via .env (local) or SSM (ECS).
- SSL:
  - The app auto-enables SSL for Postgres when:
    - DB host looks like RDS (*.rds.amazonaws.com)
    - PGSSLMODE=require or DB_SSL=true
    - DATABASE_URL includes ssl=true or sslmode=require
    - NODE_ENV=production as a fallback
  - Terraform stores an SSM DATABASE_URL with ssl=true and a URL-encoded password.
