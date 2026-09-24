# List top-level windows with pid / size / title. ASCII comments only.
# -OnlyPid <id> narrows to one process and also shows hidden windows.
param([int]$OnlyPid = 0)
Add-Type -TypeDefinition @'
using System; using System.Text; using System.Runtime.InteropServices;
public class WinList {
  public delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr l);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowTextW(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern int GetWindowThreadProcessId(IntPtr h, out int pid);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out R r);
  [StructLayout(LayoutKind.Sequential)] public struct R { public int L, T, Rt, B; }
}
'@

$script:rows = @()
$cb = [WinList+EnumProc] {
  param($h, $l)
  $vis = [WinList]::IsWindowVisible($h)
  if ($vis -or $OnlyPid -gt 0) {
    $sb = New-Object System.Text.StringBuilder 300
    [void][WinList]::GetWindowTextW($h, $sb, 300)
    $wpid = 0
    [void][WinList]::GetWindowThreadProcessId($h, [ref]$wpid)
    $r = New-Object WinList+R
    [void][WinList]::GetWindowRect($h, [ref]$r)
    if (($OnlyPid -gt 0 -and $wpid -eq $OnlyPid) -or ($OnlyPid -eq 0 -and $sb.Length -gt 0)) {
      $exe = ''
      try { $exe = (Get-Process -Id $wpid -ErrorAction Stop).Path } catch {}
      $script:rows += [pscustomobject]@{
        Handle = [int64]$h
        PID    = $wpid
        Size   = "$($r.Rt - $r.L)x$($r.B - $r.T)"
        Pos    = "$($r.L),$($r.T)"
        Vis    = $vis
        Title  = $sb.ToString()
        Exe    = $exe
      }
    }
  }
  return $true
}
[void][WinList]::EnumWindows($cb, [IntPtr]::Zero)
$rows | Format-Table -AutoSize -Wrap
