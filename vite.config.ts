import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), "");
	return {
		plugins: [react()],
		root: "src/frontend",
		server: {
			port: 5173,
			allowedHosts: ["with-context-engine.ngrok.dev"],
			proxy: {
				"/api": {
					target: "http://localhost:3001",
					changeOrigin: true,
				},
			},
		},
		define: {
			"import.meta.env.VITE_CONVEX_URL": JSON.stringify(env.VITE_CONVEX_URL),
		},
	};
});
