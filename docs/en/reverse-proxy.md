# Reverse proxy

openbill speaks plain HTTP on port `7739` of the host. Your reverse proxy forwards to it: `127.0.0.1:7739` from the same host, `<server>:7739` from a container (Nginx Proxy Manager) or another machine. HTTPS comes from a reverse proxy in front of it. Set `APP_URL` in `.env` to the public `https://` address.

## What openbill trusts

- **Forwarded headers** (`X-Forwarded-For`, `-Proto`, `-Host`, `-Port`) only from the addresses in `TRUSTED_PROXIES`: IP addresses or networks in CIDR notation, comma-separated – no host names (a Docker service name like `traefik` matches nothing, and the headers are silently ignored). Default: `127.0.0.1`, `::1`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `fc00::/7` – a proxy on the same host, in the same Docker network or in your LAN is covered. `X-Forwarded-Prefix` is never believed: openbill runs at the root of its own host name, not under a path like `/openbill`.
- **Host**: only the host of `APP_URL`. Any other `Host` header answers `400 Bad Request`. Your proxy must pass the original host (all examples below do).

The port is published on all addresses of the host (`OPENBILL_BIND=0.0.0.0`), so a proxy in a container or on another machine reaches it without extra setup. Anyone who reaches port `7739` from a trusted address can set these headers themselves: fake `https`, or a new IP address on every login attempt (the login lock counts per IP). Docker usually keeps the real address of requests from outside, but some setups (rootless Docker, the userland proxy) hand them over with the address of the Docker gateway (`172.x.0.1`), which is in the default list. To close that gap:

- **Proxy on the same host, not in a container** (Caddy, nginx): set `OPENBILL_BIND=127.0.0.1` (standalone file: `"127.0.0.1:7739:8080"`). The port isn't reachable from other machines.
- **Proxy in a container or on another host**: set `TRUSTED_PROXIES` to the proxy's address only (e.g. `TRUSTED_PROXIES=192.168.1.10`) or block port `7739` from the internet in the firewall of your hoster (Docker bypasses ufw/firewalld for published ports).
- **Proxy in the same Docker network** (Traefik, Caddy in Compose): it talks to `openbill:8080` directly; the published port isn't needed at all.

If your proxy reaches openbill from an address outside `TRUSTED_PROXIES`, openbill ignores its headers: links and assets come out as `http://` (browsers block them as mixed content), and every user shares the proxy's IP – the login lock after failed attempts then hits everyone at once.

## Caddy

```txt
invoices.example.com {
    reverse_proxy localhost:7739
}
```

If Caddy runs in the same Compose project, use `reverse_proxy openbill:8080`. Caddy gets the certificate on its own and doesn't limit the body size.

## Traefik

Traefik and openbill need a shared Docker network (here the external network `proxy` of your Traefik). Put this into `docker-compose.override.yml` next to `docker-compose.yml`:

```yaml
services:
  openbill:
    # Traefik is the only way in: no published port
    ports: !reset []
    networks:
      - default
      - backend
      - proxy
    labels:
      - traefik.enable=true
      # openbill is in three networks: tell Traefik which one it shares with openbill
      - traefik.docker.network=proxy
      - traefik.http.routers.openbill.rule=Host(`invoices.example.com`)
      - traefik.http.routers.openbill.entrypoints=websecure
      - traefik.http.routers.openbill.tls.certresolver=letsencrypt
      - traefik.http.services.openbill.loadbalancer.server.port=8080

networks:
  proxy:
    external: true
```

Without `traefik.docker.network` Traefik may pick openbill's address in the internal `backend` network, which it can't reach (502/504). Entrypoint and cert resolver names depend on your Traefik setup. Traefik's address in the `proxy` network is private, so the default `TRUSTED_PROXIES` covers it.

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
2. Scheme `http`, forward to the address of the server (its public or private IP, not `127.0.0.1`: that is the Nginx Proxy Manager container itself), port `7739`. If both share a Docker network (as in the Traefik example), `openbill`, port `8080` works too.
3. SSL tab: request a certificate, enable *Force SSL*.
4. Advanced tab: `client_max_body_size 32m;`

## Checklist

- `APP_URL` starts with `https://` and has exactly the host the browser uses.
- Optional hardening: port `7739` is not reachable from the internet (`OPENBILL_BIND=127.0.0.1` or a firewall), or `TRUSTED_PROXIES` is narrowed to the proxy.
- The page source of `/en/login` shows asset links starting with `https://`. If they start with `http://`, the proxy's address is not in `TRUSTED_PROXIES`.
- Template packages and toolkit pushes carry up to 30 MB: allow at least `client_max_body_size 32m` (nginx); Caddy and Traefik don't limit the body size by default.
- The [template toolkit](/en/template-toolkit) of template authors talks to `APP_URL` from their machine: it must be reachable from there with a valid certificate.
