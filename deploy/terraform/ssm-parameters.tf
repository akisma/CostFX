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
  name = "/${var.app_name}/${var.environment}/database_url"
  type = "SecureString"
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

# Essential database configuration
resource "aws_ssm_parameter" "db_ssl" {
  name  = "/${var.app_name}/${var.environment}/db_ssl"
  type  = "String"
  value = "true"

  tags = {
    Name = "${var.app_name}-${var.environment}-db-ssl"
  }
}

resource "aws_ssm_parameter" "node_env" {
  name  = "/${var.app_name}/${var.environment}/node_env"
  type  = "String"
  value = var.environment == "dev" ? "development" : "production"

  tags = {
    Name = "${var.app_name}-${var.environment}-node-env"
  }
}

# OpenAI API Key parameter (requires manual setup for security)
resource "aws_ssm_parameter" "openai_api_key" {
  name  = "/${var.app_name}/${var.environment}/openai_api_key"
  type  = "SecureString"
  value = "REPLACE_WITH_YOUR_OPENAI_API_KEY"

  tags = {
    Name        = "${var.app_name}-${var.environment}-openai-api-key"
    Environment = var.environment
    Sensitive   = "true"
  }

  lifecycle {
    ignore_changes = [value]
  }
}


