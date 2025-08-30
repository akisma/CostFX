# Database URL parameter
resource "aws_ssm_parameter" "database_url" {
  name  = "/${var.app_name}/${var.environment}/database_url"
  type  = "SecureString"
  value = "postgresql://${aws_db_instance.postgres.username}:${random_password.db_password.result}@${aws_db_instance.postgres.endpoint}/${aws_db_instance.postgres.db_name}"

  tags = {
    Name = "${var.app_name}-${var.environment}-database-url"
  }
}

# Redis URL parameter
resource "aws_ssm_parameter" "redis_url" {
  name  = "/${var.app_name}/${var.environment}/redis_url"
  type  = "SecureString"
  value = "redis://${aws_elasticache_cluster.redis.cache_nodes[0].address}:${aws_elasticache_cluster.redis.cache_nodes[0].port}"

  tags = {
    Name = "${var.app_name}-${var.environment}-redis-url"
  }
}

# JWT Secret parameter
resource "aws_ssm_parameter" "jwt_secret" {
  name  = "/${var.app_name}/${var.environment}/jwt_secret"
  type  = "SecureString"
  value = random_password.jwt_secret.result

  tags = {
    Name = "${var.app_name}-${var.environment}-jwt-secret"
  }
}

# Random JWT secret
resource "random_password" "jwt_secret" {
  length  = 64
  special = true
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

# SSL Certificate ARN
resource "aws_ssm_parameter" "ssl_certificate_arn" {
  name  = "/costfx/${var.environment}/ssl_certificate_arn"
  type  = "SecureString"
  value = "PLACEHOLDER_UPDATE_MANUALLY"

  tags = {
    Name = "${var.app_name}-${var.environment}-ssl-certificate-arn"
  }

  lifecycle {
    ignore_changes = [value]
  }
}

# Backend API URL for frontend (used in build process)
resource "aws_ssm_parameter" "backend_api_url" {
  name  = "/${var.app_name}/${var.environment}/backend_api_url"
  type  = "String"
  value = "http://${aws_lb.main.dns_name}/api/v1"

  tags = {
    Name = "${var.app_name}-${var.environment}-backend-api-url"
  }
}
