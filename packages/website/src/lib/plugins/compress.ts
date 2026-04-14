import type { AstroIntegration } from "astro";
import { minify } from "html-minifier-terser";
import { optimize } from "svgo";

import { createHash } from "crypto";
import {
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "fs";
import { join } from "path";
import { fileURLToPath } from "url";


interface CompressOptions {
  cacheDir?: string;
  html?: Parameters<typeof minify>[1];
  svg?: Parameters<typeof optimize>[1];
}

interface CacheEntry {
  sourceHash: string;
  compressedPath: string;
  settingsHash: string;
  size: { original: number; compressed: number };
}

interface CacheManifest {
  version: string;
  entries: Record<string, CacheEntry | undefined>;
}

function walkDirectory(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkDirectory(fullPath));
    } else {
      results.push(fullPath);
    }
  }
  return results;
}

function sha256(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

export default function compress(
  options: CompressOptions = {},
): AstroIntegration {
  const cacheDir = options.cacheDir ?? ".astro-compress";
  const htmlOptions = {
    collapseWhitespace: true,
    // Do NOT set removeComments: true — SolidJS uses HTML comment nodes
    // (e.g. <!--$-->, <!--/-->, <!--!-->) as hydration markers. Stripping
    // them causes "can't access property 'nextSibling', o is null" at runtime.
    removeComments: false,
    minifyCSS: true,
    minifyJS: true,
    continueOnParseError: true,
    ...options.html,
  };
  const svgOptions = {
    multipass: true,
    ...options.svg,
  };
  const htmlSettingsHash = sha256(JSON.stringify(htmlOptions));
  const svgSettingsHash = sha256(JSON.stringify(svgOptions));

  let resolvedCacheDir: string;
  let manifest: CacheManifest = { version: "1", entries: {} };

  function loadManifest() {
    try {
      const content = readFileSync(
        join(resolvedCacheDir, "manifest.json"),
        "utf-8",
      );
      manifest = JSON.parse(content) as CacheManifest;
    } catch {
      manifest = { version: "1", entries: {} };
    }
  }

  function saveManifest() {
    writeFileSync(
      join(resolvedCacheDir, "manifest.json"),
      JSON.stringify(manifest, null, 2),
    );
  }

  function removeCacheEntry(filePath: string, entry: CacheEntry) {
    try {
      unlinkSync(entry.compressedPath);
    } catch {
      // File may already be gone
    }
    manifest.entries[filePath] = undefined;
  }

  function getCached(
    filePath: string,
    sourceHash: string,
    settingsHash: string,
  ): CacheEntry | null {
    const entry = manifest.entries[filePath];
    if (!entry) return null;

    if (
      entry.sourceHash !== sourceHash ||
      entry.settingsHash !== settingsHash
    ) {
      removeCacheEntry(filePath, entry);
      return null;
    }

    try {
      statSync(entry.compressedPath);
      return entry;
    } catch {
      removeCacheEntry(filePath, entry);
      return null;
    }
  }

  function saveToCache(
    filePath: string,
    sourceHash: string,
    originalSize: number,
    compressedContent: string,
    settingsHash: string,
  ) {
    const ext = filePath.split(".").pop() ?? "";
    const cachedPath = join(resolvedCacheDir, `${sourceHash}.${ext}`);
    writeFileSync(cachedPath, compressedContent, "utf-8");
    manifest.entries[filePath] = {
      sourceHash,
      compressedPath: cachedPath,
      settingsHash,
      size: {
        original: originalSize,
        compressed: compressedContent.length,
      },
    };
  }

  return {
    name: "compress",
    hooks: {
      "astro:config:done": ({ config }) => {
        resolvedCacheDir = join(fileURLToPath(config.root), cacheDir);
        mkdirSync(resolvedCacheDir, { recursive: true });
        loadManifest();
      },
      "astro:build:done": async ({ dir, logger }) => {
        const dirPath = fileURLToPath(dir);
        logger.info(`Output directory: ${dirPath}`);
        const files = walkDirectory(dirPath);

        let processed = 0;
        let cacheHits = 0;
        let totalOriginal = 0;
        let totalCompressed = 0;

        const htmlFiles: string[] = [];
        const svgFiles: string[] = [];
        for (const file of files) {
          if (/\.html?$/i.test(file)) htmlFiles.push(file);
          else if (/\.svg$/i.test(file)) svgFiles.push(file);
        }

        logger.info(`Found ${htmlFiles.length} HTML and ${svgFiles.length} SVG files`);

        // Process SVGs sequentially (few files, fast)
        for (const file of svgFiles) {
          const prettyPath = file.replace(dirPath, "");
          const content = readFileSync(file, "utf-8");
          const sourceHash = sha256(content);
          const cached = getCached(file, sourceHash, svgSettingsHash);
          if (cached) {
            writeFileSync(
              file,
              readFileSync(cached.compressedPath, "utf-8"),
            );
            totalOriginal += cached.size.original;
            totalCompressed += cached.size.compressed;
            cacheHits++;
            continue;
          }
          try {
            const result = optimize(content, { path: file, ...svgOptions });
            if (result.data.length < content.length) {
              writeFileSync(file, result.data);
              saveToCache(
                file,
                sourceHash,
                content.length,
                result.data,
                svgSettingsHash,
              );
              totalOriginal += content.length;
              totalCompressed += result.data.length;
              processed++;
              logger.info(`SVG ${prettyPath}: ${content.length} -> ${result.data.length} bytes`);
            } else {
              saveToCache(
                file,
                sourceHash,
                content.length,
                content,
                svgSettingsHash,
              );
            }
          } catch (err: unknown) {
            logger.warn(
              `SVG optimization failed for ${prettyPath}: ${String(err)}`,
            );
          }
        }

        logger.info(`SVG pass complete: ${processed} compressed, ${cacheHits} cached`);

        // Process HTML files sequentially to avoid race conditions
        let htmlDone = 0;
        const htmlTotal = htmlFiles.length;
        const logInterval = Math.max(1, Math.floor(htmlTotal / 10));

        for (const file of htmlFiles) {
          const prettyPath = file.replace(dirPath, "");
          const content = readFileSync(file, "utf-8");
          const sourceHash = sha256(content);
          const cached = getCached(file, sourceHash, htmlSettingsHash);
          if (cached) {
            writeFileSync(
              file,
              readFileSync(cached.compressedPath, "utf-8"),
            );
            totalOriginal += cached.size.original;
            totalCompressed += cached.size.compressed;
            cacheHits++;
            htmlDone++;
            if (htmlDone % logInterval === 0) {
              logger.info(`HTML progress: ${htmlDone}/${htmlTotal} (${cacheHits} cached)`);
            }
            continue;
          }
          try {
            const result = await minify(content, htmlOptions);
            if (result.length < content.length) {
              writeFileSync(file, result);
              saveToCache(
                file,
                sourceHash,
                content.length,
                result,
                htmlSettingsHash,
              );
              totalOriginal += content.length;
              totalCompressed += result.length;
              processed++;
            } else {
              saveToCache(
                file,
                sourceHash,
                content.length,
                content,
                htmlSettingsHash,
              );
            }
          } catch (err: unknown) {
            logger.warn(
              `HTML minification failed for ${prettyPath}: ${String(err)}`,
            );
          }
          htmlDone++;
          if (htmlDone % logInterval === 0) {
            logger.info(`HTML progress: ${htmlDone}/${htmlTotal} (${cacheHits} cached)`);
          }
        }

        saveManifest();

        const savedKB = ((totalOriginal - totalCompressed) / 1024).toFixed(0);
        logger.info(
          `Done: ${processed} compressed, ${cacheHits} cached. ` +
            `${(totalOriginal / 1024).toFixed(0)} KB -> ${(totalCompressed / 1024).toFixed(0)} KB (saved ${savedKB} KB)`,
        );
      },
    },
  };
}
