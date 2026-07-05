#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const BUNDLE_ROOT = path.resolve(__dirname, "..", "cone");
const RESERVED = new Set(["index.md", "log.md"]);

let errors = 0;
let warnings = 0;
let concepts = 0;

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
    } else if (entry.name.endsWith(".md")) {
      if (RESERVED.has(entry.name)) {
        lintIndex(full);
      } else {
        lintConcept(full);
      }
    }
  }
}

function rel(filepath) {
  return path.relative(BUNDLE_ROOT, filepath).replace(/\\/g, "/");
}

function parseFrontmatter(content) {
  if (!content.startsWith("---")) return null;
  const end = content.indexOf("\n---", 3);
  if (end === -1) return null;
  const yaml = content.slice(4, end);
  const fields = {};
  for (const line of yaml.split("\n")) {
    const match = line.match(/^(\w[\w_]*)\s*:\s*(.+)/);
    if (match) fields[match[1]] = match[2].trim();
  }
  return { fields, raw: yaml };
}

function stripCodeBlocks(content) {
  return content.replace(/```[\s\S]*?```/g, "");
}

function extractLinks(content, docDir) {
  const stripped = stripCodeBlocks(content);
  const links = [];
  const re = /\]\(([^)\s]+\.md)(?:#[A-Za-z0-9_-]*)?\)/g;
  let m;
  while ((m = re.exec(stripped)) !== null) {
    const target = m[1];
    if (target.includes("://")) continue;
    const resolved = path.resolve(docDir, target);
    links.push({ target, resolved, offset: m.index });
  }
  return links;
}

function lintConcept(filepath) {
  const content = fs.readFileSync(filepath, "utf-8");
  const r = rel(filepath);
  const fm = parseFrontmatter(content);

  if (!fm) {
    console.error(`ERROR  ${r}: missing YAML frontmatter`);
    errors++;
    return;
  }

  if (!fm.fields.type) {
    console.error(`ERROR  ${r}: frontmatter missing required 'type' field`);
    errors++;
  }

  concepts++;

  const links = extractLinks(content, path.dirname(filepath));
  for (const link of links) {
    if (!fs.existsSync(link.resolved)) {
      console.warn(`WARN   ${r}: broken link to '${link.target}'`);
      warnings++;
    }
  }
}

function lintIndex(filepath) {
  const content = fs.readFileSync(filepath, "utf-8");
  const r = rel(filepath);

  if (content.startsWith("---")) {
    const isRoot =
      path.dirname(filepath) === BUNDLE_ROOT && content.includes("okf_version");
    if (!isRoot) {
      console.warn(
        `WARN   ${r}: index.md should not have frontmatter (reserved file)`
      );
      warnings++;
    }
  }

  const links = extractLinks(content, path.dirname(filepath));
  for (const link of links) {
    if (!fs.existsSync(link.resolved)) {
      console.warn(`WARN   ${r}: broken link to '${link.target}'`);
      warnings++;
    }
  }
}

walk(BUNDLE_ROOT);

console.log(
  `\n${concepts} concepts, ${errors} error(s), ${warnings} warning(s)`
);
process.exit(errors > 0 ? 1 : 0);
