# PowerShell script to reset PostgreSQL password
# Run this as Administrator

Write-Host "`n🔐 PostgreSQL Password Reset Tool`n" -ForegroundColor Yellow

$pgBinPath = "C:\Program Files\PostgreSQL\18\bin\psql.exe"

if (-not (Test-Path $pgBinPath)) {
    Write-Host "❌ PostgreSQL not found at: $pgBinPath" -ForegroundColor Red
    Write-Host "Please update the path in this script." -ForegroundColor Yellow
    exit 1
}

Write-Host "Enter new password for 'postgres' user:" -ForegroundColor Cyan
$newPassword = Read-Host -AsSecureString
$plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($newPassword)
)

Write-Host "`nAttempting to reset password..." -ForegroundColor Yellow

# Try to connect and reset password
# Note: This might fail if current password is wrong
# In that case, you'll need to use pg_hba.conf method

$env:PGPASSWORD = "postgres"  # Try default password first
$sqlCommand = "ALTER USER postgres WITH PASSWORD '$plainPassword';"

try {
    & $pgBinPath -U postgres -d postgres -c $sqlCommand 2>&1 | Out-Null
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Password reset successfully!" -ForegroundColor Green
        Write-Host "`nUpdate backend/.env with:" -ForegroundColor Cyan
        Write-Host "DB_PASSWORD=$plainPassword`n" -ForegroundColor White
    } else {
        Write-Host "❌ Failed to reset password." -ForegroundColor Red
        Write-Host "`nTry these methods:" -ForegroundColor Yellow
        Write-Host "1. Use pgAdmin (if already connected)" -ForegroundColor White
        Write-Host "2. Edit pg_hba.conf (see FIX_PASSWORD_ISSUE.md)" -ForegroundColor White
        Write-Host "3. Try common passwords: postgres, admin, password" -ForegroundColor White
    }
} catch {
    Write-Host "❌ Error: $_" -ForegroundColor Red
    Write-Host "`nSee FIX_PASSWORD_ISSUE.md for alternative methods." -ForegroundColor Yellow
}
