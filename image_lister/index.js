"use strict";

const fs = require("fs");
const path = require("path");

const assetsDir = path.join(__dirname, "..", "assets");
const outputPath = path.join(__dirname, "images.json");

// Supported image extensions (case-insensitive)
const allowedExtensions = new Set([".png", ".webp", ".jpg", ".jpeg", ".gif"]);

// Collected results
const images = [];

/**
 * Check if a file name matches one of the allowed image extensions.
 * @param {string} filename
 * @returns {boolean}
 */
function isImageFile(filename) {
  const ext = path.extname(filename).toLowerCase();
  return allowedExtensions.has(ext);
}

/**
 * Recursively walk a category directory and push image entries.
 *
 * - category: the top-level folder under assets
 * - currentPath: the absolute path currently being walked
 * - relativeSubPath: the path relative to the category (may be "" for direct children)
 *
 * @param {string} category
 * @param {string} currentPath
 * @param {string} relativeSubPath
 */
function walkCategory(category, currentPath, relativeSubPath = "") {
  const entries = fs.readdirSync(currentPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(currentPath, entry.name);

    if (entry.isDirectory()) {
      // Build the next relative sub-path using POSIX-style separators for consistency
      const nextRel = relativeSubPath
        ? `${relativeSubPath}/${entry.name}`
        : entry.name;
      walkCategory(category, fullPath, nextRel);
    } else if (entry.isFile()) {
      if (isImageFile(entry.name)) {
        images.push({
          category,
          subcategory: relativeSubPath, // multi-level relative path under the category ("" if at category root)
          filename: entry.name,
        });
      }
    }
  }
}

/**
 * Main entry: traverse all top-level category directories under assets and write images.json
 */
function main() {
  try {
    const categoryEntries = fs.readdirSync(assetsDir, { withFileTypes: true });

    for (const entry of categoryEntries) {
      if (entry.isDirectory()) {
        const categoryName = entry.name;
        const categoryPath = path.join(assetsDir, categoryName);
        walkCategory(categoryName, categoryPath, "");
      }
    }

    fs.writeFileSync(outputPath, JSON.stringify(images, null, 2));
    console.log(
      `JSON file created at ${outputPath} with ${images.length} images listed.`,
    );
  } catch (error) {
    console.error("Error traversing directories:", error);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}
