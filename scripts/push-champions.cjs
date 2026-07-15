#!/usr/bin/env node

const fs = require("fs");

const API_BASE = "https://origami-champions-api.contact-youos.workers.dev";

async function pushLineage(token, record) {
  if (!record.lineageId) {
    console.error("Skipping a file with no lineageId field (not a lineage export)");
    return;
  }

  const res = await fetch(`${API_BASE}/lineages/${record.lineageId}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      projectName: record.projectName ?? "Unnamed Project",
      generation: record.generation ?? 1,
      payload: record,
    }),
  });

  if (res.status === 200) {
    const body = await res.json();
    console.log(`OK   ${record.projectName} -> generation ${body.generation}`);
  } else if (res.status === 409) {
    console.log(`SKIP ${record.projectName} -> cloud already has an equal/newer generation`);
  } else {
    console.error(`FAIL ${record.projectName} -> ${res.status} ${await res.text()}`);
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
  await pushLineage(token, record);
}

main();
