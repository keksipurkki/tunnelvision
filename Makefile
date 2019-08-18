include .env
export

REVISION=$(shell git rev-parse --short HEAD)
BUILD_DIR=tunnelvision-$(REVISION)
BUILD_FILES=server production.yml tsconfig.json tslint.json package.json package-lock.json src

development-tunnel:
	until ssh -TR 443:localhost:8080 localhost; do sleep 0.5; done

development: node_modules
	docker stack deploy $(STACK_NAME) -c development.yml
	docker service logs $(STACK_NAME)_development --raw --follow

production: $(BUILD_DIR)
	cp .env $(BUILD_DIR)
	cd $(BUILD_DIR) && docker stack deploy $(STACK_NAME) -c production.yml
	docker service logs $(STACK_NAME)_tunnelvision --raw --follow

rm:
	docker stack rm $(STACK_NAME)

node_modules:
	NODE_ENV= npm install

provision: node_modules
	npx cdk --app 'node infra/cdk' deploy TunnelvisionStack

clean-state:
	test -z "$(shell git status --porcelain 2> /dev/null)"
	test $(shell git rev-parse --abbrev-ref HEAD) = master

tunnelvision.zip: $(BUILD_DIR)
	rm -f tunnelvision.zip
	zip -r tunnelvision.zip $(BUILD_DIR)
	rm -rf $(BUILD_DIR)
	unzip -l tunnelvision.zip

$(BUILD_DIR):
	mkdir $(BUILD_DIR)
	cp -r $(BUILD_FILES) $(BUILD_DIR)
	NODE_ENV= npm install --prefix=$(BUILD_DIR)
	npm run release --prefix=$(BUILD_DIR)
	# NB: https://npm.community/t/npm-prune-does-not-respect-prefix-param/8632
	cd $(BUILD_DIR) && npm prune --production
	rm -rf $(BUILD_DIR)/{src,tsconfig.json,tslint.json}
	rm -rf $(BUILD_DIR)/node_modules/*/test

release: clean-state tunnelvision.zip
	bash github.sh

clean:
	rm -rf cdk.out cdk.context.json tunnelvision.zip $(BUILD_DIR)

extra-clean: clean
	rm -rf node_modules

$(HOME)/.aws/credentials:
	@echo No AWS credentials found for requesting LetsEncrypt TLS certificate
	test -r $(HOME)/.aws/credentials
