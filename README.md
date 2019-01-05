# Tunnelvision

### Deploying

```sh
npm run deploy
```

### Usage

```sh
# Expose localhost:8080 at https://$USER.tunnel.valuemotive.net
ssh -TR 443:localhost:8080 tunnel.valuemotive.net
```

```sh
# Pick a custom subdomain
ssh -TR 443:localhost:8080 myproject@tunnel.valuemotive.net
```
