$base = "d:\Merhab\frontend\src"

# ========== app/globals.css ==========
@'
@tailwind base;
@tailwind components;
@tailwind utilities;

@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&family=Noto+Sans+Arabic:wght@400;500;600;700;800&display=swap');

html { direction: rtl; }
body {
  font-family: 'Inter', 'Noto Sans Arabic', sans-serif;
  background-color: #12121d;
  color: #e3e0f1;
  min-height: 100vh;
  overflow-x: hidden;
}
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: #1f1e2a; }
::-webkit-scrollbar-thumb { background: #474557; border-radius: 3px; }
.material-symbols-outlined {
  font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
  vertical-align: middle;
}
'@ | Out-File -FilePath "$base\app\globals.css" -Encoding UTF8

Write-Host "globals.css done"
