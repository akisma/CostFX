# ============================================================================
# SECURITY GROUPS MODULES
# ============================================================================

# Security Group for ECS Backend Tasks
module "ecs_backend_security_group" {
  count  = var.deployment_type == "ecs" ? 1 : 0
  source = "terraform-aws-modules/security-group/aws"
  
  name        = "${var.app_name}-${var.environment}-ecs-backend"
  description = "Security group for ECS backend tasks"
  vpc_id      = module.vpc.vpc_id
  
  # Allow traffic from ALB on port 3001
  ingress_with_source_security_group_id = [
    {
      from_port                = 3001
      to_port                  = 3001
      protocol                 = "tcp"
      description              = "Allow ALB to backend"
      source_security_group_id = module.alb_security_group[0].security_group_id
    }
  ]
  
  # Allow all outbound traffic
  egress_rules = ["all-all"]
  
  tags = {
    Name = "${var.app_name}-${var.environment}-ecs-backend-sg"
  }
}

# Security Group for ECS Frontend Tasks
module "ecs_frontend_security_group" {
  count  = var.deployment_type == "ecs" ? 1 : 0
  source = "terraform-aws-modules/security-group/aws"
  
  name        = "${var.app_name}-${var.environment}-ecs-frontend"
  description = "Security group for ECS frontend tasks"
  vpc_id      = module.vpc.vpc_id
  
  # Allow traffic from ALB on port 80
  ingress_with_source_security_group_id = [
    {
      from_port                = 80
      to_port                  = 80
      protocol                 = "tcp"
      description              = "Allow ALB to frontend"
      source_security_group_id = module.alb_security_group[0].security_group_id
    }
  ]
  
  # Allow all outbound traffic
  egress_rules = ["all-all"]
  
  tags = {
    Name = "${var.app_name}-${var.environment}-ecs-frontend-sg"
  }
}

# Security Group for RDS PostgreSQL
module "rds_security_group" {
  source = "terraform-aws-modules/security-group/aws"
  
  name        = "${var.app_name}-${var.environment}-rds"
  description = "Security group for RDS PostgreSQL database"
  vpc_id      = module.vpc.vpc_id
  
  # Allow PostgreSQL traffic from backend ECS tasks or EC2
  ingress_with_source_security_group_id = var.deployment_type == "ecs" ? [
    {
      from_port                = 5432
      to_port                  = 5432
      protocol                 = "tcp"
      description              = "Allow backend to PostgreSQL"
      source_security_group_id = module.ecs_backend_security_group[0].security_group_id
    }
  ] : []
  
  # Predefined PostgreSQL rule (alternative approach)
  # ingress_rules = ["postgresql-tcp"]
  # ingress_source_security_group_id = module.ecs_backend_security_group.security_group_id
  
  # Allow all outbound traffic (for updates, etc.)
  egress_rules = ["all-all"]
  
  tags = {
    Name = "${var.app_name}-${var.environment}-rds-sg"
  }
}

# Security Group for Redis ElastiCache
module "redis_security_group" {
  source = "terraform-aws-modules/security-group/aws"
  
  name        = "${var.app_name}-${var.environment}-redis"
  description = "Security group for Redis ElastiCache"
  vpc_id      = module.vpc.vpc_id
  
  # Allow Redis traffic from backend ECS tasks
  ingress_with_source_security_group_id = var.deployment_type == "ecs" ? [
    {
      from_port                = 6379
      to_port                  = 6379
      protocol                 = "tcp"
      description              = "Allow backend to Redis"
      source_security_group_id = module.ecs_backend_security_group[0].security_group_id
    }
  ] : []
  
  # Predefined Redis rule (alternative approach)
  # ingress_rules = ["redis-tcp"]
  # ingress_source_security_group_id = module.ecs_backend_security_group.security_group_id
  
  # Allow all outbound traffic
  egress_rules = ["all-all"]
  
  tags = {
    Name = "${var.app_name}-${var.environment}-redis-sg"
  }
}
