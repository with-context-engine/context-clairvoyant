import { useMentraAuth } from "@mentra/react";
import { useEffect } from "react";
import { SubscriptionCard } from "./components/SubscriptionCard";

export function App() {
	const { userId, frontendToken, isAuthenticated } = useMentraAuth();

	useEffect(() => {
		if (userId && frontendToken && isAuthenticated) {
			console.log("[Mentra] Got userId and frontendToken");
			fetch("/api/session/mentra", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ frontendToken }),
			})
				.then(async (res) => {
					if (!res.ok) throw new Error("Token exchange failed");
					const data = (await res.json()) as { convexUserId: string };
					console.log("[Backend] Token exchanged:", data);
				})
				.catch((err) => {
					console.error("[Backend] Exchange error:", err);
				});
		}
	}, [userId, frontendToken, isAuthenticated]);

	if (!isAuthenticated) {
		return (
			<div className="p-5 font-sans">
				<h1>Clairvoyant</h1>
				<p>Not authenticated. Please open from MentraOS app.</p>
			</div>
		);
	}

	return (
		<div className="p-5 font-sans max-w-2xl mx-auto">
			<h1>Clairvoyant</h1>
			<SubscriptionCard />
		</div>
	);
}
