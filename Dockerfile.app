FROM node:12-alpine as build

RUN apk update && apk upgrade && apk add git make

RUN mkdir /build
WORKDIR /build
COPY . /build

RUN make dist

FROM node:12-alpine

RUN mkdir /app
WORKDIR /app

COPY --from=build /build/package.json /app/package.json
COPY --from=build /build/package-lock.json /app/package-lock.json
COPY --from=build /build/dist /app
RUN npm install --production && mkdir ssh

EXPOSE 2000
EXPOSE 3000

RUN echo "netstat -an | grep 3000" > /health.sh
HEALTHCHECK CMD sh /health.sh

CMD ["node", "src"]
