variable "app_name" {}
variable "environment" {}
variable "path_prefix" {}
variable "database_url" {}
variable "openai_api_key_placeholder" {}

resource "random_password" "jwt" {
  length  = 64
  special = true
}

resource "aws_ssm_parameter" "database_url" {
  name  = "${var.path_prefix}/database_url"
  type  = "SecureString"
  value = var.database_url
}

resource "aws_ssm_parameter" "jwt_secret" {
  name  = "${var.path_prefix}/jwt_secret"
  type  = "SecureString"
  value = random_password.jwt.result
}

resource "aws_ssm_parameter" "openai_api_key" {
  name  = "${var.path_prefix}/openai_api_key"
  type  = "SecureString"
  value = var.openai_api_key_placeholder
  lifecycle { ignore_changes = [value] }
}
