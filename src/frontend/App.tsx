import { useMentraAuth } from "@mentra/react";
import { ConvexProvider } from "convex/react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import type { Id } from "../../convex/_generated/dataModel";
import { BillingPage } from "./components/BillingPage";
import { HomePage } from "./components/HomePage";
import { NavBar } from "./components/NavBar";
import { SettingsPage } from "./components/SettingsPage";
import { useConvexAuth } from "./hooks/useConvexAuth";

export function App() {
	const { userId, frontendToken, isAuthenticated } = useMentraAuth();
	const authState = useConvexAuth(userId, frontendToken, isAuthenticated);

	if (!isAuthenticated) {
		return (
			<div className="p-5 font-sans">
				<h1>Clairvoyant</h1>
				<p>Not authenticated. Please open from MentraOS app.</p>
			</div>
		);
	}

	if (authState.status === "loading") {
		return (
			<div className="p-5 font-sans max-w-2xl mx-auto">
				<h1>Clairvoyant</h1>
				<p>Loading...</p>
			</div>
		);
	}

	if (authState.status === "error") {
		return (
			<div className="p-5 font-sans max-w-2xl mx-auto">
				<h1>Clairvoyant</h1>
				<p className="text-red-600">Error: {authState.error}</p>
			</div>
		);
	}

	if (authState.status !== "authenticated") {
		return (
			<div className="p-5 font-sans max-w-2xl mx-auto">
				<h1>Clairvoyant</h1>
				<p>Initializing...</p>
			</div>
		);
	}

	return (
		<ConvexProvider client={authState.convexClient}>
			<BrowserRouter>
				<div className="p-5 font-sans max-w-2xl mx-auto">
					<h1>Clairvoyant</h1>
					<NavBar />
					<Routes>
						<Route path="/" element={<HomePage />} />
						<Route
							path="/settings"
							element={
								<SettingsPage userId={authState.convexUserId as Id<"users">} />
							}
						/>
						<Route
							path="/billing"
							element={<BillingPage mentraUserId={authState.mentraUserId} />}
						/>
					</Routes>
				</div>
			</BrowserRouter>
		</ConvexProvider>
	);
}
