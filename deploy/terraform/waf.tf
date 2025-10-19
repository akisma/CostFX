# ============================================================================
# AWS WAF v2 WEB APPLICATION FIREWALL
# ============================================================================
# Only deployed when deployment_type = "ecs" (requires ALB)
# ============================================================================

# WAF Web ACL for Application Load Balancer
resource "aws_wafv2_web_acl" "main" {
  count = var.deployment_type == "ecs" ? 1 : 0

  name        = "${var.app_name}-${var.environment}-waf"
  description = "WAF for ${var.app_name} Application Load Balancer"
  scope       = "REGIONAL"

  default_action {
    allow {}
  }

  # AWS Managed Rule - Core Rule Set (OWASP Top 10 protection)
  rule {
    name     = "AWSManagedRulesCommonRuleSet"
    priority = 1

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"

        # Exclude rules that might cause false positives for APIs
        rule_action_override {
          action_to_use {
            allow {}
          }
          name = "SizeRestrictions_BODY"
        }

        rule_action_override {
          action_to_use {
            allow {}
          }
          name = "GenericRFI_BODY"
        }
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "CommonRuleSetMetric"
      sampled_requests_enabled   = true
    }
  }

  # AWS Managed Rule - Known Bad Inputs
  rule {
    name     = "AWSManagedRulesKnownBadInputsRuleSet"
    priority = 2

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesKnownBadInputsRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "KnownBadInputsRuleSetMetric"
      sampled_requests_enabled   = true
    }
  }

  # Rate limiting rule - protect against DDoS and abuse
  rule {
    name     = "RateLimitRule"
    priority = 3

    action {
      block {}
    }

    statement {
      rate_based_statement {
        limit              = 2000 # requests per 5-minute window
        aggregate_key_type = "IP"

        # Optional: scope to specific paths that need more protection
        scope_down_statement {
          or_statement {
            statement {
              byte_match_statement {
                search_string = "/api"
                field_to_match {
                  uri_path {}
                }
                text_transformation {
                  priority = 0
                  type     = "LOWERCASE"
                }
                positional_constraint = "STARTS_WITH"
              }
            }
            statement {
              byte_match_statement {
                search_string = "/login"
                field_to_match {
                  uri_path {}
                }
                text_transformation {
                  priority = 0
                  type     = "LOWERCASE"
                }
                positional_constraint = "CONTAINS"
              }
            }
          }
        }
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "RateLimitRuleMetric"
      sampled_requests_enabled   = true
    }
  }

  # Geo-blocking rule (optional - only for production)
  dynamic "rule" {
    for_each = var.environment == "prod" ? [1] : []
    content {
      name     = "GeoBlockingRule"
      priority = 4

      action {
        block {}
      }

      statement {
        geo_match_statement {
          # Block countries known for high levels of malicious traffic
          # Adjust this list based on your application's needs
          country_codes = ["CN", "RU", "KP"] # China, Russia, North Korea
        }
      }

      visibility_config {
        cloudwatch_metrics_enabled = true
        metric_name                = "GeoBlockingRuleMetric"
        sampled_requests_enabled   = true
      }
    }
  }

  # IP reputation rule - AWS managed rule for IP reputation
  rule {
    name     = "AWSManagedRulesAmazonIpReputationList"
    priority = 5

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesAmazonIpReputationList"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "AmazonIpReputationListMetric"
      sampled_requests_enabled   = true
    }
  }

  # SQL injection protection rule
  rule {
    name     = "AWSManagedRulesSQLiRuleSet"
    priority = 6

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesSQLiRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "SQLiRuleSetMetric"
      sampled_requests_enabled   = true
    }
  }

  tags = {
    Name        = "${var.app_name}-${var.environment}-waf"
    Environment = var.environment
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "${var.app_name}-${var.environment}-waf"
    sampled_requests_enabled   = true
  }
}

# Associate WAF with ALB
resource "aws_wafv2_web_acl_association" "main" {
  count = var.deployment_type == "ecs" ? 1 : 0

  resource_arn = aws_lb.main[count.index].arn
  web_acl_arn  = aws_wafv2_web_acl.main[count.index].arn
}

# CloudWatch Log Group for WAF logs (for future use)
resource "aws_cloudwatch_log_group" "waf_logs" {
  count = var.deployment_type == "ecs" ? 1 : 0

  name              = "/aws/wafv2/${var.app_name}-${var.environment}"
  retention_in_days = var.environment == "prod" ? 30 : 14

  tags = {
    Name        = "${var.app_name}-${var.environment}-waf-logs"
    Environment = var.environment
  }
}

# NOTE: WAF Logging Configuration disabled due to ARN format requirements
# Can be enabled later once CloudWatch destination format is resolved

# CloudWatch Alarms for WAF
resource "aws_cloudwatch_metric_alarm" "waf_blocked_requests" {
  count = var.deployment_type == "ecs" ? 1 : 0

  alarm_name          = "${var.app_name}-${var.environment}-waf-blocked-requests"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "BlockedRequests"
  namespace           = "AWS/WAFV2"
  period              = "300"
  statistic           = "Sum"
  threshold           = "100"
  alarm_description   = "This metric monitors WAF blocked requests - triggers when >100 requests blocked in 5 minutes"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]
  treat_missing_data  = "notBreaching"

  dimensions = {
    WebACL = aws_wafv2_web_acl.main[count.index].name
    Region = var.aws_region
    Rule   = "ALL"
  }

  tags = {
    Name        = "${var.app_name}-${var.environment}-waf-blocked-requests-alarm"
    Environment = var.environment
  }
}

resource "aws_cloudwatch_metric_alarm" "waf_rate_limit_triggered" {
  count = var.deployment_type == "ecs" ? 1 : 0

  alarm_name          = "${var.app_name}-${var.environment}-waf-rate-limit"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "BlockedRequests"
  namespace           = "AWS/WAFV2"
  period              = "300"
  statistic           = "Sum"
  threshold           = "50"
  alarm_description   = "This metric monitors WAF rate limiting - triggers when rate limit blocks >50 requests"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]
  treat_missing_data  = "notBreaching"

  dimensions = {
    WebACL = aws_wafv2_web_acl.main[count.index].name
    Region = var.aws_region
    Rule   = "RateLimitRule"
  }

  tags = {
    Name        = "${var.app_name}-${var.environment}-waf-rate-limit-alarm"
    Environment = var.environment
  }
}
