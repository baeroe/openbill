# Reverse Proxy

openbill spricht einfaches HTTP auf Port `7739`. HTTPS kommt von einem Reverse Proxy davor. Setze `APP_URL` in `.env` auf die öffentliche `https://`-Adresse.

## Wem openbill glaubt

- **Weitergeleitete Header** (`X-Forwarded-For`, `-Proto`, `-Host`, `-Port`) nur aus diesen Netzen: `127.0.0.1`, `::1`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `fc00::/7`. Ein Proxy auf demselben Host, im selben Docker-Netz oder in deinem LAN ist damit abgedeckt. Anfragen direkt aus dem Internet können weder `https` noch ihre IP-Adresse vortäuschen.
- **Host**: nur der Host aus `APP_URL`. Jeder andere `Host`-Header bekommt `400 Bad Request`. Dein Proxy muss den ursprünglichen Host weiterreichen (alle Beispiele unten tun das).

Erreicht dein Proxy openbill von einer öffentlichen IP-Adresse, ignoriert openbill seine Header: Links und Assets kommen als `http://` heraus (Browser blockieren sie als Mixed Content), und alle Nutzer teilen sich die IP des Proxys – die Login-Sperre nach Fehlversuchen trifft dann alle gleichzeitig. Bring den Proxy stattdessen mit openbill in ein privates Netz.

Läuft der Proxy auf demselben Host, veröffentliche den Port nur auf localhost: `OPENBILL_PORT=127.0.0.1:7739` in `.env`.

## Caddy

```txt
invoices.example.com {
    reverse_proxy localhost:7739
}
```

Läuft Caddy im selben Compose-Projekt, nimm `reverse_proxy openbill:8080`. Caddy holt das Zertifikat selbst und begrenzt die Body-Größe nicht.

## Traefik

Labels am Dienst `openbill`; Traefik und openbill brauchen ein gemeinsames Docker-Netz:

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

Namen von Entrypoint und Cert-Resolver hängen von deinem Traefik ab. Ohne `ports` ist openbill nur über Traefik erreichbar.

## nginx

```nginx
server {
    listen 443 ssl;
    server_name invoices.example.com;
    # Template-Pakete und Toolkit-Pushes sind bis zu 30 MB groß
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

1. Proxy-Host für `invoices.example.com` anlegen.
2. Schema `http`, Ziel Docker-Host und Port `7739` (oder `openbill`, Port `8080`, wenn beide ein Docker-Netz teilen).
3. Reiter SSL: Zertifikat anfordern, *Force SSL* einschalten.
4. Reiter Advanced: `client_max_body_size 32m;`

## Checkliste

- `APP_URL` beginnt mit `https://` und hat genau den Host, den der Browser benutzt.
- Der Quelltext von `/de/login` zeigt Asset-Links mit `https://`. Stehen dort `http://`-Links, liegt der Proxy in keinem der vertrauten Netze oben.
- Template-Pakete und Toolkit-Pushes sind bis zu 30 MB groß: mindestens `client_max_body_size 32m` erlauben (nginx); Caddy und Traefik begrenzen die Body-Größe standardmäßig nicht.
- Das [Template-Toolkit](/de/template-toolkit) der Template-Autoren spricht von deren Rechner aus mit `APP_URL`: Die Adresse muss dort mit gültigem Zertifikat erreichbar sein.
