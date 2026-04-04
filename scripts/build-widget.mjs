import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const srcDir = resolve(rootDir, "src");
const distDir = resolve(rootDir, "dist");
const publicDir = resolve(rootDir, "public");

const widgetJsPath = resolve(srcDir, "widget.js");
const widgetCssPath = resolve(srcDir, "widget.css");
const demoHtmlPath = resolve(publicDir, "demo.html");

await mkdir(distDir, { recursive: true });

const [widgetJs, widgetCss, demoHtml] = await Promise.all([
  readFile(widgetJsPath, "utf8"),
  readFile(widgetCssPath, "utf8"),
  readFile(demoHtmlPath, "utf8"),
]);

const bundledJs = widgetJs.replace(
  "__WIDGET_CSS__",
  JSON.stringify(widgetCss),
);

await Promise.all([
  writeFile(resolve(distDir, "widget.js"), bundledJs),
  writeFile(resolve(distDir, "widget.css"), widgetCss),
  writeFile(resolve(distDir, "demo.html"), demoHtml),
  copyFile(resolve(rootDir, "README.md"), resolve(distDir, "README.md")).catch(
    () => undefined,
  ),
]);

console.log("Built widget assets into dist/.");
