# ============================================================================
# VPC MODULE OUTPUTS
# ============================================================================

output "vpc_id" {
  description = "ID of the VPC"
  value       = module.vpc.vpc_id
}

output "public_subnet_ids" {
  description = "IDs of the public subnets"
  value       = module.vpc.public_subnets
}

output "private_subnet_ids" {
  description = "IDs of the private subnets"
  value       = module.vpc.private_subnets
}

output "vpc_cidr_block" {
  description = "CIDR block of the VPC"
  value       = module.vpc.vpc_cidr_block
}

# ============================================================================
# LOAD BALANCER OUTPUTS (Raw Resources)
# ============================================================================

output "load_balancer_dns" {
  description = "DNS name of the load balancer"
  value       = aws_lb.main.dns_name
}

output "load_balancer_url" {
  description = "HTTPS URL of the load balancer"
  value       = "https://${aws_lb.main.dns_name}"
}

output "backend_url" {
  description = "Backend API base URL"
  value       = "https://${aws_lb.main.dns_name}/api"
}

output "load_balancer_zone_id" {
  description = "Zone ID of the load balancer"
  value       = aws_lb.main.zone_id
}

output "load_balancer_arn" {
  description = "ARN of the load balancer"
  value       = aws_lb.main.arn
}

output "target_group_arns" {
  description = "ARNs of the target groups"
  value       = [aws_lb_target_group.backend.arn, aws_lb_target_group.frontend.arn]
}

# ============================================================================
# DATABASE MODULE OUTPUTS
# ============================================================================

output "rds_endpoint" {
  description = "RDS instance endpoint"
  value       = module.rds.db_instance_endpoint
  sensitive   = true
}

output "rds_port" {
  description = "RDS instance port"
  value       = module.rds.db_instance_port
  sensitive   = true
}

# output "redis_endpoint" {
#   description = "Redis cluster endpoint"
#   value       = module.redis.cluster_address
#   sensitive   = true
# }
# 
# output "redis_port" {
#   description = "Redis cluster port"
#   value       = 6379
#   sensitive   = true
# }

# ============================================================================
# SECURITY GROUP OUTPUTS
# ============================================================================

output "alb_security_group_id" {
  description = "ID of the ALB security group"
  value       = module.alb_security_group.security_group_id
}

output "ecs_backend_security_group_id" {
  description = "ID of the ECS backend security group"
  value       = module.ecs_backend_security_group.security_group_id
}

output "ecs_frontend_security_group_id" {
  description = "ID of the ECS frontend security group"
  value       = module.ecs_frontend_security_group.security_group_id
}

# ============================================================================
# APPLICATION URLS
# ============================================================================

output "application_url" {
  description = "HTTPS URL to access the application"
  value       = "https://${aws_lb.main.dns_name}"
}

output "api_url" {
  description = "API base URL"
  value       = "https://${aws_lb.main.dns_name}/api"
}
