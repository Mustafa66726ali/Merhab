"""
Merhab Frontend Generator v2
Writes all files using base64-encoded content to avoid escaping issues.
"""
import os, base64, json

BASE = r"d:\Merhab\frontend\src"
MANIFEST = r"d:\Merhab\frontend\manifest.json"

def main():
    if not os.path.exists(MANIFEST):
        print(f"ERROR: {MANIFEST} not found!")
        return
    with open(MANIFEST, "r", encoding="utf-8") as f:
        files = json.load(f)
    for path, b64 in files.items():
        full = os.path.join(BASE, path)
        os.makedirs(os.path.dirname(full), exist_ok=True)
        content = base64.b64decode(b64).decode("utf-8")
        with open(full, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"  OK: {path}")
    print(f"\nDone! {len(files)} files created.")

if __name__ == "__main__":
    main()
