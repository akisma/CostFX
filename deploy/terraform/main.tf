# Provider configuration
terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = ">= 3.0"
    }
  }
  
  # Configure for remote state
  backend "s3" {
    bucket = "costfx-tf-state-568530517605"
    key    = "env/dev/infra.tfstate"
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
