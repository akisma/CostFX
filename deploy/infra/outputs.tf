output "alb_dns" {
	value = module.alb.alb_dns
}

output "backend_service_name" {
	value = var.create_ecs ? module.ecs[0].backend_service_name : null
}

output "frontend_service_name" {
	value = var.create_ecs ? module.ecs[0].frontend_service_name : null
}

output "database_endpoint" {
	value     = try(module.rds[0].endpoint, null)
	sensitive = true
}

output "alb_sg_id" { value = module.alb.alb_sg_id }
output "http_listener_arn" { value = module.alb.http_listener_arn }
output "https_listener_arn" { value = module.alb.https_listener_arn }
output "ecs_log_group" { value = "/ecs/${var.app_name}-${var.environment}" }
