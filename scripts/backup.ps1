<#
    My Kutumbh — the nightly copy
    ═════════════════════════════

    A thin wrapper. The work is in scripts/backup.mjs, which needs
    nothing but Node — no Postgres install, no 391 MB download that
    EDB's server refuses half way through.

    Its one job here is to fetch the connection string from the
    Windows user environment, because a scheduled task starts without
    one, and to record loudly if the copy fails.

    ── To run by hand ───────────────────────────────────────────────
      powershell -File scripts\backup.ps1

    ── To run every night at 11pm ───────────────────────────────────
    Once, in PowerShell, from the project folder:

      $action  = New-ScheduledTaskAction -Execute "powershell.exe" `
                   -Argument "-NoProfile -WindowStyle Hidden -File `"$PWD\scripts\backup.ps1`"" `
                   -WorkingDirectory "$PWD"
      $trigger = New-ScheduledTaskTrigger -Daily -At 11pm
      Register-ScheduledTask -TaskName "My Kutumbh backup" -Action $action -Trigger $trigger `
                   -Description "Nightly copy of the database into OneDrive"

    To stop it later:  Unregister-ScheduledTask -TaskName "My Kutumbh backup"
    To see it:         Get-ScheduledTaskInfo -TaskName "My Kutumbh backup"
#>

$ErrorActionPreference = "Stop"

# A scheduled task starts with no user environment, so ask Windows directly
if (-not $env:MY_KUTUMBH_DB_URL) {
    $env:MY_KUTUMBH_DB_URL = [Environment]::GetEnvironmentVariable("MY_KUTUMBH_DB_URL", "User")
}

if (-not $env:MY_KUTUMBH_DB_URL) {
    Write-Error "MY_KUTUMBH_DB_URL is not set for this user. See scripts/backup.mjs for how to set it."
    exit 1
}

# Run from the project folder whichever way this was started
Set-Location (Split-Path $PSScriptRoot -Parent)

node "scripts/backup.mjs"
$code = $LASTEXITCODE

if ($code -ne 0) {
    # A silent failure at 11pm is how backups quietly stop existing.
    # The script itself writes the reason into backup-log.txt.
    Write-Error "The nightly copy failed. See backup-log.txt in the backup folder."
}

exit $code
