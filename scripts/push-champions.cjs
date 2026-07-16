#!/usr/bin/env node

const fs = require("fs");

const API_BASE = "https://origami-champions-api.contact-youos.workers.dev";

async function pushLineageShell(token, record) {
  const { champions, ...shell } = record;
  const res = await fetch(`${API_BASE}/lineages/${record.lineageId}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      projectName: record.projectName ?? "Unnamed Project",
      generation: record.generation ?? 1,
      payload: shell,
    }),
  });

  if (res.status === 200) {
    console.log(`OK   lineage shell (${record.projectName}) -> generation ${record.generation}`);
    return true;
  }
  if (res.status === 409) {
    console.log(`SKIP lineage shell (${record.projectName}) -> cloud already has an equal/newer generation`);
    return false;
  }
  console.error(`FAIL lineage shell (${record.projectName}) -> ${res.status} ${await res.text()}`);
  return false;
}

async function pushChampion(token, lineageId, champion) {
  const res = await fetch(`${API_BASE}/lineages/${lineageId}/champions/${champion.family}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      generation: champion.generation ?? 1,
      fitness: champion.fitness ?? 0,
      payload: champion,
    }),
  });

  if (res.status === 200) {
    console.log(`OK   ${champion.family} -> generation ${champion.generation}`);
  } else if (res.status === 409) {
    console.log(`SKIP ${champion.family} -> cloud already has an equal/newer generation`);
  } else {
    console.error(`FAIL ${champion.family} -> ${res.status} ${await res.text()}`);
  }
}

async function main() {
  const input = process.argv[2];
  const token = process.env.API_TOKEN;

  if (!input) {
    console.error("Usage: API_TOKEN=your-token npm run push-champions -- <path-to-lineage.json>");
    process.exit(1);
  }
  if (!token) {
    console.error("Missing API_TOKEN environment variable.");
    console.error("  PowerShell: $env:API_TOKEN=\"your-token\"; npm run push-champions -- <path>");
    console.error("  Bash:       API_TOKEN=your-token npm run push-champions -- <path>");
    process.exit(1);
  }

  const record = JSON.parse(fs.readFileSync(input, "utf8"));
  if (!record.lineageId) {
    console.error("Not a lineage export (missing lineageId field).");
    process.exit(1);
  }

  await pushLineageShell(token, record);
  for (const champion of record.champions ?? []) {
    await pushChampion(token, record.lineageId, champion);
  }
}

main();
