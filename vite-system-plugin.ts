import type { Plugin } from 'vite';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execSync } from 'node:child_process';
import http from 'node:http';

let prevCpus = os.cpus();

function getCpuMetrics() {
  const cpus = os.cpus();
  const perCore: number[] = [];
  let totalDiff = 0;
  let idleDiff = 0;

  for (let i = 0; i < cpus.length; i++) {
    const prev = prevCpus[i] || cpus[i];
    const curr = cpus[i];

    let prevTotal = 0;
    for (const key of Object.keys(prev.times) as (keyof typeof prev.times)[]) {
      prevTotal += prev.times[key];
    }
    let currTotal = 0;
    for (const key of Object.keys(curr.times) as (keyof typeof curr.times)[]) {
      currTotal += curr.times[key];
    }

    const dTotal = currTotal - prevTotal;
    const dIdle = curr.times.idle - prev.times.idle;

    const corePct = dTotal > 0 ? Math.max(0, Math.min(100, ((dTotal - dIdle) / dTotal) * 100)) : 0;
    perCore.push(Math.round(corePct * 10) / 10);

    totalDiff += dTotal;
    idleDiff += dIdle;
  }

  prevCpus = cpus;
  const overallPct = totalDiff > 0 ? Math.max(0, Math.min(100, ((totalDiff - idleDiff) / totalDiff) * 100)) : 0;

  return {
    overall: Math.round(overallPct * 10) / 10,
    perCore,
    model: cpus[0]?.model || 'Processor',
  };
}

function getDiskMetrics() {
  let totalBytes = 0;
  let freeBytes = 0;

  for (const drive of ['C:\\', 'D:\\']) {
    try {
      const stats = fs.statfsSync(drive);
      totalBytes += stats.bsize * stats.blocks;
      freeBytes += stats.bsize * stats.bavail;
    } catch {
      // drive might not be mounted
    }
  }

  if (totalBytes === 0) {
    try {
      const stats = fs.statfsSync('.');
      totalBytes = stats.bsize * stats.blocks;
      freeBytes += stats.bsize * stats.bavail;
    } catch {}
  }

  const usedBytes = Math.max(0, totalBytes - freeBytes);
  const totalGb = Math.round((totalBytes / (1024 * 1024 * 1024)) * 10) / 10;
  const usedGb = Math.round((usedBytes / (1024 * 1024 * 1024)) * 10) / 10;
  const pct = totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 1000) / 10 : 0;

  return { totalGb, usedGb, pct };
}

// Background network sampler
let prevNet = { rx: 0, tx: 0, time: 0 };
let currentNetSpeed = { rxKbps: 0, txKbps: 0 };

function sampleNetwork() {
  try {
    const proc = spawn('netstat', ['-e']);
    let out = '';
    proc.stdout.on('data', chunk => { out += chunk; });
    proc.on('close', () => {
      const match = out.match(/Bytes\s+(\d+)\s+(\d+)/i);
      if (match) {
        const rx = parseInt(match[1], 10);
        const tx = parseInt(match[2], 10);
        const now = Date.now();
        if (prevNet.time > 0 && rx >= prevNet.rx && tx >= prevNet.tx) {
          const dt = (now - prevNet.time) / 1000;
          if (dt > 0.4) {
            currentNetSpeed = {
              rxKbps: Math.round(((rx - prevNet.rx) / 1024 / dt) * 10) / 10,
              txKbps: Math.round(((tx - prevNet.tx) / 1024 / dt) * 10) / 10,
            };
          }
        }
        prevNet = { rx, tx, time: now };
      }
    });
  } catch {}
}

// Background battery sampler
let cachedBattery = { pct: -1, charging: false };
function sampleBattery() {
  try {
    const ps = spawn('powershell.exe', [
      '-NoProfile',
      '-Command',
      '(Get-CimInstance Win32_Battery -ErrorAction SilentlyContinue) | ForEach-Object { "$($_.EstimatedChargeRemaining),$($_.BatteryStatus)" }'
    ]);
    let out = '';
    ps.stdout.on('data', chunk => { out += chunk; });
    ps.on('close', () => {
      const trimmed = out.trim();
      if (trimmed) {
        const parts = trimmed.split(',');
        const pct = parseInt(parts[0], 10);
        const status = parseInt(parts[1], 10);
        if (!isNaN(pct)) {
          cachedBattery = {
            pct,
            charging: status === 2 || status === 6 || status === 7 || status === 8,
          };
        }
      }
    });
  } catch {}
}

// Background process count sampler
let cachedProcessCount = 152;
function sampleProcesses() {
  try {
    const ps = spawn('powershell.exe', ['-NoProfile', '-Command', '(Get-Process).Count']);
    let out = '';
    ps.stdout.on('data', d => { out += d; });
    ps.on('close', () => {
      const count = parseInt(out.trim(), 10);
      if (!isNaN(count) && count > 0) {
        cachedProcessCount = count;
      }
    });
  } catch {}
}

// Initialise background samplers
setInterval(sampleNetwork, 2000);
sampleNetwork();
setInterval(sampleBattery, 15000);
sampleBattery();
setInterval(sampleProcesses, 5000);
sampleProcesses();

function parseJsonBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
  });
}

export function systemBridgePlugin(): Plugin {
  return {
    name: 'boty-system-bridge',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || '';

        // 1. System Statistics
        if (url === '/api/system/stats' && req.method === 'GET') {
          try {
            const cpu = getCpuMetrics();
            const disk = getDiskMetrics();
            const totalBytes = os.totalmem();
            const freeBytes = os.freemem();
            const usedBytes = totalBytes - freeBytes;
            const ramTotalMb = Math.round(totalBytes / 1048576);
            const ramUsedMb = Math.round(usedBytes / 1048576);
            const ramPct = Math.round((usedBytes / totalBytes) * 1000) / 10;
            const uptimeSecs = Math.round(os.uptime());

            const payload = {
              cpu_usage: cpu.overall,
              cpu_per_core: cpu.perCore,
              cpu_model: cpu.model,
              ram_used_mb: ramUsedMb,
              ram_total_mb: ramTotalMb,
              ram_pct: ramPct,
              disk_used_gb: disk.usedGb,
              disk_total_gb: disk.totalGb,
              disk_pct: disk.pct,
              net_rx_kbps: currentNetSpeed.rxKbps,
              net_tx_kbps: currentNetSpeed.txKbps,
              battery_pct: cachedBattery.pct,
              battery_charging: cachedBattery.charging,
              process_count: cachedProcessCount,
              uptime_secs: uptimeSecs,
              platform: 'Windows 11',
              hostname: os.hostname(),
            };

            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(payload));
            return;
          } catch (e) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: String(e) }));
            return;
          }
        }

        // 2. Launch Local Desktop Applications
        if (url === '/api/system/launch-app' && req.method === 'POST') {
          try {
            const body = await parseJsonBody(req);
            const appId = (body.appId || '').toLowerCase();
            const cmd = body.cmd;

            const appExecutables: Record<string, string> = {
              explorer: 'explorer.exe',
              notepad: 'notepad.exe',
              calc: 'calc.exe',
              calculator: 'calc.exe',
              terminal: 'wt.exe',
              cmd: 'cmd.exe',
              powershell: 'powershell.exe',
              vscode: 'code.cmd',
              code: 'code.cmd',
              chrome: 'chrome.exe',
              edge: 'msedge.exe',
              spotify: 'spotify.exe',
              vlc: 'vlc.exe',
              obs: 'obs64.exe',
              discord: 'discord.exe',
              slack: 'slack.exe',
              settings: 'ms-settings:',
              taskmanager: 'taskmgr.exe',
              taskmgr: 'taskmgr.exe',
              paint: 'mspaint.exe',
              mspaint: 'mspaint.exe',
              word: 'winword.exe',
              excel: 'excel.exe',
              outlook: 'outlook.exe',
              minecraft: 'minecraft.exe',
              valorant: 'riotclient://',
              canva: 'https://canva.com',
              gmail: 'https://mail.google.com',
              gta5: 'https://store.rockstargames.com',
            };

            const target = appExecutables[appId] || cmd || 'notepad.exe';

            if (target.startsWith('http://') || target.startsWith('https://') || target.startsWith('ms-settings:') || target.includes('://')) {
              spawn('cmd.exe', ['/c', 'start', '', target], { detached: true, stdio: 'ignore' }).unref();
            } else if (target.endsWith('.exe') || target.endsWith('.cmd')) {
              spawn('cmd.exe', ['/c', 'start', '', target], { detached: true, stdio: 'ignore' }).unref();
            } else {
              spawn('cmd.exe', ['/c', 'start', '', target], { detached: true, stdio: 'ignore' }).unref();
            }

            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              success: true,
              message: `Launched ${target} successfully`,
            }));
            return;
          } catch (e) {
            res.statusCode = 500;
            res.end(JSON.stringify({ success: false, message: String(e) }));
            return;
          }
        }

        // 3. Set Desktop Wallpaper (URL, Local File, or Color)
        if (url === '/api/system/set-wallpaper' && req.method === 'POST') {
          try {
            const body = await parseJsonBody(req);
            const { url: wallUrl, color, name, path: filePath } = body;

            // A: Local file on Windows disk
            if (filePath && fs.existsSync(filePath)) {
              const safePath = filePath.replace(/"/g, '`"');
              const psCmd = `
                $dest = "${safePath}";
                Add-Type -TypeDefinition @"
                using System;
                using System.Runtime.InteropServices;
                public class Wallpaper {
                  [DllImport("user32.dll", CharSet = CharSet.Auto)]
                  public static extern int SystemParametersInfo(int uAction, int uParam, string lpvParam, int fuWinIni);
                }
"@;
                [Wallpaper]::SystemParametersInfo(0x0014, 0, $dest, 0x01 -bor 0x02);
              `;
              spawn('powershell.exe', ['-NoProfile', '-Command', psCmd], { detached: true, stdio: 'ignore' }).unref();
            }
            // B: HTTP/HTTPS web image URL
            else if (wallUrl && wallUrl.startsWith('http')) {
              const psCmd = `
                $url = "${wallUrl}";
                $dest = "$env:TEMP\\boty_wallpaper.jpg";
                Invoke-WebRequest -Uri $url -OutFile $dest -UseBasicParsing;
                Add-Type -TypeDefinition @"
                using System;
                using System.Runtime.InteropServices;
                public class Wallpaper {
                  [DllImport("user32.dll", CharSet = CharSet.Auto)]
                  public static extern int SystemParametersInfo(int uAction, int uParam, string lpvParam, int fuWinIni);
                }
"@;
                [Wallpaper]::SystemParametersInfo(0x0014, 0, $dest, 0x01 -bor 0x02);
              `;
              spawn('powershell.exe', ['-NoProfile', '-Command', psCmd], { detached: true, stdio: 'ignore' }).unref();
            }
            // C: Solid color
            else if (color) {
              const hexColor = color.startsWith('#') ? color : '#1a1a2e';
              const psColorCmd = `
                Add-Type -AssemblyName System.Drawing;
                $bmp = New-Object System.Drawing.Bitmap 1920, 1080;
                $gfx = [System.Drawing.Graphics]::FromImage($bmp);
                $col = [System.Drawing.ColorTranslator]::FromHtml('${hexColor}');
                $brush = New-Object System.Drawing.SolidBrush $col;
                $gfx.FillRectangle($brush, 0, 0, 1920, 1080);
                $dest = "$env:TEMP\\boty_wallpaper.bmp";
                $bmp.Save($dest, [System.Drawing.Imaging.ImageFormat]::Bmp);
                $gfx.Dispose();
                $bmp.Dispose();
                Add-Type -TypeDefinition @"
                using System;
                using System.Runtime.InteropServices;
                public class Wallpaper {
                  [DllImport("user32.dll", CharSet = CharSet.Auto)]
                  public static extern int SystemParametersInfo(int uAction, int uParam, string lpvParam, int fuWinIni);
                }
"@;
                [Wallpaper]::SystemParametersInfo(0x0014, 0, $dest, 0x01 -bor 0x02);
              `;
              spawn('powershell.exe', ['-NoProfile', '-Command', psColorCmd], { detached: true, stdio: 'ignore' }).unref();
            }

            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              success: true,
              message: `Wallpaper '${name || color || 'selected'}' applied to Windows desktop!`,
            }));
            return;
          } catch (e) {
            res.statusCode = 500;
            res.end(JSON.stringify({ success: false, message: String(e) }));
            return;
          }
        }

        // 3b. Fetch Real Recent Windows Wallpapers from Registry & System Themes
        if (url === '/api/system/recent-wallpapers' && req.method === 'GET') {
          try {
            const candidatePaths: string[] = [];

            // A: Query Windows Explorer Wallpapers registry for background history
            try {
              const regOut = execSync(
                'reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Wallpapers"',
                { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }
              );
              const lines = regOut.split(/\r?\n/);
              for (const line of lines) {
                const match = line.match(/(?:BackgroundHistoryPath\d+|CurrentWallpaperPath)\s+REG_SZ\s+(.+)$/i);
                if (match && match[1]) {
                  candidatePaths.push(match[1].trim());
                }
              }
            } catch {}

            // B: Query Desktop registry for current WallPaper
            try {
              const deskOut = execSync(
                'reg query "HKCU\\Control Panel\\Desktop" /v WallPaper',
                { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }
              );
              const m = deskOut.match(/WallPaper\s+REG_SZ\s+(.+)$/im);
              if (m && m[1]) {
                candidatePaths.push(m[1].trim());
              }
            } catch {}

            // C: Windows Themes directory
            const themesDir = path.join(os.homedir(), 'AppData', 'Roaming', 'Microsoft', 'Windows', 'Themes');
            if (fs.existsSync(themesDir)) {
              for (const f of fs.readdirSync(themesDir)) {
                if (f.toLowerCase().includes('wallpaper')) {
                  candidatePaths.push(path.join(themesDir, f));
                }
              }
            }

            // D: Windows default wallpapers folder
            const winWallDir = 'C:\\Windows\\Web\\Wallpaper';
            if (fs.existsSync(winWallDir)) {
              const walkDir = (dir: string) => {
                for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                  const p = path.join(dir, entry.name);
                  if (entry.isDirectory()) {
                    walkDir(p);
                  } else if (/\.(jpg|jpeg|png|webp|bmp)$/i.test(entry.name)) {
                    candidatePaths.push(p);
                  }
                }
              };
              try { walkDir(winWallDir); } catch {}
            }

            // Filter to existing files & deduplicate
            const seen = new Set<string>();
            const validWallpapers: any[] = [];
            for (const p of candidatePaths) {
              const norm = path.normalize(p);
              if (!seen.has(norm.toLowerCase()) && fs.existsSync(norm)) {
                seen.add(norm.toLowerCase());
                const baseName = path.basename(norm, path.extname(norm));
                let cleanLabel = baseName
                  .replace(/[-_]+/g, ' ')
                  .replace(/WallpaperEngineOverride/i, 'Theme Wallpaper')
                  .trim();
                if (!cleanLabel || cleanLabel.toLowerCase() === 'transcodedwallpaper') {
                  cleanLabel = 'Current Desktop Wallpaper';
                }

                validWallpapers.push({
                  id: `win-rec-${validWallpapers.length}`,
                  label: cleanLabel,
                  path: norm,
                  src: `/api/system/wallpaper-file?path=${encodeURIComponent(norm)}`,
                });
                if (validWallpapers.length >= 15) break;
              }
            }

            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ wallpapers: validWallpapers }));
            return;
          } catch (e) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: String(e), wallpapers: [] }));
            return;
          }
        }

        // 4. List Wallpapers from a Local Windows Folder
        if (url.startsWith('/api/system/list-folder-wallpapers') && req.method === 'GET') {
          try {
            const parsedUrl = new URL(url, 'http://localhost:1420');
            let targetFolder = parsedUrl.searchParams.get('folder');
            if (!targetFolder || targetFolder === 'default') {
              targetFolder = path.join(os.homedir(), 'Pictures');
            }

            if (!fs.existsSync(targetFolder)) {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ folder: targetFolder, wallpapers: [], error: 'Folder not found' }));
              return;
            }

            const files = fs.readdirSync(targetFolder);
            const validExts = new Set(['.jpg', '.jpeg', '.png', '.webp', '.bmp']);
            const wallpapers = files
              .filter(f => validExts.has(path.extname(f).toLowerCase()))
              .slice(0, 100)
              .map((f, i) => {
                const fullPath = path.join(targetFolder, f);
                return {
                  id: `f-${i}`,
                  label: path.basename(f, path.extname(f)),
                  path: fullPath,
                  src: `/api/system/wallpaper-file?path=${encodeURIComponent(fullPath)}`,
                };
              });

            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ folder: targetFolder, wallpapers }));
            return;
          } catch (e) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: String(e), wallpapers: [] }));
            return;
          }
        }

        // 5. Stream Local Wallpaper Image File
        if (url.startsWith('/api/system/wallpaper-file') && req.method === 'GET') {
          try {
            const parsedUrl = new URL(url, 'http://localhost:1420');
            const filePath = parsedUrl.searchParams.get('path');
            if (!filePath || !fs.existsSync(filePath)) {
              res.statusCode = 404;
              res.end('File not found');
              return;
            }

            const ext = path.extname(filePath).toLowerCase();
            const mimeMap: Record<string, string> = {
              '.jpg': 'image/jpeg',
              '.jpeg': 'image/jpeg',
              '.png': 'image/png',
              '.webp': 'image/webp',
              '.bmp': 'image/bmp',
            };
            res.setHeader('Content-Type', mimeMap[ext] || 'image/jpeg');
            res.setHeader('Cache-Control', 'public, max-age=86400');
            fs.createReadStream(filePath).pipe(res);
            return;
          } catch (e) {
            res.statusCode = 500;
            res.end(String(e));
            return;
          }
        }

        // 6. Native Windows Folder Browser Dialog Trigger
        if (url === '/api/system/pick-folder' && req.method === 'POST') {
          try {
            const psCmd = `
              [System.Reflection.Assembly]::LoadWithPartialName("System.windows.forms") | Out-Null;
              $f = New-Object System.Windows.Forms.FolderBrowserDialog;
              $f.Description = "Select Wallpaper Folder";
              $f.ShowNewFolderButton = $false;
              if ($f.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
                $f.SelectedPath
              }
            `;
            const child = spawn('powershell.exe', ['-NoProfile', '-Command', psCmd]);
            let out = '';
            child.stdout.on('data', d => { out += d; });
            child.on('close', () => {
              const selected = out.trim();
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ folder: selected || null }));
            });
            return;
          } catch (e) {
            res.statusCode = 500;
            res.end(JSON.stringify({ folder: null, error: String(e) }));
            return;
          }
        }

        // 7. System Controls (Volume, Brightness, Toggles)
        if (url === '/api/system/control' && req.method === 'POST') {
          try {
            const body = await parseJsonBody(req);

            if (body.type === 'volume') {
              const vol = Math.max(0, Math.min(100, Math.round(Number(body.volume) || 0)));
              const isMuted = Boolean(body.muted);
              const psVol = `
                Add-Type -TypeDefinition @"
                using System;
                using System.Runtime.InteropServices;
                [Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
                public interface IAudioEndpointVolume {
                    int f(); int g(); int h(); int j();
                    int SetMasterVolumeLevelScalar(float fLevel, System.Guid pguidEventContext);
                    int k();
                    int GetMasterVolumeLevelScalar(out float pfLevel);
                    int SetMute([MarshalAs(UnmanagedType.Bool)] bool bMute, System.Guid pguidEventContext);
                    int GetMute(out bool pbMute);
                }
                [Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
                public interface IMMDevice {
                    int Activate(ref System.Guid id, int clsCtx, int activationParams, out IAudioEndpointVolume aev);
                }
                [Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
                public interface IMMDeviceEnumerator {
                    int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice endpoint);
                }
                [ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
                public class MMDeviceEnumeratorComObject {}
                public class AudioMaster {
                    public static void SetVol(float val, bool mute) {
                        try {
                            var enumerator = (IMMDeviceEnumerator)(new MMDeviceEnumeratorComObject());
                            IMMDevice dev = null;
                            enumerator.GetDefaultAudioEndpoint(0, 1, out dev);
                            var IID_IAudioEndpointVolume = typeof(IAudioEndpointVolume).GUID;
                            IAudioEndpointVolume epv = null;
                            dev.Activate(ref IID_IAudioEndpointVolume, 23, 0, out epv);
                            epv.SetMasterVolumeLevelScalar(val, System.Guid.Empty);
                            epv.SetMute(mute, System.Guid.Empty);
                        } catch {}
                    }
                }
"@ -ErrorAction SilentlyContinue;
                [AudioMaster]::SetVol(${vol / 100.0}, $(${isMuted ? '$true' : '$false'}));
              `;
              spawn('powershell.exe', ['-NoProfile', '-Command', psVol], { detached: true, stdio: 'ignore' }).unref();
            } else if (body.type === 'brightness') {
              const b = Math.max(10, Math.min(100, Math.round(Number(body.brightness) || 50)));
              const psBright = `(Get-CimInstance -Namespace root/WMI -ClassName WmiMonitorBrightnessMethods -ErrorAction SilentlyContinue).WmiSetBrightness(1, ${b})`;
              spawn('powershell.exe', ['-NoProfile', '-Command', psBright], { detached: true, stdio: 'ignore' }).unref();
            } else if (body.type === 'toggle' && body.key === 'darkMode') {
              const val = body.value ? 0 : 1;
              const psDark = `Set-ItemProperty -Path HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize -Name AppsUseLightTheme -Value ${val} -ErrorAction SilentlyContinue`;
              spawn('powershell.exe', ['-NoProfile', '-Command', psDark], { detached: true, stdio: 'ignore' }).unref();
            }

            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true }));
            return;
          } catch (e) {
            res.statusCode = 500;
            res.end(JSON.stringify({ success: false, error: String(e) }));
            return;
          }
        }

        next();
      });
    },
  };
}
