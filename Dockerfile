FROM node:alpine

ENV APP_HOME /var/app/

WORKDIR $APP_HOME

ADD package.json $APP_HOME/
ADD package-lock.json $APP_HOME/
ADD tsconfig.json $APP_HOME

RUN npm install
ADD src $APP_HOME/src
RUN npx tsc
RUN npm prune --production

RUN adduser app -S -H -D -g app -s /sbin/nologin && chown app -R $APP_HOME
USER app

EXPOSE 22
EXPOSE 443
CMD ["/bin/sh"]
#CMD [ "node", "dist/index.js" ]
