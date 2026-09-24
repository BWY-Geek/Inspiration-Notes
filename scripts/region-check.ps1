# Read the window's clip region from the OS and ask whether the extreme corner
# pixels are inside it.
#
# HEADS UP: this app no longer uses SetWindowRgn -- the corners are drawn by CSS
# (see electron/acrylic.js for why). So "NO REGION -> all four corners SQUARE" is
# the EXPECTED output now, and it does NOT mean the corners look square. This
# script only means something for the SetWindowRgn approach.
#
# And even then: a region you can read back is not proof the corners render
# rounded. With system blur on, DWM accepts the region and ignores it. Judge
# corners from a screenshot on a WHITE backdrop, never from this script.
#
# ASCII comments only (PowerShell 5.1 reads .ps1 as ANSI).
param([int]$Radius = 13)

Add-Type -TypeDefinition @'
using System; using System.Text; using System.Runtime.InteropServices;
public class Rgn {
  public delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr l);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern int GetWindowThreadProcessId(IntPtr h, out int pid);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowTextW(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern int GetWindowRgn(IntPtr h, IntPtr rgn);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out R r);
  [DllImport("gdi32.dll")] public static extern IntPtr CreateRectRgn(int l, int t, int r, int b);
  [DllImport("gdi32.dll")] public static extern bool PtInRegion(IntPtr rgn, int x, int y);
  [DllImport("gdi32.dll")] public static extern int GetRgnBox(IntPtr rgn, out R r);
  [DllImport("gdi32.dll")] public static extern bool DeleteObject(IntPtr o);
  [StructLayout(LayoutKind.Sequential)] public struct R { public int L, T, Rt, B; }
}
'@

$root = Split-Path -Parent $PSScriptRoot
$targets = @()
foreach ($p in (Get-Process electron -ErrorAction SilentlyContinue)) {
  $ok = $false
  try { $ok = ($p.Path -and $p.Path.StartsWith($root, 'OrdinalIgnoreCase')) } catch {}
  if ($ok) { $targets += $p.Id }
}
if ($targets.Count -eq 0) { Write-Output 'app not running'; exit 1 }

$script:wins = @()
$cb = [Rgn+EnumProc] {
  param($h, $l)
  $wpid = 0
  [void][Rgn]::GetWindowThreadProcessId($h, [ref]$wpid)
  if ($targets -contains $wpid) {
    $r = New-Object Rgn+R
    [void][Rgn]::GetWindowRect($h, [ref]$r)
    if (($r.Rt - $r.L) -gt 0 -and ($r.B - $r.T) -gt 0) {
      $sb = New-Object System.Text.StringBuilder 300
      [void][Rgn]::GetWindowTextW($h, $sb, 300)
      $script:wins += [pscustomobject]@{
        H = $h; W = ($r.Rt - $r.L); Ht = ($r.B - $r.T)
        Vis = [Rgn]::IsWindowVisible($h); Title = $sb.ToString()
      }
    }
  }
  return $true
}
[void][Rgn]::EnumWindows($cb, [IntPtr]::Zero)

foreach ($w in $wins) {
  Write-Output ""
  Write-Output "=== $($w.W)x$($w.Ht)  visible=$($w.Vis)  title='$($w.Title)'"

  $rgn = [Rgn]::CreateRectRgn(0, 0, 1, 1)
  $kind = [Rgn]::GetWindowRgn($w.H, $rgn)
  if ($kind -eq 0) {
    Write-Output '  NO REGION -> plain rectangle, all four corners SQUARE'
    [void][Rgn]::DeleteObject($rgn)
    continue
  }
  $box = New-Object Rgn+R
  [void][Rgn]::GetRgnBox($rgn, [ref]$box)
  Write-Output "  region box $($box.Rt - $box.L)x$($box.B - $box.T) (window is $($w.W)x$($w.Ht))"

  # Walk each corner diagonally inward; first pixel inside the region tells the
  # story. Square corner -> 0. Radius r -> about r*0.3.
  $corners = @(
    @{ n = 'top-left';     x = 0;         y = 0;          dx =  1; dy =  1 },
    @{ n = 'top-right';    x = $w.W - 1;  y = 0;          dx = -1; dy =  1 },
    @{ n = 'bottom-left';  x = 0;         y = $w.Ht - 1;  dx =  1; dy = -1 },
    @{ n = 'bottom-right'; x = $w.W - 1;  y = $w.Ht - 1;  dx = -1; dy = -1 }
  )
  foreach ($c in $corners) {
    $inset = -1
    for ($i = 0; $i -lt ($Radius + 8); $i++) {
      if ([Rgn]::PtInRegion($rgn, ($c.x + $c.dx * $i), ($c.y + $c.dy * $i))) { $inset = $i; break }
    }
    $verdict = if ($inset -eq 0) { 'SQUARE' }
               elseif ($inset -gt 0) { "rounded (inset ${inset}px)" }
               else { 'never enters region (region smaller than window)' }
    Write-Output ("  {0,-14} {1}" -f $c.n, $verdict)
  }
  [void][Rgn]::DeleteObject($rgn)
}
