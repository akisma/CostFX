# ============================================================================
# ACM CERTIFICATE DATA SOURCE
# ============================================================================

# Look up the SSL certificate dynamically by domain name
data "aws_acm_certificate" "app_cert" {
  count = var.domain_name != "" && var.domain_name != "your-new-domain.com" ? 1 : 0

  domain      = var.domain_name
  statuses    = ["ISSUED", "PENDING_VALIDATION"] # Include pending certificates
  most_recent = true

  # Ensure we're looking in the correct region for ALB certificates
  # ALB requires certificates to be in the same region as the load balancer
}

# Fallback certificate ARN for when domain_name is not properly configured
# This maintains backwards compatibility during the transition
locals {
  certificate_arn = length(data.aws_acm_certificate.app_cert) > 0 ? data.aws_acm_certificate.app_cert[0].arn : "arn:aws:acm:us-west-2:568530517605:certificate/e95f67f5-3353-4933-847c-801e3c1dc0f2"
}
