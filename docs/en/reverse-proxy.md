# Reverse proxy

openbill speaks plain HTTP on port `7739`. HTTPS comes from a reverse proxy in front of it. Set `APP_URL` in `.env` to the public `https://` address.

## What openbill trusts

- **Forwarded headers** (`X-Forwarded-For`, `-Proto`, `-Host`, `-Port`) only from these networks: `127.0.0.1`, `::1`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `fc00::/7`. A proxy on the same host, in the same Docker network or in your LAN is covered. Requests straight from the internet can't fake `https` or their IP address.
- **Host**: only the host of `APP_URL`. Any other `Host` header answers `400 Bad Request`. Your proxy must pass the original host (all examples below do).

If your proxy reaches openbill from a public IP address, openbill ignores its headers: links and assets come out as `http://` (browsers block them as mixed content), and every user shares the proxy's IP – the login lock after failed attempts then hits everyone at once. Put the proxy into a private network with openbill instead.

With the proxy on the same host, publish the port on localhost only: `OPENBILL_PORT=127.0.0.1:7739` in `.env`.

## Caddy

```txt
invoices.example.com {
    reverse_proxy localhost:7739
}
```

If Caddy runs in the same Compose project, use `reverse_proxy openbill:8080`. Caddy gets the certificate on its own and doesn't limit the body size.

## Traefik

Labels on the `openbill` service; Traefik and openbill need a shared Docker network:

```yaml
services:
  openbill:
    labels:
      - traefik.enable=true
      - traefik.http.routers.openbill.rule=Host(`invoices.example.com`)
      - traefik.http.routers.openbill.entrypoints=websecure
      - traefik.http.routers.openbill.tls.certresolver=letsencrypt
      - traefik.http.services.openbill.loadbalancer.server.port=8080
```

Entrypoint and cert resolver names depend on your Traefik setup. Without `ports` openbill is reachable through Traefik only.

## nginx

```nginx
server {
    listen 443 ssl;
    server_name invoices.example.com;
    # template packages and toolkit pushes carry up to 30 MB
    client_max_body_size 32m;

    location / {
        proxy_pass http://127.0.0.1:7739;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Port $server_port;
    }
}
```

## Nginx Proxy Manager

1. Add a proxy host for `invoices.example.com`.
2. Scheme `http`, forward to the Docker host and port `7739` (or to `openbill`, port `8080`, if both share a Docker network).
3. SSL tab: request a certificate, enable *Force SSL*.
4. Advanced tab: `client_max_body_size 32m;`

## Checklist

- `APP_URL` starts with `https://` and has exactly the host the browser uses.
- The page source of `/en/login` shows asset links starting with `https://`. If they start with `http://`, the proxy is not in one of the trusted networks above.
- Template packages and toolkit pushes carry up to 30 MB: allow at least `client_max_body_size 32m` (nginx); Caddy and Traefik don't limit the body size by default.
- The [template toolkit](/en/template-toolkit) of template authors talks to `APP_URL` from their machine: it must be reachable from there with a valid certificate.
