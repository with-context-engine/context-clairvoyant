import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), "");
	const rootEnv = loadEnv(mode, path.resolve(__dirname, "../.."), "");
	const apiPort = process.env.PORT || "3001";
	const apiTarget = `http://localhost:${apiPort}`;
	return {
		plugins: [react(), tailwindcss()],
		resolve: {
			alias: {
				"@": path.resolve(__dirname, "src"),
				"@convex": path.resolve(__dirname, "../../packages/convex"),
				"@clairvoyant/api": path.resolve(__dirname, "../api/src/index.ts"),
			},
			dedupe: ["elysia"],
		},
		server: {
			port: 5173,
			allowedHosts: [env.NGROK_WEB_DOMAIN || rootEnv.NGROK_WEB_DOMAIN || "localhost"],
			proxy: {
				"/api": {
					target: apiTarget,
					changeOrigin: true,
				},
				"/.well-known": {
					target: apiTarget,
					changeOrigin: true,
				},
			},
		},
		define: {
			"import.meta.env.VITE_CONVEX_URL": JSON.stringify(env.VITE_CONVEX_URL),
			"import.meta.env.VITE_API_BASE_URL": JSON.stringify(
				env.VITE_API_BASE_URL,
			),
		},
	};
});
