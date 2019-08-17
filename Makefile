include .env
export

REVISION=$(shell git rev-parse --short HEAD)

development-tunnel:
	until ssh -TR 443:localhost:8080 localhost; do sleep 0.5; done

development: node_modules
	docker-compose -f development.yml up development

production:
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

provision: node_modules
	npx cdk --app 'node infra/cdk' deploy TunnelvisionStack

tunnelvision.zip:
	mkdir tunnelvision-$(REVISION)
	cp -r production.yml server tunnelvision-$(REVISION)
	cp -r tsconfig.json tslint.json package.json package-lock.json src tunnelvision-$(REVISION)
	NODE_ENV= npm install --prefix=tunnelvision-$(REVISION)
	npm run lint --prefix=tunnelvision-$(REVISION)
	npm run build --prefix=tunnelvision-$(REVISION)
	# NB: https://npm.community/t/npm-prune-does-not-respect-prefix-param/8632
	cd tunnelvision-$(REVISION) && npm prune  --production 
	rm -rf tunnelvision-$(REVISION)/{src,tsconfig.json,tslint.json}
	zip -r tunnelvision.zip tunnelvision-$(REVISION)
	rm -rf tunnelvision-$(REVISION)
	unzip -l tunnelvision.zip

release: tunnelvision.zip
	bin/publish.sh

$(HOME)/.aws/credentials:
	@echo No AWS credentials found for requesting LetsEncrypt TLS certificate
	test -r $(HOME)/.aws/credentials
