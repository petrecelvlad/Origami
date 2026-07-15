#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const JSZip = require("jszip");

const API_BASE = "https://origami-champions-api.contact-youos.workers.dev";

async function loadCreaturesFromZip(zipPath) {
  const buffer = fs.readFileSync(zipPath);
  const zip = await JSZip.loadAsync(buffer);
  const creatures = [];
  for (const filename of Object.keys(zip.files)) {
    if (filename.endsWith(".json")) {
      const content = await zip.files[filename].async("string");
      creatures.push(JSON.parse(content));
    }
  }
  return creatures;
}

function loadCreaturesFromDir(dirPath) {
  return fs
    .readdirSync(dirPath)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(fs.readFileSync(path.join(dirPath, f), "utf8")));
}

async function pushChampion(token, creature) {
  const family = creature.family;
  if (!family) {
    console.error("Skipping a creature with no family field (malformed export)");
    return;
  }

  const res = await fetch(`${API_BASE}/champions/${family}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      generation: creature.neuralGenome?.meta?.lineageGeneration ?? creature.generation ?? 1,
      fitness: creature.fitness ?? 0,
      payload: creature,
    }),
  });

  if (res.status === 200) {
    const body = await res.json();
    console.log(`OK   ${family} -> generation ${body.generation}`);
  } else if (res.status === 409) {
    console.log(`SKIP ${family} -> cloud already has an equal/newer generation`);
  } else {
    console.error(`FAIL ${family} -> ${res.status} ${await res.text()}`);
  }
}

async function main() {
  const input = process.argv[2];
  const token = process.env.API_TOKEN;

  if (!input) {
    console.error("Usage: API_TOKEN=your-token npm run push-champions -- <path-to-batch.zip-or-json-dir>");
    process.exit(1);
  }
  if (!token) {
    console.error("Missing API_TOKEN environment variable.");
    console.error("  PowerShell: $env:API_TOKEN=\"your-token\"; npm run push-champions -- <path>");
    console.error("  Bash:       API_TOKEN=your-token npm run push-champions -- <path>");
    process.exit(1);
  }

  const stat = fs.statSync(input);
  const creatures = stat.isDirectory() ? loadCreaturesFromDir(input) : await loadCreaturesFromZip(input);

  if (creatures.length === 0) {
    console.error("No creature JSON files found at the given path.");
    process.exit(1);
  }

  for (const creature of creatures) {
    await pushChampion(token, creature);
  }
}

main();
