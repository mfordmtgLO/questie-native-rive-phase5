param([switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$rootPath = [System.IO.Path]::GetFullPath($PSScriptRoot)
$rootPrefix = $rootPath.TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
$listener.Start()
$port = ([System.Net.IPEndPoint]$listener.LocalEndpoint).Port
$url = "http://127.0.0.1:$port/"
$crlf = [char]13 + [char]10
$types = @{
  '.html' = 'text/html; charset=utf-8'
  '.css' = 'text/css; charset=utf-8'
  '.js' = 'text/javascript; charset=utf-8'
  '.mjs' = 'text/javascript; charset=utf-8'
  '.wasm' = 'application/wasm'
  '.riv' = 'application/octet-stream'
  '.json' = 'application/json; charset=utf-8'
}
Write-Host "Preview: $url (press Ctrl+C to stop)"
if (-not $NoBrowser) { Start-Process $url }
try {
  while ($true) {
    $client = $listener.AcceptTcpClient()
    try {
      $stream = $client.GetStream()
      $reader = [System.IO.StreamReader]::new($stream, [System.Text.Encoding]::ASCII, $false, 1024, $true)
      $requestLine = $reader.ReadLine()
      if (-not $requestLine) { continue }
      $headerLine = $reader.ReadLine()
      while ($null -ne $headerLine -and $headerLine -ne '') { $headerLine = $reader.ReadLine() }
      $parts = $requestLine.Split(' ', 3)
      $method = $parts[0]
      $status = '200 OK'
      $contentType = 'application/octet-stream'
      $body = [byte[]]@()
      if ($parts.Length -lt 2 -or ($method -ne 'GET' -and $method -ne 'HEAD')) {
        $status = '405 Method Not Allowed'
        $contentType = 'text/plain; charset=utf-8'
        $body = [System.Text.Encoding]::UTF8.GetBytes('Only GET and HEAD are supported.')
      } else {
        $requestUri = [System.Uri]::new("http://127.0.0.1$($parts[1])")
        $relative = [System.Uri]::UnescapeDataString($requestUri.AbsolutePath.TrimStart('/')).Replace('/', [System.IO.Path]::DirectorySeparatorChar)
        if (-not $relative) { $relative = 'index.html' }
        $filePath = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($rootPath, $relative))
        if (-not $filePath.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
          $status = '403 Forbidden'
          $contentType = 'text/plain; charset=utf-8'
          $body = [System.Text.Encoding]::UTF8.GetBytes('Forbidden')
        } elseif (-not [System.IO.File]::Exists($filePath)) {
          $status = '404 Not Found'
          $contentType = 'text/plain; charset=utf-8'
          $body = [System.Text.Encoding]::UTF8.GetBytes('Not found')
        } else {
          $extension = [System.IO.Path]::GetExtension($filePath).ToLowerInvariant()
          if ($types.ContainsKey($extension)) { $contentType = $types[$extension] }
          if ($method -eq 'GET') { $body = [System.IO.File]::ReadAllBytes($filePath) }
        }
      }
      $header = "HTTP/1.1 $status${crlf}Content-Type: $contentType${crlf}Content-Length: $($body.Length)${crlf}Connection: close${crlf}X-Content-Type-Options: nosniff${crlf}${crlf}"
      $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
      $stream.Write($headerBytes, 0, $headerBytes.Length)
      if ($body.Length -gt 0) { $stream.Write($body, 0, $body.Length) }
      $stream.Flush()
    } catch {
      Write-Warning $_.Exception.Message
    } finally {
      $client.Close()
    }
  }
} finally {
  $listener.Stop()
}
