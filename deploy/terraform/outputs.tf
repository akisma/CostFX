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
# LOAD BALANCER OUTPUTS (ECS deployment only)
# ============================================================================

output "load_balancer_dns" {
  description = "DNS name of the load balancer (ECS only)"
  value       = var.deployment_type == "ecs" ? aws_lb.main[0].dns_name : null
}

output "load_balancer_url" {
  description = "HTTPS URL of the load balancer (ECS only)"
  value       = var.deployment_type == "ecs" ? "https://${aws_lb.main[0].dns_name}" : null
}

output "backend_url" {
  description = "Backend API base URL"
  value       = var.deployment_type == "ecs" ? "https://${aws_lb.main[0].dns_name}/api" : "http://${aws_eip.app[0].public_ip}:3001/api"
}

output "load_balancer_zone_id" {
  description = "Zone ID of the load balancer (ECS only)"
  value       = var.deployment_type == "ecs" ? aws_lb.main[0].zone_id : null
}

output "load_balancer_arn" {
  description = "ARN of the load balancer (ECS only)"
  value       = var.deployment_type == "ecs" ? aws_lb.main[0].arn : null
}

output "target_group_arns" {
  description = "ARNs of the target groups (ECS only)"
  value       = var.deployment_type == "ecs" ? [aws_lb_target_group.backend[0].arn, aws_lb_target_group.frontend[0].arn] : []
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
  description = "ID of the ALB security group (ECS only)"
  value       = var.deployment_type == "ecs" ? module.alb_security_group[0].security_group_id : null
}

output "ecs_backend_security_group_id" {
  description = "ID of the ECS backend security group (ECS only)"
  value       = var.deployment_type == "ecs" ? module.ecs_backend_security_group[0].security_group_id : null
}

output "ecs_frontend_security_group_id" {
  description = "ID of the ECS frontend security group (ECS only)"
  value       = var.deployment_type == "ecs" ? module.ecs_frontend_security_group[0].security_group_id : null
}

output "ec2_security_group_id" {
  description = "ID of the EC2 security group (EC2 only)"
  value       = var.deployment_type == "ec2" ? module.ec2_security_group[0].security_group_id : null
}

# ============================================================================
# APPLICATION URLS
# ============================================================================

output "application_url" {
  description = "URL to access the application"
  value       = var.deployment_type == "ecs" ? "https://${aws_lb.main[0].dns_name}" : "http://${aws_eip.app[0].public_ip}"
}

output "api_url" {
  description = "API base URL"
  value       = var.deployment_type == "ecs" ? "https://${aws_lb.main[0].dns_name}/api" : "http://${aws_eip.app[0].public_ip}:3001/api"
}

# ============================================================================
# EC2 OUTPUTS (EC2 deployment only)
# ============================================================================

output "ec2_instance_id" {
  description = "ID of the EC2 instance (EC2 only)"
  value       = var.deployment_type == "ec2" ? aws_instance.app[0].id : null
}

output "ec2_public_ip" {
  description = "Public IP address of the EC2 instance (EC2 only)"
  value       = var.deployment_type == "ec2" ? aws_eip.app[0].public_ip : null
}

output "ec2_instance_type" {
  description = "Instance type of the EC2 instance (EC2 only)"
  value       = var.deployment_type == "ec2" ? var.ec2_instance_type : null
}

# ============================================================================
# DEPLOYMENT TYPE
# ============================================================================

output "deployment_type" {
  description = "Type of deployment (ecs or ec2)"
  value       = var.deployment_type
}
