# Environment configuration
variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-west-2"
}

variable "availability_zones" {
  description = "List of availability zones"
  type        = list(string)
  default     = ["us-west-2a", "us-west-2b"]
}

# Networking
variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private subnets"
  type        = list(string)
  default     = ["10.0.3.0/24", "10.0.4.0/24"]
}

# ECS Configuration
variable "backend_cpu" {
  description = "CPU units for backend service"
  type        = number
  default     = 512
}

variable "backend_memory" {
  description = "Memory for backend service (MB)"
  type        = number
  default     = 1024
}

variable "frontend_cpu" {
  description = "CPU units for frontend service"
  type        = number
  default     = 256
}

variable "frontend_memory" {
  description = "Memory for frontend service (MB)"
  type        = number
  default     = 512
}

variable "backend_desired_count" {
  description = "Desired number of backend tasks"
  type        = number
  default     = 2
}

variable "frontend_desired_count" {
  description = "Desired number of frontend tasks"
  type        = number
  default     = 2
}

# Database Configuration
variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.micro"
}

variable "db_allocated_storage" {
  description = "RDS allocated storage (GB)"
  type        = number
  default     = 20
}

# Application Configuration
variable "app_name" {
  description = "Application name"
  type        = string
  default     = "costfx"
}

variable "domain_name" {
  description = "Domain name for the application"
  type        = string
  default     = "cost-fx.com"
}

# Security
variable "allowed_cidr_blocks" {
  description = "CIDR blocks allowed to access the load balancer"
  type        = list(string)
  default     = ["0.0.0.0/0"]  # Restrict this in production
}

# Docker Images
variable "backend_image" {
  description = "Docker image for backend service"
  type        = string
  default     = ""
}

variable "frontend_image" {
  description = "Docker image for frontend service"
  type        = string
  default     = ""
}

# Monitoring and Alerting
variable "alert_email" {
  description = "Email address for CloudWatch alerts and cost notifications"
  type        = string
  default     = "jessjacobsLLC@gmail.com"
  validation {
    condition     = can(regex("^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$", var.alert_email)) || var.alert_email == ""
    error_message = "The alert_email value must be a valid email address or empty string."
  }
}

# Application Secrets - stored in SSM Parameter Store
# No sensitive variables here - all secrets managed via SSM
