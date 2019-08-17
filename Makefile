include .env
export

private:
	yes | ssh-keygen -t rsa -f private/ssh_host_rsa_key -q -N ""
	yes | ssh-keygen -t ecdsa -f private/ssh_host_ecdsa_key -q -N ""

development:
	npx tsnd --clear -r dotenv/config -- src/index.ts

development-tunnel:
	until ssh -p 2000 -TR 443:localhost:8080 localhost; do sleep 0.5; done

build: private node_modules
	npx tsc

certs: $(HOME)/.aws/credentials
	bash scripts/letsencrypt.sh

start: build
	cat server/server.yml | docker stack deploy $(STACK_NAME) -c -

stop:
	docker stack rm $(STACK_NAME)

logs:
	docker service logs tunnelvision-me_tunnelvision --follow --raw

node_modules:
	npm install

$(HOME)/.aws/credentials:
	@echo No AWS credentials found for requesting LetsEncrypt TLS certificate
	test -r $(HOME)/.aws/credentials
	
