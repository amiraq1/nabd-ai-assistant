$main = (Invoke-WebRequest -Uri 'http://localhost:5000/src/main.tsx' -UseBasicParsing).Content
$m = [regex]::Match($main, '/@fs/[^"'']+')
if ($m.Success) {
  $dep = 'http://localhost:5000' + $m.Value
  $r = Invoke-WebRequest -Uri $dep -Method Head -UseBasicParsing
  Write-Output "DEP:$dep"
  Write-Output "CACHE:$($r.Headers['Cache-Control'])"
  Write-Output "PRAGMA:$($r.Headers['Pragma'])"
  Write-Output "EXPIRES:$($r.Headers['Expires'])"
} else {
  Write-Output 'NO_DEP_FOUND'
}
