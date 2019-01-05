FROM node:alpine as ssh-keys 
RUN apk update && \
    apk add --no-cache \
    openssh-keygen && \
    mkdir -p /etc/ssh && \
    ssh-keygen -A

FROM node:alpine
ARG COMMIT=N/A
ARG DOMAIN=localhost
ARG NODE_ENV=development

# Helps keeping the SSH immutable
COPY --from=ssh-keys /etc/ssh /etc/ssh

# Environment
ENV FORCE_COLOR 1
ENV APP_HOME /var/app/
ENV PROXY_PORT 3000
ENV SSH_PORT 2222
ENV HTTP_PORT 8080
ENV MAX_CONNECTIONS 50
ENV DOMAIN $DOMAIN
ENV COMMIT $COMMIT

RUN addgroup -S app && adduser -S -G app app
RUN chown app:app /etc/ssh/ssh_host_ecdsa_key /etc/ssh/ssh_host_rsa_key
RUN mkdir -p $APP_HOME/dist
ADD src $APP_HOME/src
ADD public $APP_HOME/dist/public
ADD package.json $APP_HOME/
ADD package-lock.json $APP_HOME/
ADD tsconfig.json $APP_HOME
RUN chown -R app:app $APP_HOME
USER app

WORKDIR $APP_HOME
RUN npm --version && node --version
RUN NODE_ENV= npm install
RUN npx tsc --version && npx tsc && rm -rf src
RUN test $NODE_ENV = production && npm prune --production || true

EXPOSE $SSH_PORT
EXPOSE $PROXY_PORT
EXPOSE $HTTP_PORT
ENV NODE_ENV $NODE_ENV

CMD [ "node", "dist/src/index.js" ]
