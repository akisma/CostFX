# ============================================================================
# SSM PARAMETERS FOR APPLICATION CONFIGURATION
# ============================================================================

# Random passwords
resource "random_password" "jwt_secret" {
  length  = 64
  special = true
}

# Database URL parameter
resource "aws_ssm_parameter" "database_url" {
  name  = "/${var.app_name}/${var.environment}/database_url"
  type  = "SecureString"
  # Ensure password is URL-encoded and SSL is required by default
  value = "postgresql://${module.rds.db_instance_username}:${urlencode(random_password.db_password.result)}@${module.rds.db_instance_endpoint}/${module.rds.db_instance_name}?ssl=true"

  tags = {
    Name = "${var.app_name}-${var.environment}-database-url"
  }
}

# Redis URL parameter - temporarily disabled for destroy
# resource "aws_ssm_parameter" "redis_url" {
#   name  = "/${var.app_name}/${var.environment}/redis_url"
#   type  = "SecureString"
#   value = "redis://placeholder:6379"
# 
#   tags = {
#     Name = "${var.app_name}-${var.environment}-redis-url"
#   }
# }

# JWT Secret parameter
resource "aws_ssm_parameter" "jwt_secret" {
  name  = "/${var.app_name}/${var.environment}/jwt_secret"
  type  = "SecureString"
  value = random_password.jwt_secret.result

  tags = {
    Name = "${var.app_name}-${var.environment}-jwt-secret"
  }
}

# OpenAI API Key parameter (you'll need to set this manually)
resource "aws_ssm_parameter" "openai_api_key" {
  name  = "/${var.app_name}/${var.environment}/openai_api_key"
  type  = "SecureString"
  value = "REPLACE_WITH_YOUR_OPENAI_API_KEY"

  tags = {
    Name = "${var.app_name}-${var.environment}-openai-api-key"
  }

  lifecycle {
    ignore_changes = [value]
  }
}

# Backend API URL for frontend (used in build process)
resource "aws_ssm_parameter" "backend_api_url" {
  name  = "/${var.app_name}/${var.environment}/backend_api_url"
  type  = "String"
  value = "https://${aws_lb.main.dns_name}/api/v1"

  tags = {
    Name = "${var.app_name}-${var.environment}-backend-api-url"
  }
}

# SSL Certificate ARN parameter (for HTTPS configuration)
resource "aws_ssm_parameter" "ssl_certificate_arn" {
  name  = "/${var.app_name}/${var.environment}/ssl_certificate_arn"
  type  = "String"
  value = var.ssl_certificate_arn

  tags = {
    Name = "${var.app_name}-${var.environment}-ssl-certificate-arn"
  }
}
