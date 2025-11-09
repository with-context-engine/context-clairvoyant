import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import dotenv from "dotenv";
import { defineConfig, loadEnv } from "vite";

dotenv.config();

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), "");
	const apiPort = process.env.PORT || "3001";
	const apiTarget = `http://localhost:${apiPort}`;
	return {
		plugins: [react(), tailwindcss()],
		root: "src/frontend",
		server: {
			port: 5173,
			allowedHosts: ["with-context-engine.ngrok.dev"],
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
		},
	};
});
