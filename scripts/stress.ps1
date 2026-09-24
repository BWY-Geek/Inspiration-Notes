# Exercise the paths that are known to drop the window region, so corners.ps1
# can check the rounding survived. ASCII comments only (see corners.ps1).
#   -Mode maximize : maximize then restore
#   -Mode drag     : slide the window around, then idle past the acrylic restore timer
#   -Mode resize   : rapid size changes ending smaller, like dragging a border inward
#                    (a stale region taller than the window squares off the bottom corners)
#   -Mode droprgn  : rip the clip region off the window the way hide/show and DWM do,
#                    then re-activate it. The app must notice and re-clip.
param([string]$Mode = 'maximize')

Add-Type -TypeDefinition @'
using System; using System.Runtime.InteropServices;
public class Stress {
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int cmd);
  [DllImport("user32.dll")] public static extern bool MoveWindow(IntPtr h, int x, int y, int w, int ht, bool repaint);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out R r);
  [StructLayout(LayoutKind.Sequential)] public struct R { public int L, T, Rt, B; }
}
'@

$root = Split-Path -Parent $PSScriptRoot
$proc = Get-Process electron -ErrorAction SilentlyContinue |
        Where-Object { $_.MainWindowHandle -ne 0 -and $_.Path -and $_.Path.StartsWith($root, 'OrdinalIgnoreCase') } |
        Select-Object -First 1
if (-not $proc) { Write-Output 'no window'; exit 1 }
$hwnd = $proc.MainWindowHandle

if ($Mode -eq 'maximize') {
  [void][Stress]::ShowWindow($hwnd, 3)   # SW_MAXIMIZE
  Start-Sleep -Milliseconds 900
  [void][Stress]::ShowWindow($hwnd, 9)   # SW_RESTORE
  Start-Sleep -Milliseconds 900
}
elseif ($Mode -eq 'drag') {
  for ($i = 0; $i -lt 30; $i++) {
    [void][Stress]::MoveWindow($hwnd, (1500 + ($i * 4)), (30 + ($i * 2)), 900, 576, $true)
    Start-Sleep -Milliseconds 15
  }
  # the acrylic downgrade restores itself ~350ms after the last move
  Start-Sleep -Milliseconds 1200
  [void][Stress]::MoveWindow($hwnd, 1500, 30, 900, 576, $true)
  Start-Sleep -Milliseconds 800
}
elseif ($Mode -eq 'resize') {
  for ($i = 0; $i -lt 24; $i++) {
    [void][Stress]::MoveWindow($hwnd, 1500, 30, 900, (760 - ($i * 8)), $true)
    Start-Sleep -Milliseconds 12
  }
  Start-Sleep -Milliseconds 600
}

$r = New-Object Stress+R
[void][Stress]::GetWindowRect($hwnd, [ref]$r)
Write-Output "$Mode done -> $($r.Rt - $r.L) x $($r.B - $r.T) @ $($r.L),$($r.T)"
