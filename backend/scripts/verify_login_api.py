import json
import urllib.error
import urllib.request

from decouple import config

email = config("ADMIN_EMAIL", "admin@merhab.sa").strip().lower()
password = config("ADMIN_PASSWORD", "Merhab@2024")
data = json.dumps({"email": email, "password": password}).encode()
req = urllib.request.Request(
    "http://127.0.0.1:8000/api/v1/auth/login/",
    data=data,
    headers={"Content-Type": "application/json"},
    method="POST",
)
try:
    with urllib.request.urlopen(req, timeout=10) as r:
        body = json.loads(r.read().decode())
        print("LOGIN_OK", r.status, body.get("user", {}).get("role"))
except urllib.error.HTTPError as e:
    print("LOGIN_FAIL", e.code, e.read().decode())
    raise SystemExit(1)
