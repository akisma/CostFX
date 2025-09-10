APP_NAME=costfx
ENV?=dev
REGION?=us-west-2

bootstrap:
	AWS_REGION=$(REGION) ENV=$(ENV) ./scripts/bootstrap-remote-state.sh

init: bootstrap
	terraform init -reconfigure -backend-config=backend-$(ENV).hcl -input=false

plan-core: init
	terraform plan -var-file=environments/$(ENV)/terraform.tfvars -var create_ecs=false -var backend_image=placeholder -var frontend_image=placeholder

apply-core: init
	terraform apply -auto-approve -var-file=environments/$(ENV)/terraform.tfvars -var create_ecs=false -var backend_image=placeholder -var frontend_image=placeholder

images:
	AWS_ACCOUNT_ID=$$(aws sts get-caller-identity --query Account --output text) \
	GIT_SHA=$$(git rev-parse --short HEAD) AWS_REGION=$(REGION) \
	./scripts/build-push-images.sh $(ENV)

apply-services: init
	terraform apply -auto-approve -var-file=environments/$(ENV)/terraform.tfvars \
	  -var backend_image=$$(cat environments/$(ENV)/.backend_image) \
	  -var frontend_image=$$(cat environments/$(ENV)/.frontend_image)

deploy: apply-core images apply-services

clean-local-state:
	rm -rf .terraform .terraform.lock.hcl terraform.tfstate* || true

.PHONY: bootstrap init plan-core apply-core images apply-services deploy clean-local-state
