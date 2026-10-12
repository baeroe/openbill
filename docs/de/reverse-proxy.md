# Reverse Proxy

openbill spricht einfaches HTTP auf Port `7739` des Hosts. Dein Reverse Proxy leitet dorthin weiter: `127.0.0.1:7739` vom selben Host, `<server>:7739` aus einem Container (Nginx Proxy Manager) oder von einem anderen Rechner. HTTPS kommt von einem Reverse Proxy davor. Setze `APP_URL` in `.env` auf die öffentliche `https://`-Adresse.

## Wem openbill glaubt

- **Weitergeleitete Header** (`X-Forwarded-For`, `-Proto`, `-Host`, `-Port`) nur von den Adressen in `TRUSTED_PROXIES`: IP-Adressen oder Netze in CIDR-Schreibweise, kommagetrennt – keine Hostnamen (ein Docker-Dienstname wie `traefik` passt auf nichts, die Header werden dann still ignoriert). Standard: `127.0.0.1`, `::1`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `fc00::/7` – ein Proxy auf demselben Host, im selben Docker-Netz oder in deinem LAN ist damit abgedeckt. `X-Forwarded-Prefix` glaubt openbill nie: openbill läuft an der Wurzel seines eigenen Hostnamens, nicht unter einem Pfad wie `/openbill`.
- **Host**: nur der Host aus `APP_URL`. Jeder andere `Host`-Header bekommt `400 Bad Request`. Dein Proxy muss den ursprünglichen Host weiterreichen (alle Beispiele unten tun das).

Der Port ist auf allen Adressen des Hosts veröffentlicht (`OPENBILL_BIND=0.0.0.0`), damit ein Proxy im Container oder auf einem anderen Rechner ihn ohne Zusatzaufwand erreicht. Wer Port `7739` von einer vertrauten Adresse aus erreicht, kann diese Header selbst setzen: `https` vortäuschen oder bei jedem Login-Versuch eine neue IP-Adresse (die Login-Sperre zählt je IP). Docker behält bei Anfragen von außen meist die echte Adresse, manche Setups (rootless Docker, der Userland-Proxy) reichen sie aber mit der Adresse des Docker-Gateways (`172.x.0.1`) weiter, und die steht in der Standardliste. Wer diese Lücke schließen will:

- **Proxy auf demselben Host, nicht im Container** (Caddy, nginx): `OPENBILL_BIND=127.0.0.1` setzen (Standalone-Datei: `"127.0.0.1:7739:8080"`). Von anderen Rechnern ist der Port dann nicht erreichbar.
- **Proxy im Container oder auf einem anderen Host**: `TRUSTED_PROXIES` nur auf die Adresse des Proxys setzen (z. B. `TRUSTED_PROXIES=192.168.1.10`) oder Port `7739` in der Firewall deines Hosters aus dem Internet sperren (Docker umgeht ufw/firewalld bei veröffentlichten Ports).
- **Proxy im selben Docker-Netz** (Traefik, Caddy im Compose): spricht direkt mit `openbill:8080`; den veröffentlichten Port braucht es gar nicht.

Erreicht dein Proxy openbill von einer Adresse außerhalb von `TRUSTED_PROXIES`, ignoriert openbill seine Header: Links und Assets kommen als `http://` heraus (Browser blockieren sie als Mixed Content), und alle Nutzer teilen sich die IP des Proxys – die Login-Sperre nach Fehlversuchen trifft dann alle gleichzeitig.

## Caddy

```txt
invoices.example.com {
    reverse_proxy localhost:7739
}
```

Läuft Caddy im selben Compose-Projekt, nimm `reverse_proxy openbill:8080`. Caddy holt das Zertifikat selbst und begrenzt die Body-Größe nicht.

## Traefik

Traefik und openbill brauchen ein gemeinsames Docker-Netz (hier das externe Netz `proxy` deines Traefik). Schreib das in `docker-compose.override.yml` neben `docker-compose.yml`:

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

Ohne `traefik.docker.network` nimmt Traefik womöglich openbills Adresse im internen Netz `backend`, die es nicht erreicht (502/504). Namen von Entrypoint und Cert-Resolver hängen von deinem Traefik ab. Traefiks Adresse im Netz `proxy` ist privat, die Standardliste `TRUSTED_PROXIES` deckt sie ab.

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
2. Schema `http`, Ziel die Adresse des Servers (öffentliche oder private IP, nicht `127.0.0.1`: das ist der Container von Nginx Proxy Manager selbst), Port `7739`. Teilen beide ein Docker-Netz (wie im Traefik-Beispiel), geht auch `openbill`, Port `8080`.
3. Reiter SSL: Zertifikat anfordern, *Force SSL* einschalten.
4. Reiter Advanced: `client_max_body_size 32m;`

## Checkliste

- `APP_URL` beginnt mit `https://` und hat genau den Host, den der Browser benutzt.
- Optional gehärtet: Port `7739` ist aus dem Internet nicht erreichbar (`OPENBILL_BIND=127.0.0.1` oder Firewall), oder `TRUSTED_PROXIES` ist auf den Proxy eingeschränkt.
- Der Quelltext von `/de/login` zeigt Asset-Links mit `https://`. Stehen dort `http://`-Links, steht die Adresse des Proxys nicht in `TRUSTED_PROXIES`.
- Template-Pakete und Toolkit-Pushes sind bis zu 30 MB groß: mindestens `client_max_body_size 32m` erlauben (nginx); Caddy und Traefik begrenzen die Body-Größe standardmäßig nicht.
- Das [Template-Toolkit](/de/template-toolkit) der Template-Autoren spricht von deren Rechner aus mit `APP_URL`: Die Adresse muss dort mit gültigem Zertifikat erreichbar sein.
