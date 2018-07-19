# Tunnelvision

Create Fargate cluster & service

```
# Containers are HTTP, load balancers are HTTPS
fargate service create tunnelvision --region eu-west-1
```

Deploy

```sh
npm run deploy
```

Start the tunnel

```sh
# Expose localhost:8080 at https://localhost.automaton.fi
ssh -RT 443:localhost:8080 tunnel.automaton.fi
```
