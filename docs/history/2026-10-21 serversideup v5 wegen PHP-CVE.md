# 2026-10-21 – serversideup v5 wegen PHP-CVE

## Warum jetzt doch v5

Am 12.10. fiel die Wahl bewusst auf `serversideup/php` v4.5.1 statt der damals vier Tage alten v5 (siehe `2026-10-12 Ausprojektierung openbill.md`). Am 21.10. kam die PHP-Core-RCE CVE-2026-109618 / CVE-2026-109619 (gefixt in PHP 8.4.27). Die v4-Reihe bekommt kein neues PHP mehr: Der Tag `v4.5.1` ist eingefroren (PHP 8.4.23), danach gab es nur noch die Betas `v4.6.0-beta1/2`. Ein gepatchtes PHP gibt es nur noch mit v5. Deshalb: Umstieg auf `serversideup/php:8.4.27-fpm-nginx-v5.0.2`, gepinnt per Digest. v5 bringt seit 5.0.1 außerdem nginx 1.30.6 mit, der fünf nginx-CVEs behebt; die hat v4.5.1 ebenfalls nicht.

## Breaking Changes v4 → v5 und was openbill davon betrifft

- **`TRUSTED_PROXY` (neu, Standard `cloudflare`)**: nginx übernimmt die Client-IP aus weitergeleiteten Headern von Cloudflare-IPs **und von privaten Netzen** (`10/8`, `172.16/12`, `192.168/16`, `127/8`). Damit würde `REMOTE_ADDR` an Laravels `TRUSTED_PROXIES` vorbei umgeschrieben. Folge: Wer den Port aus dem Docker-Gateway erreicht, könnte die IP fälschen (Login-Sperre je IP), und Laravel würde dem echten Proxy `X-Forwarded-Proto` nicht mehr glauben. Lösung: `TRUSTED_PROXY=off` im `Dockerfile`. Über Proxys entscheidet weiter nur `TRUSTED_PROXIES`.
- **OPcache ohne Zeitstempel-Prüfung** (`PHP_OPCACHE_VALIDATE_TIMESTAMPS=0`, mehr Speicher): unkritisch. Der Code liegt im Image, und der Entrypoint führt `optimize` aus, bevor PHP-FPM startet.
- **`PHP_SESSION_COOKIE_HTTPONLY=On`**: Laravel setzt seine Cookies selbst, also keine Auswirkung.
- **S6: `dependencies.d/` und `user-bundles.d/`**: openbill legt keine eigenen S6-Dienste an, also keine Auswirkung.
- **FrankenPHP/Caddy/Octane-Änderungen**: betreffen nur die Variante `frankenphp`, nicht `fpm-nginx`.
- **Unverändert geprüft**: Ablauf von `/etc/entrypoint.d/*.sh`, `install-php-extensions`, `PHP_MEMORY_LIMIT`/`PHP_POST_MAX_SIZE`/`PHP_UPLOAD_MAX_FILE_SIZE`/`NGINX_CLIENT_MAX_BODY_SIZE`, Port 8080, User `www-data`. Compose-Stack healthy, `/up` antwortet mit 200.

## Merken

- Den Tag mit voller PHP-Version pinnen (`8.4.x-fpm-nginx-v5.y.z`), plus Digest. Ein reiner `8.4-…-v5.y.z`-Tag sagt nicht, welches PHP drin ist.
- Beim nächsten serversideup-Update prüfen, ob `TRUSTED_PROXY=off` noch gilt (`DockerSetupTest`).
