# ============================================================================
# EC2 SIMPLIFIED DEPLOYMENT
# ============================================================================
# This file contains the EC2-based deployment configuration as a simplified
# alternative to the ECS deployment. It will only be active when
# deployment_type = "ec2"
# ============================================================================

# Data source for Amazon Linux 2023 AMI
data "aws_ami" "amazon_linux_2023" {
  count       = var.deployment_type == "ec2" ? 1 : 0
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# Security Group for EC2 Instance
module "ec2_security_group" {
  count  = var.deployment_type == "ec2" ? 1 : 0
  source = "terraform-aws-modules/security-group/aws"

  name        = "${var.app_name}-${var.environment}-ec2"
  description = "Security group for EC2 instance (simplified deployment)"
  vpc_id      = module.vpc.vpc_id

  # Allow HTTP and HTTPS from anywhere
  ingress_cidr_blocks = ["0.0.0.0/0"]
  ingress_rules       = ["http-80-tcp", "https-443-tcp"]

  # Allow SSH from anywhere (consider restricting this in production)
  ingress_with_cidr_blocks = [
    {
      from_port   = 22
      to_port     = 22
      protocol    = "tcp"
      cidr_blocks = "0.0.0.0/0"
      description = "SSH access"
    }
  ]

  # Allow all outbound traffic
  egress_rules = ["all-all"]

  tags = {
    Name = "${var.app_name}-${var.environment}-ec2-sg"
  }
}

# IAM Role for EC2 Instance
resource "aws_iam_role" "ec2_role" {
  count = var.deployment_type == "ec2" ? 1 : 0
  name  = "${var.app_name}-${var.environment}-ec2-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "${var.app_name}-${var.environment}-ec2-role"
  }
}

# Attach SSM managed policy for Systems Manager access
resource "aws_iam_role_policy_attachment" "ec2_ssm" {
  count      = var.deployment_type == "ec2" ? 1 : 0
  role       = aws_iam_role.ec2_role[0].name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

# Attach CloudWatch agent policy
resource "aws_iam_role_policy_attachment" "ec2_cloudwatch" {
  count      = var.deployment_type == "ec2" ? 1 : 0
  role       = aws_iam_role.ec2_role[0].name
  policy_arn = "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy"
}

# Custom policy for ECR access
resource "aws_iam_role_policy" "ec2_ecr_policy" {
  count = var.deployment_type == "ec2" ? 1 : 0
  name  = "${var.app_name}-${var.environment}-ec2-ecr-policy"
  role  = aws_iam_role.ec2_role[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ecr:GetAuthorizationToken",
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage"
        ]
        Resource = "*"
      }
    ]
  })
}

# Custom policy for SSM Parameter Store access
resource "aws_iam_role_policy" "ec2_ssm_params" {
  count = var.deployment_type == "ec2" ? 1 : 0
  name  = "${var.app_name}-${var.environment}-ec2-ssm-params-policy"
  role  = aws_iam_role.ec2_role[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ssm:GetParameters",
          "ssm:GetParameter",
          "ssm:GetParametersByPath"
        ]
        Resource = [
          "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/${var.app_name}/${var.environment}/*"
        ]
      }
    ]
  })
}

# IAM Instance Profile
resource "aws_iam_instance_profile" "ec2_profile" {
  count = var.deployment_type == "ec2" ? 1 : 0
  name  = "${var.app_name}-${var.environment}-ec2-profile"
  role  = aws_iam_role.ec2_role[0].name

  tags = {
    Name = "${var.app_name}-${var.environment}-ec2-profile"
  }
}

# CloudWatch Log Group for EC2
resource "aws_cloudwatch_log_group" "ec2_app" {
  count             = var.deployment_type == "ec2" ? 1 : 0
  name              = "/ec2/${var.app_name}-${var.environment}"
  retention_in_days = 30

  tags = {
    Name    = "${var.app_name}-${var.environment}-ec2-logs"
    Purpose = "Application logs for EC2 deployment"
  }
}

# User data script for EC2 instance
locals {
  ec2_user_data = var.deployment_type == "ec2" ? templatefile("${path.module}/user_data_ec2.sh", {
    app_name         = var.app_name
    environment      = var.environment
    aws_region       = var.aws_region
    backend_image    = var.backend_image != "" ? var.backend_image : "${data.aws_caller_identity.current.account_id}.dkr.ecr.${var.aws_region}.amazonaws.com/${var.app_name}-${var.environment}-backend:latest"
    frontend_image   = var.frontend_image != "" ? var.frontend_image : "${data.aws_caller_identity.current.account_id}.dkr.ecr.${var.aws_region}.amazonaws.com/${var.app_name}-${var.environment}-frontend:latest"
    db_endpoint      = module.rds.db_instance_endpoint
    log_group        = aws_cloudwatch_log_group.ec2_app[0].name
  }) : ""
}

# EC2 Instance
resource "aws_instance" "app" {
  count                  = var.deployment_type == "ec2" ? 1 : 0
  ami                    = data.aws_ami.amazon_linux_2023[0].id
  instance_type          = var.ec2_instance_type
  subnet_id              = module.vpc.public_subnets[0]
  vpc_security_group_ids = [module.ec2_security_group[0].security_group_id]
  iam_instance_profile   = aws_iam_instance_profile.ec2_profile[0].name
  key_name               = var.ec2_key_name != "" ? var.ec2_key_name : null

  user_data                   = local.ec2_user_data
  user_data_replace_on_change = true

  # Enable detailed monitoring
  monitoring = true

  # Root volume configuration
  root_block_device {
    volume_type           = "gp3"
    volume_size           = 30
    delete_on_termination = true
    encrypted             = true

    tags = {
      Name = "${var.app_name}-${var.environment}-ec2-root"
    }
  }

  # Enable termination protection for production
  disable_api_termination = var.environment == "prod" ? true : false

  # Metadata options for security
  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 1
    instance_metadata_tags      = "enabled"
  }

  tags = {
    Name = "${var.app_name}-${var.environment}-ec2"
  }

  lifecycle {
    ignore_changes = [
      ami,  # Prevent recreation when AMI updates
    ]
  }
}

# Elastic IP for EC2 Instance
resource "aws_eip" "app" {
  count    = var.deployment_type == "ec2" ? 1 : 0
  instance = aws_instance.app[0].id
  domain   = "vpc"

  tags = {
    Name = "${var.app_name}-${var.environment}-ec2-eip"
  }
}

# Update RDS security group to allow access from EC2
resource "aws_security_group_rule" "rds_from_ec2" {
  count                    = var.deployment_type == "ec2" ? 1 : 0
  type                     = "ingress"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  source_security_group_id = module.ec2_security_group[0].security_group_id
  security_group_id        = module.rds_security_group.security_group_id
  description              = "Allow EC2 instance to PostgreSQL"
}
