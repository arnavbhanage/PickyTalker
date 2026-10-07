from __future__ import annotations

import re
from urllib.parse import urlsplit


LOCAL_ORIGINS = ("http://localhost:3000", "http://127.0.0.1:3000")
_HOSTNAME = re.compile(r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*")
_ERROR = "PICKYTALKER_CORS_ORIGINS must contain exact HTTPS origins (HTTP is allowed only for localhost/127.0.0.1), without wildcards, credentials, paths, queries or fragments."


def allowed_origins(configured: str | None) -> list[str]:
    """Add explicitly configured deployment origins to the two local defaults."""
    origins = list(LOCAL_ORIGINS)
    for entry in (configured or "").split(","):
        origin = entry.strip()
        if not origin:
            continue
        try:
            url = urlsplit(origin)
            host, port = url.hostname, url.port
            if (
                any(character.isspace() for character in origin)
                or any(character in origin for character in "*\\?#")
                or not host or not _HOSTNAME.fullmatch(host) or len(host) > 253
                or url.username is not None or url.password is not None
                or url.path not in {"", "/"}
                or url.scheme not in {"http", "https"}
                or (url.scheme == "http" and host not in {"localhost", "127.0.0.1"})
                or (port is not None and port < 1)
            ):
                raise ValueError(_ERROR)
        except ValueError:
            raise ValueError(_ERROR) from None
        suffix = f":{port}" if port is not None and port != (443 if url.scheme == "https" else 80) else ""
        canonical = f"{url.scheme}://{host}{suffix}"
        if canonical not in origins:
            origins.append(canonical)
    return origins
