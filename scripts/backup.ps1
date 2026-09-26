<#
    My Kutumbh — a copy of everything, kept somewhere else
    ═══════════════════════════════════════════════════════

    Supabase's free tier keeps no backups. If the project were deleted
    or corrupted, every meal logged and every medical report would be
    gone, and nothing inside the app could help — anything the app
    writes lives in the same place as the thing it is protecting.

    So this runs OUTSIDE the app, on your own machine, and writes into
    OneDrive: off-site the moment it is saved, with Microsoft's own
    version history behind it.

    ── Once, to set up ──────────────────────────────────────────────
    1. Install the Postgres client tools (they include pg_dump):
         winget install PostgreSQL.PostgreSQL.17
    2. Get your connection string:
         Supabase → Project Settings → Database → Connection string → URI
       Take the one marked "Session pooler" if your connection is IPv4.
    3. Put it in an environment variable, so it is never written in a
       file that might be shared or committed:
         setx MY_KUTUMBH_DB_URL "postgresql://postgres.xxxx:PASSWORD@..."
       Close and reopen PowerShell afterwards.
    4. Try it once by hand:
         powershell -File scripts\backup.ps1

    ── Nightly, without thinking about it ───────────────────────────
    Run this once, in PowerShell, from the project folder:

      $action  = New-ScheduledTaskAction -Execute "powershell.exe" `
                   -Argument "-NoProfile -File `"$PWD\scripts\backup.ps1`""
      $trigger = New-ScheduledTaskTrigger -Daily -At 11pm
      Register-ScheduledTask -TaskName "My Kutumbh backup" `
                   -Action $action -Trigger $trigger -Description "Nightly database copy into OneDrive"

    ── What you get ─────────────────────────────────────────────────
    One compressed file per night in OneDrive, a fortnight kept, the
    older ones tidied away. To restore:

      pg_restore --clean --if-exists -d "<connection string>" <file>
#>

$ErrorActionPreference = "Stop"

# ── Where the copies live ──
$folder = Join-Path $env:USERPROFILE "OneDrive\My Kutumbh backups"
if (-not (Test-Path $folder)) { New-Item -ItemType Directory -Path $folder | Out-Null }

# ── The connection, never written down here ──
$url = $env:MY_KUTUMBH_DB_URL
if (-not $url) {
    Write-Error "MY_KUTUMBH_DB_URL is not set. See the notes at the top of this file."
    exit 1
}

# ── pg_dump must be reachable ──
$dump = (Get-Command pg_dump -ErrorAction SilentlyContinue)
if (-not $dump) {
    $guess = Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\pg_dump.exe" -ErrorAction SilentlyContinue |
             Sort-Object FullName -Descending | Select-Object -First 1
    if ($guess) { $dump = $guess } else {
        Write-Error "pg_dump not found. Install it with: winget install PostgreSQL.PostgreSQL.17"
        exit 1
    }
}
$pgDump = if ($dump.Source) { $dump.Source } else { $dump.FullName }

# ── The copy itself ──
$stamp = Get-Date -Format "yyyy-MM-dd_HHmm"
$file  = Join-Path $folder "my-kutumbh_$stamp.dump"

Write-Host "Copying the database into $folder ..."
& $pgDump --format=custom --no-owner --no-privileges --file="$file" "$url"

if ($LASTEXITCODE -ne 0) {
    Write-Error "The copy did not complete. Nothing was deleted; the older copies are untouched."
    exit $LASTEXITCODE
}

$size = [math]::Round((Get-Item $file).Length / 1MB, 1)
Write-Host "Done: $(Split-Path $file -Leaf) ($size MB)"

# ── A fortnight is enough; older ones are tidied away ──
Get-ChildItem $folder -Filter "my-kutumbh_*.dump" |
    Sort-Object LastWriteTime -Descending |
    Select-Object -Skip 14 |
    ForEach-Object {
        Write-Host "Tidying away $($_.Name)"
        Remove-Item $_.FullName -Force
    }

# ── A line in a log, so a silent failure is visible ──
$log = Join-Path $folder "backup-log.txt"
"$(Get-Date -Format 'yyyy-MM-dd HH:mm')  ok  $size MB  $(Split-Path $file -Leaf)" |
    Add-Content -Path $log -Encoding utf8
