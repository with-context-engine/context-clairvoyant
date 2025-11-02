import { useMentraAuth } from "@mentra/react";

export function App() {
	const { userId, isAuthenticated } = useMentraAuth();

	if (!isAuthenticated) {
		return (
			<div style={{ padding: "20px", fontFamily: "system-ui" }}>
				<h1>Clairvoyant</h1>
				<p>Not authenticated. Please open from MentraOS app.</p>
			</div>
		);
	}

	return (
		<div style={{ padding: "20px", fontFamily: "system-ui" }}>
			<h1>Clairvoyant</h1>
			<p>Authenticated! Check console for credentials.</p>
			<p>
				<strong>User ID:</strong> {userId}
			</p>
		</div>
	);
}
