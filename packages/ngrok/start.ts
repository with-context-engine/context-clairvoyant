#!/usr/bin/env bun

import { spawn } from "bun";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const apiDomain = process.env.NGROK_API_DOMAIN;
const webDomain = process.env.NGROK_WEB_DOMAIN;
const appDomain = process.env.NGROK_APP_DOMAIN;
const authtoken = process.env.NGROK_AUTHTOKEN;

if (!authtoken) {
	console.error("❌ NGROK_AUTHTOKEN is not set in .env.local");
	process.exit(1);
}

if (!apiDomain || !webDomain || !appDomain) {
	console.error("❌ Missing ngrok domain env vars. Set these in .env.local:");
	console.error("   NGROK_API_DOMAIN, NGROK_WEB_DOMAIN, NGROK_APP_DOMAIN");
	process.exit(1);
}

const apiPort = process.env.API_PORT || "3000";
const webPort = process.env.WEB_PORT || "5173";
const appPort = process.env.APP_PORT || "3002";

const configYaml = `version: "3"
tunnels:
  api:
    proto: http
    addr: ${apiPort}
    url: https://${apiDomain}
  web:
    proto: http
    addr: ${webPort}
    url: https://${webDomain}
  app:
    proto: http
    addr: ${appPort}
    url: https://${appDomain}
`;

const tmpDir = await mkdtemp(join(tmpdir(), "ngrok-"));
const configPath = join(tmpDir, "ngrok.yml");
await writeFile(configPath, configYaml);

console.log("🚇 Starting ngrok tunnels...\n");
console.log(`  api: https://${apiDomain} → localhost:${apiPort}`);
console.log(`  web: https://${webDomain} → localhost:${webPort}`);
console.log(`  app: https://${appDomain} → localhost:${appPort}`);
console.log("\n✅ All tunnels starting. Press Ctrl+C to stop.\n");

const proc = spawn({
	cmd: ["ngrok", "start", "--all", "--config", configPath, "--authtoken", authtoken, "--log", "stdout", "--log-format", "term"],
	stdout: "inherit",
	stderr: "inherit",
	env: { ...process.env, NGROK_CONSOLE_UI_COLOR: "transparent" },
});

const cleanup = async () => {
	proc.kill();
	await rm(tmpDir, { recursive: true, force: true });
	process.exit(0);
};

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);

await proc.exited;
await rm(tmpDir, { recursive: true, force: true });
