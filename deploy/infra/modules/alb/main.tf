variable "app_name" {}
variable "environment" {}
variable "vpc_id" {}
variable "public_subnet_ids" {
  type = list(string)
}
variable "enable_https" {
  type = bool
}
variable "certificate_arn" {
  type    = string
  default = null
}

resource "aws_security_group" "alb" {
  name        = "${var.app_name}-${var.environment}-alb-sg"
  description = "ALB SG"
  vpc_id      = var.vpc_id
  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  # Allow HTTPS when enabled
  dynamic "ingress" {
    for_each = var.enable_https && var.certificate_arn != null ? [1] : []
    content {
      from_port   = 443
      to_port     = 443
      protocol    = "tcp"
      cidr_blocks = ["0.0.0.0/0"]
    }
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_lb" "this" {
  name               = "${var.app_name}-${var.environment}-alb"
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = var.public_subnet_ids
}

resource "aws_lb_target_group" "backend" {
  name        = "${var.app_name}-${var.environment}-b-tg"
  port        = 3001
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = var.vpc_id
  health_check {
    path    = "/api/v1/"
    matcher = "200"
  }
}

resource "aws_lb_target_group" "frontend" {
  name        = "${var.app_name}-${var.environment}-f-tg"
  port        = 80
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = var.vpc_id
  health_check {
    path    = "/"
    matcher = "200"
  }
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.this.arn
  port              = 80
  protocol          = "HTTP"
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.frontend.arn
  }
}

# Redirect all HTTP traffic to HTTPS when enabled
resource "aws_lb_listener_rule" "http_redirect" {
  count        = var.enable_https && var.certificate_arn != null ? 1 : 0
  listener_arn = aws_lb_listener.http.arn
  priority     = 1
  action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
  condition {
    path_pattern { values = ["/*"] }
  }
}

# Attach backend target group via path-based rule so ECS service can use it
resource "aws_lb_listener_rule" "backend" {
  listener_arn = aws_lb_listener.http.arn
  priority     = 10
  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.backend.arn
  }
  condition {
    path_pattern {
      values = ["/api/*", "/health", "/api/v1/*"]
    }
  }
}

# Optional HTTPS listener and backend rule when enabled and cert provided
resource "aws_lb_listener" "https" {
  count             = var.enable_https && var.certificate_arn != null ? 1 : 0
  load_balancer_arn = aws_lb.this.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-2016-08"
  certificate_arn   = var.certificate_arn
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.frontend.arn
  }
}

resource "aws_lb_listener_rule" "backend_https" {
  count        = var.enable_https && var.certificate_arn != null ? 1 : 0
  listener_arn = aws_lb_listener.https[0].arn
  priority     = 10
  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.backend.arn
  }
  condition {
    path_pattern {
      values = ["/api/*", "/health", "/api/v1/*"]
    }
  }
}

output "http_listener_arn" { value = aws_lb_listener.http.arn }
output "backend_tg_arn" { value = aws_lb_target_group.backend.arn }
output "frontend_tg_arn" { value = aws_lb_target_group.frontend.arn }
output "alb_dns" { value = aws_lb.this.dns_name }
output "alb_sg_id" { value = aws_security_group.alb.id }
output "https_listener_arn" { value = try(aws_lb_listener.https[0].arn, null) }
