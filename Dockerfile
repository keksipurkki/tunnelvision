FROM node:alpine

ENV FORCE_COLOR 1
ENV APP_HOME /var/app/

# Ports
ENV PROXY_PORT 3000
ENV SSH_PORT 2222
ENV HTTP_PORT 8080

RUN apk update && \
    apk add --no-cache \
    openssh-keygen && \
    mkdir -p /etc/ssh && \
    ssh-keygen -A

RUN addgroup -S tunnelvision && adduser -S -G tunnelvision tunnelvision
RUN chown tunnelvision:tunnelvision /etc/ssh/ssh_host_ecdsa_key /etc/ssh/ssh_host_rsa_key
RUN mkdir -p $APP_HOME
ADD public $APP_HOME/public
ADD src $APP_HOME/src
RUN chown -R tunnelvision:tunnelvision $APP_HOME
USER tunnelvision

WORKDIR $APP_HOME

ADD package.json $APP_HOME/
ADD package-lock.json $APP_HOME/
ADD tsconfig.json $APP_HOME

RUN npm install
RUN npx tsc --version && npx tsc && rm -rf src && mv public dist

ARG COMMIT=N/A
ARG DOMAIN=tunnel.valuemotive.net
ENV DOMAIN=$DOMAIN
ARG NODE_ENV=production
ENV NODE_ENV=$NODE_ENV
ENV COMMIT=$COMMIT
RUN test $NODE_ENV = production && npm prune --production || true

EXPOSE $SSH_PORT
EXPOSE $PROXY_PORT
EXPOSE $HTTP_PORT

CMD [ "node", "dist/src/index.js" ]
