# Provider configuration
terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  
  # Configure for remote state
  backend "s3" {
    bucket = "costfx-terraform-state"  # Update this with your actual bucket name
    key    = "infrastructure/terraform.tfstate"
    region = "us-west-2"
  }
}

# Configure the AWS Provider
provider "aws" {
  region = var.aws_region
  
  default_tags {
    tags = {
      Project     = "CostFX"
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}
