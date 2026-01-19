import type { Id } from "@convex/_generated/dataModel";
import { useMentraAuth } from "@mentra/react";
import { ConvexProvider } from "convex/react";
import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { BottomTabBar } from "./components/BottomTabBar";
import { ChatPage } from "./components/ChatPage";
import ClairvoyantMobile from "./components/Clairvoyant";
import { FollowupChatPage } from "./components/FollowupChatPage";
import { FollowupsPage } from "./components/FollowupsPage";
import { HomePage } from "./components/HomePage";
import { MemoryPage } from "./components/MemoryPage";
import { NavBar } from "./components/NavBar";
import { QueuePage } from "./components/QueuePage";
import { SettingsPage } from "./components/SettingsPage";
import { UsagePage } from "./components/UsagePage";
import { Card, CardContent, CardHeader } from "./components/ui/card";
import { Skeleton } from "./components/ui/skeleton";
import { useConvexAuth } from "./hooks/useConvexAuth";
import { shouldShowMobileUI } from "./lib/platform";

const FEATURE_PLACEHOLDER_KEYS = [
	"feature-1",
	"feature-2",
	"feature-3",
	"feature-4",
];

export function App() {
	const { userId, frontendToken, isAuthenticated } = useMentraAuth();
	const authState = useConvexAuth(userId, frontendToken, isAuthenticated);
	const [isMobile, setIsMobile] = useState(shouldShowMobileUI());

	// Update mobile state on resize
	useEffect(() => {
		const handleResize = () => {
			setIsMobile(shouldShowMobileUI());
		};

		window.addEventListener("resize", handleResize);
		return () => window.removeEventListener("resize", handleResize);
	}, []);

	if (!isAuthenticated) {
		return (
			<div className="p-5 font-sans max-w-2xl mx-auto">
				<HomePage />
			</div>
		);
	}

	if (authState.status === "loading") {
		return (
			<div className="p-5 font-sans max-w-2xl mx-auto">
				<div className="space-y-6">
					<div className="space-y-2">
						<Skeleton className="h-8 w-48" />
						<Skeleton className="h-4 w-72" />
					</div>

					<Card>
						<CardHeader className="space-y-2">
							<Skeleton className="h-6 w-36" />
							<Skeleton className="h-4 w-64" />
						</CardHeader>
						<CardContent>
							<div className="space-y-3">
								{FEATURE_PLACEHOLDER_KEYS.map((placeholderKey) => (
									<div key={placeholderKey} className="flex items-start gap-3">
										<Skeleton className="h-4 w-4 rounded-full" />
										<Skeleton className="h-4 flex-1" />
									</div>
								))}
							</div>
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="space-y-2">
							<Skeleton className="h-6 w-40" />
							<Skeleton className="h-4 w-64" />
						</CardHeader>
						<CardContent>
							<Skeleton className="h-48 w-full" />
						</CardContent>
					</Card>
				</div>
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
				<div
					className={`max-w-2xl mx-auto min-h-screen overflow-x-hidden ${isMobile ? "pb-24" : "p-5"}`}
				>
					{!isMobile && <NavBar />}

					<div className={isMobile ? "p-5 pb-8" : ""}>
						<Routes>
							<Route path="/" element={<HomePage />} />
							<Route
								path="/memory"
								element={<MemoryPage mentraUserId={authState.mentraUserId} />}
							/>
							<Route
								path="/memory/chat/:date"
								element={<ChatPage mentraUserId={authState.mentraUserId} />}
							/>
							<Route
								path="/usage"
								element={
									<UsagePage userId={authState.convexUserId as Id<"users">} />
								}
							/>
							<Route
								path="/settings"
								element={
									<SettingsPage
										userId={authState.convexUserId as Id<"users">}
										mentraUserId={authState.mentraUserId}
									/>
								}
							/>
							<Route
								path="/billing"
								element={<Navigate to="/settings" replace />}
							/>
							<Route
								path="/queue"
								element={
									<QueuePage userId={authState.convexUserId as Id<"users">} />
								}
							/>
							<Route
								path="/followups"
								element={
									<FollowupsPage
										userId={authState.convexUserId as Id<"users">}
									/>
								}
							/>
							<Route
								path="/followups/chat/:followupId"
								element={
									<FollowupChatPage mentraUserId={authState.mentraUserId} />
								}
							/>
						</Routes>
					</div>

					{isMobile && <BottomTabBar />}
				</div>
			</BrowserRouter>
		</ConvexProvider>
	);
}
