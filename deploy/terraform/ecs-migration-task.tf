# ============================================================================
# ECS MIGRATION TASK DEFINITION
# ============================================================================
# Only deployed when deployment_type = "ecs"
# ============================================================================

# Migration-specific task definition
resource "aws_ecs_task_definition" "migration" {
  count                    = var.deployment_type == "ecs" ? 1 : 0
  family                   = "${var.app_name}-${var.environment}-migration"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = aws_iam_role.ecs_task_execution_role[count.index].arn

  container_definitions = jsonencode([
    {
      name = "migration"
      # Use SHA-tagged image if provided, fallback to latest for initial deployment
      # GitHub Actions workflow dynamically updates this with the latest backend image
      image = var.backend_image != "" ? var.backend_image : "${data.aws_caller_identity.current.account_id}.dkr.ecr.${var.aws_region}.amazonaws.com/${var.app_name}-${var.environment}-backend:latest"

      # Override the default command to run migrations with enhanced logging
      command = [
        "/bin/sh", "-c",
        "echo '🚀 Migration container starting...' && echo \"Node version: $(node --version)\" && echo \"NPM version: $(npm --version)\" && echo \"Working directory: $(pwd)\" && ls -la && echo '📦 Running migration with verbose output...' && npm run migrate:reset-dev 2>&1 | tee /tmp/migration.log && echo '✅ Migration completed successfully' || (echo '❌ Migration failed with exit code:' $? && cat /tmp/migration.log && exit 1)"
      ]

      environment = [
        {
          name  = "NODE_ENV"
          value = "production"
        },
        {
          name  = "DB_SSL"
          value = "true"
        },
        {
          name  = "PGSSLMODE"
          value = "no-verify"
        }
      ]

      # Pull DATABASE_URL from SSM Parameter Store
      secrets = [
        {
          name      = "DATABASE_URL"
          valueFrom = "/costfx/dev/database_url"
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = "/ecs/${var.app_name}-${var.environment}-migration"
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "ecs"
        }
      }
    }
  ])

  tags = {
    Name = "${var.app_name}-${var.environment}-migration-task"
  }
}

# CloudWatch log group for migration logs
resource "aws_cloudwatch_log_group" "migration" {
  count             = var.deployment_type == "ecs" ? 1 : 0
  name              = "/ecs/${var.app_name}-${var.environment}-migration"
  retention_in_days = 30

  tags = {
    Name    = "${var.app_name}-${var.environment}-migration-logs"
    Purpose = "Database migration logs for debugging and auditing"
  }
}
