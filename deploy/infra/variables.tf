variable "app_name" {
  type    = string
  default = "costfx"
}

variable "environment" {
  type    = string
  default = "dev"
}

variable "aws_region" {
  type    = string
  default = "us-west-2"
}

variable "create_rds" {
  type    = bool
  default = true
}

variable "multi_az_db" {
  type    = bool
  default = false
}

variable "desired_backend_count" {
  type    = number
  default = 1
}

variable "desired_frontend_count" {
  type    = number
  default = 1
}

variable "enable_https" {
  type    = bool
  default = false
}

variable "certificate_arn" {
  type        = string
  description = "ACM certificate ARN for HTTPS (in region)"
  default     = null
}

variable "create_redis" {
  type    = bool
  default = false
}

variable "enable_autoscaling" {
  type    = bool
  default = false
}

variable "log_retention_days" {
  type    = number
  default = 14
}

variable "create_ecs" {
  type    = bool
  default = true
}

variable "backend_image" {
  type        = string
  description = "Backend image (ECR URL with tag)"
}

variable "frontend_image" {
  type        = string
  description = "Frontend image (ECR URL with tag)"
}

variable "openai_api_key_placeholder" {
  type    = string
  default = "REPLACE_ME"
}

locals {
  ssm_path_prefix = "/${var.app_name}/${var.environment}" // consistent parameter path
}
