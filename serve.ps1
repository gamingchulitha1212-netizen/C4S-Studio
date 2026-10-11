# C4S Studio Local Web & Backend API Server
$port = 8080
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$dbFile = Join-Path $PSScriptRoot "orders-db.json"

function Get-DbData {
    if (Test-Path $dbFile) {
        try {
            return Get-Content -Raw -Path $dbFile | ConvertFrom-Json
        } catch {}
    }
    return [PSCustomObject]@{ orders = @(); invoices = @() }
}

function Save-DbData {
    param($data)
    try {
        $json = $data | ConvertTo-Json -Depth 10
        [System.IO.File]::WriteAllText($dbFile, $json, [System.Text.Encoding]::UTF8)
    } catch {
        Write-Host "Save-DbData Error: $_" -ForegroundColor Red
    }
}

try {
    $listener.Start()
    Write-Host "=============================================" -ForegroundColor Cyan
    Write-Host " C4S STUDIO FULL-STACK SERVER RUNNING" -ForegroundColor Magenta
    Write-Host " Website:     http://localhost:$port/" -ForegroundColor Green
    Write-Host " Order Panel: http://localhost:$port/admin-orders.html" -ForegroundColor Yellow
    Write-Host " Admin Site:  http://localhost:$port/admin.html" -ForegroundColor Yellow
    Write-Host " API Routes:  http://localhost:$port/api/orders" -ForegroundColor Cyan
    Write-Host " Press Ctrl+C to stop the server." -ForegroundColor Gray
    Write-Host "=============================================" -ForegroundColor Cyan

    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        # CORS Headers
        $response.Headers.Add("Access-Control-Allow-Origin", "*")
        $response.Headers.Add("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        $response.Headers.Add("Access-Control-Allow-Headers", "Content-Type, Authorization")

        if ($request.HttpMethod -eq "OPTIONS") {
            $response.StatusCode = 200
            $response.Close()
            continue
        }

        $localPath = $request.Url.LocalPath.TrimStart('/')
        if ([string]::IsNullOrWhiteSpace($localPath)) {
            $localPath = "index.html"
        }

        # -----------------------------------------------------------------
        # BACKEND API: /api/orders
        # -----------------------------------------------------------------
        if ($localPath -eq "api/orders" -or $localPath -like "api/orders/*") {
            $response.ContentType = "application/json; charset=utf-8"

            if ($request.HttpMethod -eq "GET") {
                $db = Get-DbData
                $resObj = [PSCustomObject]@{
                    ok = $true
                    orders = if ($db.orders) { $db.orders } else { @() }
                    invoices = if ($db.invoices) { $db.invoices } else { @() }
                }
                $jsonBytes = [System.Text.Encoding]::UTF8.GetBytes(($resObj | ConvertTo-Json -Depth 10))
                $response.OutputStream.Write($jsonBytes, 0, $jsonBytes.Length)
                $response.Close()
                continue
            }

            if ($request.HttpMethod -eq "POST") {
                $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
                $bodyText = $reader.ReadToEnd()
                $body = try { $bodyText | ConvertFrom-Json } catch { $null }

                $db = Get-DbData
                $action = if ($body -and $body.action) { $body.action } else { "update" }
                $orderId = if ($body -and $body.orderId) { $body.orderId } else { "" }

                if ($action -eq "update" -and $orderId) {
                    foreach ($o in $db.orders) {
                        if ($o.id -eq $orderId) {
                            if ($body.status) { $o.status = $body.status }
                            if ($null -ne $body.note) { $o.note = $body.note }
                            $o.updatedAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
                        }
                    }
                    Save-DbData -data $db
                    $resBytes = [System.Text.Encoding]::UTF8.GetBytes('{"ok":true,"message":"Order updated"}')
                    $response.OutputStream.Write($resBytes, 0, $resBytes.Length)
                    $response.Close()
                    continue
                }

                if ($action -eq "delete" -and $orderId) {
                    $db.orders = @($db.orders | Where-Object { $_.id -ne $orderId })
                    Save-DbData -data $db
                    $resBytes = [System.Text.Encoding]::UTF8.GetBytes('{"ok":true,"message":"Order deleted"}')
                    $response.OutputStream.Write($resBytes, 0, $resBytes.Length)
                    $response.Close()
                    continue
                }

                $resBytes = [System.Text.Encoding]::UTF8.GetBytes('{"ok":true}')
                $response.OutputStream.Write($resBytes, 0, $resBytes.Length)
                $response.Close()
                continue
            }
        }

        # -----------------------------------------------------------------
        # BACKEND API: /api/order (Submit Form)
        # -----------------------------------------------------------------
        if ($localPath -eq "api/order" -or $localPath -eq "order") {
            $response.ContentType = "application/json; charset=utf-8"
            $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
            $bodyText = $reader.ReadToEnd()
            $body = try { $bodyText | ConvertFrom-Json } catch { $null }

            $orderId = "ord-" + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() + "-" + (Get-Random -Minimum 1000 -Maximum 9999)
            $invNum = "INV-" + (Get-Date).Year + "-" + (Get-Random -Minimum 1000 -Maximum 9999)

            if ($body) {
                $db = Get-DbData
                $newOrd = [PSCustomObject]@{
                    id = $orderId
                    name = if ($body.name) { $body.name } else { "Client" }
                    email = if ($body.email) { $body.email } else { "" }
                    phone = if ($body.phone) { $body.phone } else { "" }
                    service = if ($body.service) { $body.service } else { "Photography" }
                    budget = if ($body.budget) { $body.budget } else { "$50" }
                    eventDate = if ($body.eventDate) { $body.eventDate } else { "" }
                    message = if ($body.message) { $body.message } else { "" }
                    source = if ($body.source) { $body.source } else { "contact form" }
                    status = "new"
                    createdAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
                }
                $existing = @()
                if ($db.orders) { $existing = @($db.orders) }
                $db.orders = @($newOrd) + $existing
                Save-DbData -data $db
            }

            $resObj = [PSCustomObject]@{
                ok = $true
                orderId = $orderId
                invoiceNumber = $invNum
                emailed = $false
            }
            $jsonBytes = [System.Text.Encoding]::UTF8.GetBytes(($resObj | ConvertTo-Json -Compress))
            $response.OutputStream.Write($jsonBytes, 0, $jsonBytes.Length)
            $response.Close()
            continue
        }

        # -----------------------------------------------------------------
        # BACKEND API: /api/auth
        # -----------------------------------------------------------------
        if ($localPath -eq "api/auth" -or $localPath -like "api/auth/*") {
            $response.ContentType = "application/json; charset=utf-8"
            $resBytes = [System.Text.Encoding]::UTF8.GetBytes('{"ok":true,"authorized":true,"email":"chulitharv123@gmail.com","role":"owner"}')
            $response.OutputStream.Write($resBytes, 0, $resBytes.Length)
            $response.Close()
            continue
        }

        # -----------------------------------------------------------------
        # BACKEND API: /api/admin
        # -----------------------------------------------------------------
        if ($localPath -eq "api/admin" -or $localPath -like "api/admin/*") {
            $response.ContentType = "application/json; charset=utf-8"
            $resBytes = [System.Text.Encoding]::UTF8.GetBytes('{"ok":true,"superAdmin":"chulitharv123@gmail.com","admins":[{"email":"chulitharv123@gmail.com","role":"owner"}]}')
            $response.OutputStream.Write($resBytes, 0, $resBytes.Length)
            $response.Close()
            continue
        }

        # -----------------------------------------------------------------
        # STATIC FILE SERVING
        # -----------------------------------------------------------------
        $filePath = Join-Path $PSScriptRoot $localPath
        if (Test-Path $filePath -PathType Leaf) {
            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            $ext = [System.IO.Path]::GetExtension($filePath).ToLower()

            $contentType = switch ($ext) {
                ".html" { "text/html; charset=utf-8" }
                ".js"   { "application/javascript; charset=utf-8" }
                ".css"  { "text/css; charset=utf-8" }
                ".json" { "application/json; charset=utf-8" }
                ".png"  { "image/png" }
                ".jpg"  { "image/jpeg" }
                ".jpeg" { "image/jpeg" }
                ".svg"  { "image/svg+xml" }
                ".webp" { "image/webp" }
                default { "application/octet-stream" }
            }

            $response.ContentType = $contentType
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $response.StatusCode = 404
            $notFoundBytes = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
            $response.OutputStream.Write($notFoundBytes, 0, $notFoundBytes.Length)
        }

        $response.Close()
    }
} catch {
    Write-Host "Server stopped: $_" -ForegroundColor Red
} finally {
    $listener.Stop()
}
