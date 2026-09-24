param([int]$Pad = 60, [int]$Zoom = 6)

Add-Type -AssemblyName System.Drawing

$sig = @"
using System;
using System.Runtime.InteropServices;
public class Win32Rect2 {
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT r);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
}
"@
if (-not ('Win32Rect2' -as [type])) { Add-Type -TypeDefinition $sig }

$proc = Get-Process electron -ErrorAction SilentlyContinue |
        Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
if (-not $proc) { Write-Output 'no window'; exit 1 }

$r = New-Object Win32Rect2+RECT
[void][Win32Rect2]::GetWindowRect($proc.MainWindowHandle, [ref]$r)
[int]$x = $r.Left
[int]$y = $r.Top
Write-Output "rect $x,$y $($r.Right - $r.Left)x$($r.Bottom - $r.Top)"

$src = [System.Drawing.Image]::FromFile('C:\Users\Administrator\Documents\code project\shot.png')
Write-Output "screenshot $($src.Width)x$($src.Height)"

[int]$outW = $Pad * $Zoom
$zoomBmp = New-Object System.Drawing.Bitmap -ArgumentList $outW, $outW
$g = [System.Drawing.Graphics]::FromImage($zoomBmp)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half

$dst = New-Object System.Drawing.Rectangle -ArgumentList 0, 0, $outW, $outW
$sub = New-Object System.Drawing.Rectangle -ArgumentList $x, $y, $Pad, $Pad
$g.DrawImage($src, $dst, $sub, [System.Drawing.GraphicsUnit]::Pixel)

$zoomBmp.Save('C:\Users\Administrator\Documents\code project\corner.png', [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $zoomBmp.Dispose(); $src.Dispose()
Write-Output 'corner zoom ok'
