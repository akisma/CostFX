# ============================================================================
# APPLICATION LOAD BALANCER (Raw AWS Resources - Best Practice for ALB)
# ============================================================================

# ALB Security Group Module (terraform-aws-modules DOES exist for security groups)
module "alb_security_group" {
  source = "terraform-aws-modules/security-group/aws"
  
  name        = "${var.app_name}-${var.environment}-alb"
  description = "Security group for Application Load Balancer"
  vpc_id      = module.vpc.vpc_id
  
  # Predefined rules for HTTP/HTTPS
  ingress_rules       = ["http-80-tcp", "https-443-tcp"]
  ingress_cidr_blocks = var.allowed_cidr_blocks
  
  # Allow all outbound traffic
  egress_rules = ["all-all"]
  
  tags = {
    Name = "${var.app_name}-${var.environment}-alb-sg"
  }
}

# S3 Bucket for ALB Access Logs
resource "random_id" "bucket_suffix" {
  byte_length = 4
}

resource "aws_s3_bucket" "alb_logs" {
  bucket        = "${var.app_name}-${var.environment}-alb-logs-${random_id.bucket_suffix.hex}"
  force_destroy = true
  
  tags = {
    Name = "${var.app_name}-${var.environment}-alb-logs"
  }
}

resource "aws_s3_bucket_policy" "alb_logs" {
  bucket = aws_s3_bucket.alb_logs.id
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::797873946194:root"  # ELB service account for us-west-2
        }
        Action   = "s3:PutObject"
        Resource = "${aws_s3_bucket.alb_logs.arn}/*"
      }
    ]
  })
}

# Application Load Balancer (Raw AWS Resource - Standard Approach)
resource "aws_lb" "main" {
  name               = "${var.app_name}-${var.environment}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [module.alb_security_group.security_group_id]
  subnets            = module.vpc.public_subnets

  enable_deletion_protection = var.environment == "prod" ? true : false

  # Access logging (best practice for production)
  access_logs {
    bucket  = aws_s3_bucket.alb_logs.id
    prefix  = "${var.app_name}-${var.environment}"
    enabled = true
  }

  tags = {
    Name = "${var.app_name}-${var.environment}-alb"
  }
}

# Target Group for Backend
resource "aws_lb_target_group" "backend" {
  name        = "${var.app_name}-${var.environment}-backend-tg"
  port        = 3001
  protocol    = "HTTP"
  vpc_id      = module.vpc.vpc_id
  target_type = "ip"

  # Best practice: faster deployment with reduced deregistration delay
  deregistration_delay = 30

  health_check {
    enabled             = true
    healthy_threshold   = 2
    interval            = 60
    matcher             = "200"
    path                = "/api/v1/"
    port                = "traffic-port"
    protocol            = "HTTP"
    timeout             = 10
    unhealthy_threshold = 5
  }

  # Session stickiness for API consistency
  stickiness {
    type            = "lb_cookie"
    cookie_duration = 86400
    enabled         = true
  }

  tags = {
    Name = "${var.app_name}-${var.environment}-backend-tg"
  }
}

# Target Group for Frontend
resource "aws_lb_target_group" "frontend" {
  name        = "${var.app_name}-${var.environment}-frontend-tg"
  port        = 80
  protocol    = "HTTP"
  vpc_id      = module.vpc.vpc_id
  target_type = "ip"

  # Best practice: faster deployment
  deregistration_delay = 30

  health_check {
    enabled             = true
    healthy_threshold   = 2
    interval            = 30
    matcher             = "200"
    path                = "/health"
    port                = "traffic-port"
    protocol            = "HTTP"
    timeout             = 5
    unhealthy_threshold = 2
  }

  tags = {
    Name = "${var.app_name}-${var.environment}-frontend-tg"
  }
}

# HTTP Listener (redirect to HTTPS)
resource "aws_lb_listener" "main" {
  load_balancer_arn = aws_lb.main.arn
  port              = "80"
  protocol          = "HTTP"

  # Redirect HTTP to HTTPS
  default_action {
    type = "redirect"

    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }

  tags = {
    Name = "${var.app_name}-${var.environment}-alb-listener-http"
  }
}

# HTTPS Listener
resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.main.arn
  port              = "443"
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = local.certificate_arn

  # Default action: 404 for unmatched requests
  default_action {
    type = "fixed-response"

    fixed_response {
      content_type = "text/plain"
      message_body = "Not Found"
      status_code  = "404"
    }
  }

  tags = {
    Name = "${var.app_name}-${var.environment}-alb-listener-https"
  }
}

# Listener Rule for API traffic (HTTPS)
resource "aws_lb_listener_rule" "https_api" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 100

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.backend.arn
  }

  condition {
    path_pattern {
      values = ["/api/*"]
    }
  }

  tags = {
    Name = "${var.app_name}-${var.environment}-api-rule-https"
  }
}

# Listener Rule for Frontend traffic (HTTPS)
resource "aws_lb_listener_rule" "https_frontend" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 200

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.frontend.arn
  }

  condition {
    path_pattern {
      values = ["/*"]
    }
  }

  tags = {
    Name = "${var.app_name}-${var.environment}-frontend-rule-https"
  }
}
