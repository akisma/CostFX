# ============================================================================
# VPC MODULE
# ============================================================================

module "vpc" {
  source = "terraform-aws-modules/vpc/aws"

  name = "${var.app_name}-${var.environment}"
  cidr = var.vpc_cidr

  azs             = var.availability_zones
  public_subnets  = var.public_subnet_cidrs
  private_subnets = var.private_subnet_cidrs

  # Enable DNS support
  enable_dns_hostnames = true
  enable_dns_support   = true

  # NAT Gateway configuration - only needed for ECS deployment with private subnets
  enable_nat_gateway = var.deployment_type == "ecs" ? true : false
  enable_vpn_gateway = false
  single_nat_gateway = var.environment == "dev" ? true : false # Single NAT for dev, multi for prod

  # Public subnet configuration
  map_public_ip_on_launch = true

  # VPC Flow Logs (best practice for monitoring)
  enable_flow_log                      = true
  create_flow_log_cloudwatch_iam_role  = true
  create_flow_log_cloudwatch_log_group = true

  # Tagging
  tags = {
    Name        = "${var.app_name}-${var.environment}-vpc"
    Project     = "CostFX"
    Environment = var.environment
    ManagedBy   = "Terraform"
  }

  public_subnet_tags = {
    Type = "public"
    Name = "${var.app_name}-${var.environment}-public"
  }

  private_subnet_tags = {
    Type = "private"
    Name = "${var.app_name}-${var.environment}-private"
  }

  igw_tags = {
    Name = "${var.app_name}-${var.environment}-igw"
  }

  nat_gateway_tags = {
    Name = "${var.app_name}-${var.environment}-nat"
  }

  nat_eip_tags = {
    Name = "${var.app_name}-${var.environment}-nat-eip"
  }
}
