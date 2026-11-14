import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const mode: 'directory' | 'file' = body.mode === 'file' ? 'file' : 'directory';
    const title =
      typeof body.title === 'string' && body.title.trim()
        ? body.title.trim()
        : mode === 'directory'
          ? 'Select ComfyUI Root Directory'
          : 'Select Python Executable';

    const platform = process.platform;

    if (platform === 'win32') {
      const psScript =
        mode === 'directory'
          ? [
              '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8',
              'Add-Type -AssemblyName System.Windows.Forms',
              '$owner = New-Object System.Windows.Forms.Form',
              '$owner.TopMost = $true',
              '$dialog = New-Object System.Windows.Forms.FolderBrowserDialog',
              '$dialog.Description = $env:SENTINEL_DIALOG_TITLE',
              '$dialog.ShowNewFolderButton = $false',
              'if ($dialog.ShowDialog($owner) -eq [System.Windows.Forms.DialogResult]::OK) {',
              '  Write-Output $dialog.SelectedPath',
              '}',
              '$owner.Dispose()',
            ].join('; ')
          : [
              '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8',
              'Add-Type -AssemblyName System.Windows.Forms',
              '$owner = New-Object System.Windows.Forms.Form',
              '$owner.TopMost = $true',
              '$dialog = New-Object System.Windows.Forms.OpenFileDialog',
              '$dialog.Title = $env:SENTINEL_DIALOG_TITLE',
              "$dialog.Filter = 'Python Executable (python*.exe)|python*.exe|All Files (*.*)|*.*'",
              'if ($dialog.ShowDialog($owner) -eq [System.Windows.Forms.DialogResult]::OK) {',
              '  Write-Output $dialog.FileName',
              '}',
              '$owner.Dispose()',
            ].join('; ');

      const { stdout } = await execFileAsync(
        'powershell.exe',
        ['-NoProfile', '-STA', '-Command', psScript],
        {
          env: {
            ...process.env,
            SENTINEL_DIALOG_TITLE: title,
          },
          windowsHide: true,
          timeout: 120000,
        }
      );

      const picked = stdout.trim();
      return NextResponse.json({ path: picked || null });
    }

    if (platform === 'darwin') {
      const safeTitle = title.replace(/"/g, '\\"');
      const appleScript =
        mode === 'directory'
          ? `POSIX path of (choose folder with prompt "${safeTitle}")`
          : `POSIX path of (choose file with prompt "${safeTitle}")`;

      try {
        const { stdout } = await execFileAsync('osascript', ['-e', appleScript], {
          timeout: 120000,
        });
        const picked = stdout.trim().replace(/\/+$/, '');
        return NextResponse.json({ path: picked || null });
      } catch {
        // User cancelled the dialog
        return NextResponse.json({ path: null });
      }
    }

    // Linux: try zenity first, then kdialog
    try {
      const args =
        mode === 'directory'
          ? ['--file-selection', '--directory', `--title=${title}`]
          : ['--file-selection', `--title=${title}`];
      const { stdout } = await execFileAsync('zenity', args, { timeout: 120000 });
      return NextResponse.json({ path: stdout.trim() || null });
    } catch {
      try {
        const args =
          mode === 'directory'
            ? ['--getexistingdirectory', '.', '--title', title]
            : ['--getopenfilename', '.', '--title', title];
        const { stdout } = await execFileAsync('kdialog', args, { timeout: 120000 });
        return NextResponse.json({ path: stdout.trim() || null });
      } catch {
        return NextResponse.json({ path: null });
      }
    }
  } catch (err) {
    return NextResponse.json(
      {
        path: null,
        error: err instanceof Error ? err.message : 'Failed to open native picker',
      },
      { status: 500 }
    );
  }
}
