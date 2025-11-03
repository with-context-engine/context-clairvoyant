import { MentraAuthProvider } from "@mentra/react";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

const rootElement = document.getElementById("root");
if (!rootElement) {
	throw new Error("Root element not found");
}

createRoot(rootElement).render(
	<StrictMode>
		<ConvexProvider client={convex}>
			<MentraAuthProvider>
				<App />
			</MentraAuthProvider>
		</ConvexProvider>
	</StrictMode>,
);
