#!/usr/bin/env bun

/**
 * Dev script that runs all four dev processes in tmux panes
 * Press Ctrl+B then arrow keys to switch between panes
 * Press Ctrl+B then X to close a pane
 * Press Ctrl+B then D to detach (processes keep running)
 */

import { $ } from "bun";

const tmuxSessionName = "clairvoyant-dev";

// Check if tmux is available
const hasTmux = await $`which tmux`
	.quiet()
	.then(() => true)
	.catch(() => false);

if (!hasTmux) {
	console.error("❌ tmux not found.");
	console.error("Please install tmux: brew install tmux");
	process.exit(1);
}

// Check if session already exists
const sessionExists =
	await $`tmux has-session -t ${tmuxSessionName} 2>/dev/null`
		.quiet()
		.then(() => true)
		.catch(() => false);

if (sessionExists) {
	console.log(`⚠️  tmux session "${tmuxSessionName}" already exists`);
	console.log("Attaching to existing session...");
	await $`tmux attach-session -t ${tmuxSessionName}`;
	process.exit(0);
}

// Create new tmux session with 4 panes (split horizontally then vertically)
console.log("🚀 Starting all dev servers in tmux...");
console.log("");
console.log("📖 Controls:");
console.log("  • Ctrl+B then ←→↑↓ to switch panes");
console.log("  • Ctrl+B then X to close current pane");
console.log("  • Ctrl+B then D to detach (keeps running)");
console.log("  • tmux attach -t clairvoyant-dev to reattach");
console.log("");

// Create session with first pane (main server)
await $`tmux new-session -d -s ${tmuxSessionName} -n "dev" "echo '🚀 Main Server' && bun --watch src/index.ts"`;

// Split horizontally (creates left/right split)
await $`tmux split-window -h -t ${tmuxSessionName} "echo '🚀 API Server' && bun --watch src/api.ts"`;

// Split vertically in the right pane (creates top-right and bottom-right)
await $`tmux split-window -v -t ${tmuxSessionName}:dev.1 "echo '🚀 Frontend Dev Server' && bun run vite"`;

// Split vertically in the left pane (creates top-left and bottom-left)
await $`tmux split-window -v -t ${tmuxSessionName}:dev.0 "echo '🚀 Convex Dev Server' && bun run convex dev"`;

// Select tiled layout (automatically arranges all panes nicely)
await $`tmux select-layout -t ${tmuxSessionName} tiled`;

// Attach to session
await $`tmux attach-session -t ${tmuxSessionName}`;
