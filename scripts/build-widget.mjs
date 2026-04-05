import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const srcDir = resolve(rootDir, "src");
const distDir = resolve(rootDir, "dist");
const publicDir = resolve(rootDir, "public");

const widgetJsPath = resolve(srcDir, "widget.js");
const widgetCssPath = resolve(srcDir, "widget.css");
const demoHtmlPath = resolve(publicDir, "demo.html");
const packageJsonPath = resolve(rootDir, "package.json");

await mkdir(distDir, { recursive: true });

const [widgetJs, widgetCss, demoHtml, packageJsonRaw] = await Promise.all([
  readFile(widgetJsPath, "utf8"),
  readFile(widgetCssPath, "utf8"),
  readFile(demoHtmlPath, "utf8"),
  readFile(packageJsonPath, "utf8"),
]);

const bundledJs = widgetJs.replace(
  "__WIDGET_CSS__",
  JSON.stringify(widgetCss),
);
const packageJson = JSON.parse(packageJsonRaw);
const version = String(packageJson.version || "0.0.0");
const widgetHash = createHash("sha256").update(bundledJs).digest("hex").slice(0, 16);
const cssHash = createHash("sha256").update(widgetCss).digest("hex").slice(0, 16);
const versionedJsName = `widget.v${version}.${widgetHash}.js`;
const versionedCssName = `widget.v${version}.${cssHash}.css`;

const manifest = {
  contractVersion: "1.0.0",
  packageName: packageJson.name,
  packageVersion: version,
  files: {
    widgetJs: {
      latest: "widget.js",
      versioned: versionedJsName,
      integritySha256: widgetHash,
    },
    widgetCss: {
      latest: "widget.css",
      versioned: versionedCssName,
      integritySha256: cssHash,
    },
    demoHtml: "demo.html",
  },
};

await Promise.all([
  writeFile(resolve(distDir, "widget.js"), bundledJs),
  writeFile(resolve(distDir, versionedJsName), bundledJs),
  writeFile(resolve(distDir, "widget.css"), widgetCss),
  writeFile(resolve(distDir, versionedCssName), widgetCss),
  writeFile(resolve(distDir, "demo.html"), demoHtml),
  writeFile(resolve(distDir, "manifest.json"), JSON.stringify(manifest, null, 2)),
  copyFile(resolve(rootDir, "README.md"), resolve(distDir, "README.md")).catch(
    () => undefined,
  ),
]);

console.log(
  `Built widget assets into dist/ (widget.js, ${versionedJsName}, widget.css, ${versionedCssName}, manifest.json).`,
);
