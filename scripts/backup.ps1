<#
    My Kutumbh - the nightly copy
    ═════════════════════════════

    A thin wrapper. The work is in scripts/backup.mjs, which needs
    nothing but Node - no Postgres install, no 391 MB download that
    EDB's server refuses half way through.

    This script has two jobs, both learnt the hard way on the first
    night it ran by itself:

    1. NOTHING EXITS SILENTLY. The first run failed at 3.11am with exit
       code 1 and left no trace at all, because the checks that run
       before the copy exited without writing anything. A backup that
       can fail without saying so is not a backup; it is a belief.
       Every path out of here now writes a line.

    2. IT TRIES AGAIN. The task fires at 11pm, but a sleeping machine
       runs it whenever it next wakes - and a laptop two seconds into
       waking has no network yet. One refusal is not a failure.

    ── To run by hand ───────────────────────────────────────────────
      powershell -File scripts\backup.ps1

    ── To run every night at 11pm ───────────────────────────────────
    Once, in PowerShell, from the project folder:

      $action  = New-ScheduledTaskAction -Execute "powershell.exe" `
                   -Argument "-NoProfile -WindowStyle Hidden -File `"$PWD\scripts\backup.ps1`"" `
                   -WorkingDirectory "$PWD"
      $trigger = New-ScheduledTaskTrigger -Daily -At 11pm
      $set     = New-ScheduledTaskSettingsSet -WakeToRun -StartWhenAvailable `
                   -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 10) `
                   -DontStopIfGoingOnBatteries -AllowStartIfOnBatteries
      Register-ScheduledTask -TaskName "My Kutumbh backup" -Action $action -Trigger $trigger `
                   -Settings $set -Description "Nightly copy of the database into OneDrive"

    To stop it later:  Unregister-ScheduledTask -TaskName "My Kutumbh backup"
    To see it:         Get-ScheduledTaskInfo -TaskName "My Kutumbh backup"
#>

$ErrorActionPreference = "Stop"

# The log lives beside the copies, so a missing night is visible where
# the nights are kept
$folder = if ($env:MY_KUTUMBH_BACKUP_DIR) { $env:MY_KUTUMBH_BACKUP_DIR }
          else { Join-Path $env:USERPROFILE "OneDrive\My Kutumbh backups" }

function Write-Line([string]$text) {
    try {
        if (-not (Test-Path $folder)) { New-Item -ItemType Directory -Path $folder -Force | Out-Null }
        "$(Get-Date -Format 'yyyy-MM-dd HH:mm')  $text" |
            Add-Content -Path (Join-Path $folder "backup-log.txt") -Encoding utf8
    } catch {
        # If even the log cannot be written there is nothing further to
        # do here; the console message below is all that remains.
        Write-Host "Could not write to the log: $($_.Exception.Message)"
    }
}

# A scheduled task starts with no user environment, so ask Windows directly
if (-not $env:MY_KUTUMBH_DB_URL) {
    $env:MY_KUTUMBH_DB_URL = [Environment]::GetEnvironmentVariable("MY_KUTUMBH_DB_URL", "User")
}

if (-not $env:MY_KUTUMBH_DB_URL) {
    Write-Line "FAILED  the connection string is not set for this user (MY_KUTUMBH_DB_URL)"
    Write-Host "MY_KUTUMBH_DB_URL is not set. See the notes at the top of scripts/backup.mjs."
    exit 1
}

# Run from the project folder whichever way this was started
Set-Location (Split-Path $PSScriptRoot -Parent)

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Line "FAILED  node was not found on the PATH"
    Write-Host "node is not on the PATH for this session."
    exit 1
}

# Three goes, ten minutes apart. A laptop that has just woken often has
# no network for a minute or two, and that is not worth losing a night over.
$attempts = 3
$wait = if ($env:MY_KUTUMBH_RETRY_SECONDS) { [int]$env:MY_KUTUMBH_RETRY_SECONDS } else { 600 }
$code = 1

for ($try = 1; $try -le $attempts; $try++) {
    node "scripts/backup.mjs"
    $code = $LASTEXITCODE

    if ($code -eq 0) { break }

    if ($try -lt $attempts) {
        Write-Line "retry   attempt $try gave exit code $code - waiting $([math]::Round($wait / 60)) minutes"
        Start-Sleep -Seconds $wait
    } else {
        Write-Line "FAILED  $attempts attempts, last exit code $code - see the message above this line"
    }
}

exit $code
