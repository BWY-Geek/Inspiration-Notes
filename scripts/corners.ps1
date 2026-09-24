# Grab the four corners of the main window, zoom them, tile into one 2x2 image.
# ASCII comments only: Windows PowerShell 5.1 reads .ps1 as ANSI, and UTF-8 CJK
# bytes get mis-decoded badly enough to swallow the following line.
param([int]$Pad = 48, [int]$Zoom = 8, [int]$X = -1, [int]$Y = -1, [int]$W = -1, [int]$H = -1,
      [string]$Backdrop = '')

Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms

$sig = @"
using System;
using System.Runtime.InteropServices;
public class Win32Rect3 {
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT r);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int cmd);
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr hWnd, IntPtr after, int x, int y, int cx, int cy, uint flags);
  [DllImport("user32.dll")] public static extern bool MoveWindow(IntPtr hWnd, int x, int y, int w, int h, bool repaint);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
}
"@
if (-not ('Win32Rect3' -as [type])) { Add-Type -TypeDefinition $sig }

# Match by exe path: other Electron apps (e.g. the console) are usually running too.
$proc = Get-Process electron -ErrorAction SilentlyContinue |
        Where-Object { $_.MainWindowHandle -ne 0 -and $_.Path -like '*code project*' } |
        Select-Object -First 1
if (-not $proc) { Write-Output 'no window'; exit 1 }
Write-Output "pid $($proc.Id)"

$hwnd = $proc.MainWindowHandle
[void][Win32Rect3]::ShowWindow($hwnd, 9)                                 # SW_RESTORE
if ($X -ge 0 -and $Y -ge 0 -and $W -gt 0 -and $H -gt 0) {
  # Park the window over empty desktop so nothing else gets captured on top of it.
  [void][Win32Rect3]::MoveWindow($hwnd, $X, $Y, $W, $H, $true)
  Start-Sleep -Milliseconds 500
}
# A dark square corner sitting on a dark desktop is invisible. Slide a flat panel
# behind the window so any leftover corner shows up against it. White is the
# harshest test for this app's dark chrome.
$form = $null
if ($Backdrop) {
  $r0 = New-Object Win32Rect3+RECT
  [void][Win32Rect3]::GetWindowRect($hwnd, [ref]$r0)
  $form = New-Object System.Windows.Forms.Form
  $form.FormBorderStyle = 'None'
  $form.BackColor = [System.Drawing.Color]::FromName($Backdrop)
  $form.StartPosition = 'Manual'
  $form.Location = New-Object System.Drawing.Point(($r0.L - 80), ($r0.T - 80))
  $form.Size = New-Object System.Drawing.Size((($r0.Rt - $r0.L) + 160), (($r0.B - $r0.T) + 160))
  $form.TopMost = $true
  $form.ShowInTaskbar = $false
  $form.Show()
  [System.Windows.Forms.Application]::DoEvents()
  Start-Sleep -Milliseconds 400
}

# SetForegroundWindow alone often loses to Windows' foreground lock, and then we
# screenshot whatever is sitting on top. Pin topmost for the capture, drop it after.
# Done after the backdrop so the window lands on top of it.
[void][Win32Rect3]::SetWindowPos($hwnd, [IntPtr](-1), 0,0,0,0, 0x0043)  # HWND_TOPMOST|NOMOVE|NOSIZE|SHOWWINDOW
[void][Win32Rect3]::SetForegroundWindow($hwnd)
Start-Sleep -Milliseconds 800

$r = New-Object Win32Rect3+RECT
[void][Win32Rect3]::GetWindowRect($hwnd, [ref]$r)
$W = $r.Right - $r.Left
$H = $r.Bottom - $r.Top
Write-Output "rect $($r.Left),$($r.Top) ${W}x${H}"
if ($W -le 0 -or $H -le 0) { Write-Output 'bad rect'; exit 1 }

$full = New-Object System.Drawing.Bitmap -ArgumentList $W, $H
$gf = [System.Drawing.Graphics]::FromImage($full)
$gf.CopyFromScreen($r.Left, $r.Top, 0, 0, (New-Object System.Drawing.Size -ArgumentList $W, $H))
$gf.Dispose()

[void][Win32Rect3]::SetWindowPos($hwnd, [IntPtr](-2), 0,0,0,0, 0x0043)  # HWND_NOTOPMOST
if ($form) { $form.Close(); $form.Dispose() }

$full.Save('C:\Users\Administrator\Documents\code project\window.png', [System.Drawing.Imaging.ImageFormat]::Png)

$cell = $Pad * $Zoom
$out = New-Object System.Drawing.Bitmap -ArgumentList ($cell * 2 + 12), ($cell * 2 + 12)
$g = [System.Drawing.Graphics]::FromImage($out)
$g.Clear([System.Drawing.Color]::Magenta)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half

$corners = @(
  @{ sx = 0;         sy = 0;         dx = 0;          dy = 0 },
  @{ sx = $W - $Pad; sy = 0;         dx = $cell + 12; dy = 0 },
  @{ sx = 0;         sy = $H - $Pad; dx = 0;          dy = $cell + 12 },
  @{ sx = $W - $Pad; sy = $H - $Pad; dx = $cell + 12; dy = $cell + 12 }
)
foreach ($c in $corners) {
  $dst = New-Object System.Drawing.Rectangle -ArgumentList $c.dx, $c.dy, $cell, $cell
  $sub = New-Object System.Drawing.Rectangle -ArgumentList $c.sx, $c.sy, $Pad, $Pad
  $g.DrawImage($full, $dst, $sub, [System.Drawing.GraphicsUnit]::Pixel)
}

$out.Save('C:\Users\Administrator\Documents\code project\corners.png', [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $out.Dispose(); $full.Dispose()
Write-Output 'corners.png ok'
