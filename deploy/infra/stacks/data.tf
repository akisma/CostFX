module "rds" {
  source        = "./modules/rds"
  count         = var.create_rds ? 1 : 0
  app_name      = var.app_name
  environment   = var.environment
  vpc_id        = module.network.vpc_id
  subnet_ids    = module.network.public_subnet_ids # public for dev; move to private later
  multi_az      = var.multi_az_db
}
