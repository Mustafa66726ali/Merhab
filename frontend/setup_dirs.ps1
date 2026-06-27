# Create directory structure
$dirs = @(
    "src/components",
    "src/lib",
    "src/app/events",
    "src/app/guests",
    "src/app/tables",
    "src/app/sections",
    "src/app/schedule",
    "src/app/groups",
    "src/app/staff",
    "src/app/messages",
    "src/app/invitations",
    "src/app/users",
    "src/app/reports",
    "src/app/settings",
    "src/app/login",
    "public"
)
foreach ($d in $dirs) {
    New-Item -ItemType Directory -Path "d:\Merhab\frontend\$d" -Force | Out-Null
}

Write-Host "Directories created."
