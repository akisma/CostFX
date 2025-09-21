# ============================================================================
# ECS MIGRATION TASK DEFINITION
# ============================================================================

# Migration-specific task definition
resource "aws_ecs_task_definition" "migration" {
  family                   = "${var.app_name}-${var.environment}-migration"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = aws_iam_role.ecs_task_execution_role.arn

  container_definitions = jsonencode([
    {
      name  = "migration"
      image = "${data.aws_caller_identity.current.account_id}.dkr.ecr.${var.aws_region}.amazonaws.com/${var.app_name}-${var.environment}-backend:PLACEHOLDER"
      
      # Override the default command to run migrations with dev reset (TEMPORARY - remove for production)
      command = ["npm", "run", "migrate:reset-dev"]
      
      environment = [
        {
          name  = "NODE_ENV"
          value = "production"
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
  name              = "/ecs/${var.app_name}-${var.environment}-migration"
  retention_in_days = 7
  
  tags = {
    Name = "${var.app_name}-${var.environment}-migration-logs"
  }
}
