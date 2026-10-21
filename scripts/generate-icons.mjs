import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const buildDir = path.resolve("build");
if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir, { recursive: true });
}

// 1. Create a beautiful SVG for Zentube
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1e1e1e"/>
      <stop offset="100%" stop-color="#0a0a0a"/>
    </linearGradient>
    <linearGradient id="tubeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ff3333"/>
      <stop offset="100%" stop-color="#cc0000"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="16" stdDeviation="24" flood-color="#ff0000" flood-opacity="0.35"/>
    </filter>
    <filter id="subtle" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="8" stdDeviation="16" flood-color="#000000" flood-opacity="0.6"/>
    </filter>
  </defs>

  <!-- App Rounded Squircle Background -->
  <rect x="64" y="64" width="896" height="896" rx="224" fill="url(#bg)" stroke="#2f2f2f" stroke-width="12" filter="url(#subtle)"/>

  <!-- Zen Enso / Concentric Learning Orbit -->
  <circle cx="512" cy="512" r="320" fill="none" stroke="#2a2a2a" stroke-width="16" stroke-dasharray="80 30 160 40 240 50"/>
  <circle cx="512" cy="512" r="280" fill="none" stroke="#ff0000" stroke-width="8" stroke-opacity="0.3" stroke-dasharray="140 60 80 40"/>

  <!-- YouTube-Style Center Plaque -->
  <rect x="272" y="332" width="480" height="360" rx="90" fill="url(#tubeGrad)" filter="url(#shadow)"/>

  <!-- Play Symbol (Zen White) -->
  <polygon points="452,432 452,592 612,512" fill="#ffffff"/>
</svg>`;

const svgPath = path.join(buildDir, "icon.svg");
fs.writeFileSync(svgPath, svgContent);

// Helper script to render SVG to 1024x1024 PNG via Electron headless
const renderScript = `
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1024,
    height: 1024,
    show: false,
    frame: false,
    transparent: true,
    webPreferences: { offscreen: true }
  });

  const svgDataUri = 'data:image/svg+xml;base64,' + Buffer.from(\`${svgContent.replace(/`/g, "\\`")}\`).toString('base64');
  await win.loadURL(svgDataUri);
  await new Promise(r => setTimeout(r, 600));

  const image = await win.webContents.capturePage({ x: 0, y: 0, width: 1024, height: 1024 });
  fs.writeFileSync(path.resolve('build/icon.png'), image.toPNG());
  app.quit();
});
`;

const tempRenderFile = path.resolve("build/_render_icon.js");
fs.writeFileSync(tempRenderFile, renderScript);

console.log("Rendering 1024x1024 master icon via Electron...");
execSync(`npx electron ${tempRenderFile}`, { stdio: "inherit" });
fs.unlinkSync(tempRenderFile);

console.log("Generated build/icon.png");

// 2. If on macOS, generate native .icns using sips + iconutil
if (process.platform === "darwin") {
  try {
    const iconset = path.join(buildDir, "icon.iconset");
    if (fs.existsSync(iconset)) {
      fs.rmSync(iconset, { recursive: true, force: true });
    }
    fs.mkdirSync(iconset, { recursive: true });

    const sizes = [16, 32, 64, 128, 256, 512];
    for (const s of sizes) {
      const out1 = path.join(iconset, "icon_" + s + "x" + s + ".png");
      const out2 = path.join(iconset, "icon_" + s + "x" + s + "@2x.png");
      execSync(`sips -z ${s} ${s} "${path.join(buildDir, "icon.png")}" --out "${out1}"`, { stdio: "ignore" });
      execSync(`sips -z ${s * 2} ${s * 2} "${path.join(buildDir, "icon.png")}" --out "${out2}"`, { stdio: "ignore" });
    }

    execSync(`iconutil -c icns "${iconset}" -o "${path.join(buildDir, "icon.icns")}"`, { stdio: "ignore" });
    fs.rmSync(iconset, { recursive: true, force: true });
    console.log("Generated build/icon.icns for macOS");
  } catch (err) {
    console.warn("Could not generate .icns:", err.message);
  }
}

// 3. Generate Windows .ico (multi-frame PNG format inside ICO envelope)
function createIco(pngBuffers, sizes) {
  // ICO header: 2 bytes reserved (0), 2 bytes type (1 for ico), 2 bytes image count
  const count = pngBuffers.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);

  const dirEntries = [];
  let offset = 6 + count * 16;

  for (let i = 0; i < count; i++) {
    const buf = pngBuffers[i];
    const s = sizes[i];
    const entry = Buffer.alloc(16);
    entry.writeUInt8(s >= 256 ? 0 : s, 0); // width
    entry.writeUInt8(s >= 256 ? 0 : s, 1); // height
    entry.writeUInt8(0, 2); // color palette
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(buf.length, 8); // image size
    entry.writeUInt32LE(offset, 12); // image offset
    dirEntries.push(entry);
    offset += buf.length;
  }

  return Buffer.concat([header, ...dirEntries, ...pngBuffers]);
}

try {
  // Resample sizes for ICO
  const icoSizes = [16, 24, 32, 48, 64, 128, 256];
  const pngBuffers = [];
  const masterPng = path.join(buildDir, "icon.png");

  for (const size of icoSizes) {
    const tmp = path.join(buildDir, `_tmp_${size}.png`);
    if (process.platform === "darwin") {
      execSync(`sips -z ${size} ${size} ${masterPng} --out ${tmp}`, { stdio: "ignore" });
      pngBuffers.push(fs.readFileSync(tmp));
      fs.unlinkSync(tmp);
    }
  }

  if (pngBuffers.length > 0) {
    const icoBuf = createIco(pngBuffers, icoSizes);
    fs.writeFileSync(path.join(buildDir, "icon.ico"), icoBuf);
    console.log("Generated build/icon.ico for Windows");
  }
} catch (err) {
  console.warn("Could not generate .ico:", err.message);
}
