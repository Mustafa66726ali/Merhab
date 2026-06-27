import json
import urllib.error
import urllib.request

# Simulates browser login with exact UI defaults
payload = {"email": "admin@merhab.sa", "password": "Merhab@2024"}
data = json.dumps(payload).encode()
req = urllib.request.Request(
    "http://127.0.0.1:8000/api/v1/auth/login/",
    data=data,
    headers={"Content-Type": "application/json"},
    method="POST",
)
try:
    with urllib.request.urlopen(req, timeout=10) as r:
        print("BROWSER_SIM_OK", r.status)
except urllib.error.HTTPError as e:
    print("BROWSER_SIM_FAIL", e.code, e.read().decode())
