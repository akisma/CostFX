# ============================================================================
# ENHANCED S3 SECURITY FOR ALB LOGS
# ============================================================================
# Only deployed when deployment_type = "ecs" (requires ALB)
# ============================================================================

# S3 Bucket Versioning for ALB logs
resource "aws_s3_bucket_versioning" "alb_logs" {
  count = var.deployment_type == "ecs" ? 1 : 0

  bucket = aws_s3_bucket.alb_logs[0].id
  versioning_configuration {
    status = "Enabled"
  }
}

# S3 Bucket Server-Side Encryption for ALB logs
resource "aws_s3_bucket_server_side_encryption_configuration" "alb_logs" {
  count = var.deployment_type == "ecs" ? 1 : 0

  bucket = aws_s3_bucket.alb_logs[0].id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

# S3 Bucket Public Access Block for ALB logs
resource "aws_s3_bucket_public_access_block" "alb_logs" {
  count = var.deployment_type == "ecs" ? 1 : 0

  bucket = aws_s3_bucket.alb_logs[0].id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# S3 Bucket Lifecycle Configuration for ALB logs
resource "aws_s3_bucket_lifecycle_configuration" "alb_logs" {
  count = var.deployment_type == "ecs" ? 1 : 0

  bucket = aws_s3_bucket.alb_logs[0].id

  rule {
    id     = "alb_logs_lifecycle"
    status = "Enabled"

    # Apply to all objects in the bucket
    filter {
      prefix = ""
    }

    # Transition to Standard-IA after 30 days
    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }

    # Transition to Glacier after 90 days
    transition {
      days          = 90
      storage_class = "GLACIER"
    }

    # Transition to Deep Archive after 1 year for long-term retention
    transition {
      days          = 365
      storage_class = "DEEP_ARCHIVE"
    }

    # Delete logs older than 7 years (compliance requirement)
    expiration {
      days = 2555 # 7 years
    }

    # Clean up incomplete multipart uploads after 7 days
    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }

    # Handle versioned objects
    noncurrent_version_transition {
      noncurrent_days = 30
      storage_class   = "STANDARD_IA"
    }

    noncurrent_version_transition {
      noncurrent_days = 90
      storage_class   = "GLACIER"
    }

    noncurrent_version_expiration {
      noncurrent_days = 365
    }
  }
}

# CloudWatch Log Group for S3 access logging (optional for production)
resource "aws_cloudwatch_log_group" "s3_access_logs" {
  count             = var.environment == "prod" && var.deployment_type == "ecs" ? 1 : 0
  name              = "/aws/s3/${aws_s3_bucket.alb_logs[0].id}/access-logs"
  retention_in_days = 90

  tags = {
    Name        = "${var.app_name}-${var.environment}-s3-access-logs"
    Environment = var.environment
  }
}

# S3 Bucket Metrics Configuration for monitoring
resource "aws_s3_bucket_metric" "alb_logs" {
  count = var.deployment_type == "ecs" ? 1 : 0

  bucket = aws_s3_bucket.alb_logs[0].id
  name   = "entire-bucket"
}

# S3 Bucket Request Payment Configuration (requester pays disabled)
resource "aws_s3_bucket_request_payment_configuration" "alb_logs" {
  count = var.deployment_type == "ecs" ? 1 : 0

  bucket = aws_s3_bucket.alb_logs[0].id
  payer  = "BucketOwner"
}

# Enhanced S3 Bucket Policy for ALB logs with additional security
resource "aws_s3_bucket_policy" "alb_logs_enhanced" {
  count = var.deployment_type == "ecs" ? 1 : 0

  bucket = aws_s3_bucket.alb_logs[0].id

  # This will replace the existing bucket policy
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowELBServiceAccount"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::797873946194:root" # ELB service account for us-west-2
        }
        Action   = "s3:PutObject"
        Resource = "${aws_s3_bucket.alb_logs[0].arn}/*"
        Condition = {
          StringEquals = {
            "s3:x-amz-acl" = "bucket-owner-full-control"
          }
        }
      },
      {
        Sid    = "AllowELBServiceAccountDeliveryCheck"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::797873946194:root" # ELB service account for us-west-2
        }
        Action   = "s3:GetBucketAcl"
        Resource = aws_s3_bucket.alb_logs[0].arn
      },
      {
        Sid       = "DenyInsecureConnections"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:*"
        Resource = [
          aws_s3_bucket.alb_logs[0].arn,
          "${aws_s3_bucket.alb_logs[0].arn}/*"
        ]
        Condition = {
          Bool = {
            "aws:SecureTransport" = "false"
          }
        }
      }
    ]
  })

  depends_on = [aws_s3_bucket_public_access_block.alb_logs]
}
