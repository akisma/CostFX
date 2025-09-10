variable "app_name" {}
variable "environment" {}

resource "aws_ecr_repository" "backend" {
  name = "${var.app_name}-${var.environment}-backend"
  image_scanning_configuration { scan_on_push = true }
  encryption_configuration { encryption_type = "AES256" }
}

resource "aws_ecr_repository" "frontend" {
  name = "${var.app_name}-${var.environment}-frontend"
  image_scanning_configuration { scan_on_push = true }
  encryption_configuration { encryption_type = "AES256" }
}

output "backend_repo_url" { value = aws_ecr_repository.backend.repository_url }
output "frontend_repo_url" { value = aws_ecr_repository.frontend.repository_url }
