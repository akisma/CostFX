variable "app_name" {}
variable "environment" {}
variable "vpc_id" {}
variable "subnet_ids" { type = list(string) }
variable "multi_az" { type = bool }
variable "ecs_sg_id" { type = string }

resource "aws_db_subnet_group" "this" {
  name       = "${var.app_name}-${var.environment}-db-subnet"
  subnet_ids = var.subnet_ids
}

resource "random_password" "db" {
  length  = 32
  special = true
}

resource "aws_security_group" "db" {
  name   = "${var.app_name}-${var.environment}-db-sg"
  vpc_id = var.vpc_id
  # Allow only from ECS security group
  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [var.ecs_sg_id]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_db_instance" "postgres" {
  identifier              = "${var.app_name}-${var.environment}-pg"
  engine                  = "postgres"
  instance_class          = "db.t4g.micro"
  allocated_storage       = 20
  username                = "postgres"
  password                = random_password.db.result
  db_name                 = "restaurant_ai"
  vpc_security_group_ids  = [aws_security_group.db.id]
  db_subnet_group_name    = aws_db_subnet_group.this.name
  publicly_accessible     = true
  multi_az                = var.multi_az
  skip_final_snapshot     = true
  backup_retention_period = 0
}

locals {
  database_url = "postgresql://postgres:${urlencode(random_password.db.result)}@${aws_db_instance.postgres.address}/${aws_db_instance.postgres.db_name}"
}

output "database_url" {
  value     = local.database_url
  sensitive = true
}

output "endpoint" {
  value = aws_db_instance.postgres.address
}
