module "ssm" {
  source          = "./modules/ssm"
  app_name        = var.app_name
  environment     = var.environment
  path_prefix     = local.ssm_path_prefix
  database_url    = var.create_rds ? module.rds[0].database_url : "postgresql://placeholder" 
  openai_api_key_placeholder = var.openai_api_key_placeholder
}
