FROM node:alpine

ENV APP_HOME /var/app/

RUN apk update && \
    apk add --no-cache \
    openssh-keygen && \
    mkdir -p /etc/ssh && \
    ssh-keygen -A

WORKDIR $APP_HOME

ADD package.json $APP_HOME/
ADD package-lock.json $APP_HOME/
ADD tsconfig.json $APP_HOME

RUN npm install
ADD src $APP_HOME/src
RUN npx tsc && rm -rf src
RUN npm prune --production

EXPOSE 22
EXPOSE 80
EXPOSE 443
CMD [ "node", "dist/index.js" ]
