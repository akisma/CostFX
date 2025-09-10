variable "app_name" {}
variable "environment" {}
variable "vpc_id" {}
variable "subnet_ids" { type = list(string) }
variable "backend_image" {}
variable "frontend_image" {}
variable "desired_backend_count" { type = number }
variable "desired_frontend_count" { type = number }
variable "alb_listener_arn" {}
variable "backend_target_group_arn" {}
variable "frontend_target_group_arn" {}
variable "execution_role_arn" {}
variable "task_role_arn" {}
variable "log_group_name" {}
variable "log_retention_days" { type = number }
variable "ssm_path_prefix" {}
variable "alb_sg_id" { type = string }

resource "aws_cloudwatch_log_group" "ecs" {
  name              = var.log_group_name
  retention_in_days = var.log_retention_days
}

resource "aws_ecs_cluster" "this" {
  name = "${var.app_name}-${var.environment}-cluster"
}

locals {
  common_env = [
    { name = "NODE_ENV", value = var.environment },
    { name = "SSM_PREFIX", value = var.ssm_path_prefix }
  ]
  backend_env = concat(local.common_env, [
    { name = "PORT", value = "3001" },
    { name = "PGSSLMODE", value = "no-verify" }
  ])
  backend_secrets = [
    { name = "DATABASE_URL", valueFrom = "arn:aws:ssm:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:parameter${var.ssm_path_prefix}/database_url" },
    { name = "JWT_SECRET", valueFrom = "arn:aws:ssm:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:parameter${var.ssm_path_prefix}/jwt_secret" },
    { name = "OPENAI_API_KEY", valueFrom = "arn:aws:ssm:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:parameter${var.ssm_path_prefix}/openai_api_key" }
  ]
}

data "aws_region" "current" {}
data "aws_caller_identity" "current" {}

resource "aws_ecs_task_definition" "backend" {
  family                   = "${var.app_name}-${var.environment}-backend"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = 512
  memory                   = 1024
  execution_role_arn       = var.execution_role_arn
  task_role_arn            = var.task_role_arn
  container_definitions = jsonencode([
    {
      name  = "backend"
      image = var.backend_image
      essential = true
      portMappings = [{ containerPort = 3001, protocol = "tcp" }]
      environment = local.backend_env
      secrets     = local.backend_secrets
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.ecs.name
          awslogs-region        = data.aws_region.current.name
          awslogs-stream-prefix = "backend"
        }
      }
      healthCheck = {
        command     = ["CMD-SHELL", "wget -q -O - http://localhost:3001/api/v1/ || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 30
      }
    }
  ])
}

resource "aws_ecs_task_definition" "frontend" {
  family                   = "${var.app_name}-${var.environment}-frontend"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = 256
  memory                   = 512
  execution_role_arn       = var.execution_role_arn
  task_role_arn            = var.task_role_arn
  container_definitions = jsonencode([
    {
      name  = "frontend"
      image = var.frontend_image
      essential = true
      portMappings = [{ containerPort = 80, protocol = "tcp" }]
      environment = local.common_env
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.ecs.name
          awslogs-region        = data.aws_region.current.name
          awslogs-stream-prefix = "frontend"
        }
      }
      healthCheck = {
        command     = ["CMD-SHELL", "wget -q -O - http://localhost/ || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 30
      }
    }
  ])
}

resource "aws_security_group" "ecs" {
  name   = "${var.app_name}-${var.environment}-ecs-sg"
  vpc_id = var.vpc_id
  # Allow traffic only from ALB SG
  ingress {
    description     = "Backend from ALB"
    from_port       = 3001
    to_port         = 3001
    protocol        = "tcp"
    security_groups = [var.alb_sg_id]
  }
  ingress {
    description     = "Frontend from ALB"
    from_port       = 80
    to_port         = 80
    protocol        = "tcp"
    security_groups = [var.alb_sg_id]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_ecs_service" "backend" {
  name            = "${var.app_name}-${var.environment}-backend"
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.backend.arn
  desired_count   = var.desired_backend_count
  launch_type     = "FARGATE"
  network_configuration {
    subnets         = var.subnet_ids
    security_groups = [aws_security_group.ecs.id]
    assign_public_ip = true
  }
  load_balancer {
    target_group_arn = var.backend_target_group_arn
    container_name   = "backend"
    container_port   = 3001
  }
}

resource "aws_ecs_service" "frontend" {
  name            = "${var.app_name}-${var.environment}-frontend"
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.frontend.arn
  desired_count   = var.desired_frontend_count
  launch_type     = "FARGATE"
  network_configuration {
    subnets         = var.subnet_ids
    security_groups = [aws_security_group.ecs.id]
    assign_public_ip = true
  }
  load_balancer {
    target_group_arn = var.frontend_target_group_arn
    container_name   = "frontend"
    container_port   = 80
  }
}

output "backend_service_name" { value = aws_ecs_service.backend.name }
output "frontend_service_name" { value = aws_ecs_service.frontend.name }
output "ecs_sg_id" { value = aws_security_group.ecs.id }
