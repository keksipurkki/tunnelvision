include .env
export

development-tunnel:
	until ssh -TR 443:localhost:8080 localhost; do sleep 0.5; done

development: node_modules
	docker-compose -f development.yml up development

start:
	rm -rf node_modules
	NODE_ENV= npm install
	npx tsc --version && npx tsc
	NODE_ENV=production npm prune --production
	docker stack deploy $(STACK_NAME) -c production.yml

stop:
	docker stack rm $(STACK_NAME)

logs:
	docker service logs tunnelvision-me_tunnelvision --follow --raw

node_modules:
	NODE_ENV= npm install

$(HOME)/.aws/credentials:
	@echo No AWS credentials found for requesting LetsEncrypt TLS certificate
	test -r $(HOME)/.aws/credentials
