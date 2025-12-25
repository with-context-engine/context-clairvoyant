import { api } from "@convex/_generated/api";
import type { PolarProduct } from "@convex/payments";
import { CustomerPortalLink } from "@convex-dev/polar/react";
import { useAction, useQuery } from "convex/react";
import { animate, motion, useMotionValue, useTransform } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import { BorderBeam } from "./ui/border-beam";
import { Button } from "./ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "./ui/card";

export function SubscriptionCard({ mentraUserId }: { mentraUserId: string }) {
	const products = useQuery(api.payments.listAllProducts) as
		| PolarProduct[]
		| undefined;
	const userWithSub = useQuery(api.payments.getCurrentUserWithSubscription, {
		mentraUserId,
	});
	const syncProducts = useAction(api.payments.syncProductsFromPolar);
	const generateCheckout = useAction(api.payments.generateCheckoutLink);
	const [syncing, setSyncing] = useState(false);
	const [autoSyncAttempted, setAutoSyncAttempted] = useState(false);
	const [checkingOut, setCheckingOut] = useState(false);

	const [_daysUntilRenewal, setDaysUntilRenewal] = useState(0);
	const count = useMotionValue(0);
	const rounded = useTransform(count, (latest) => Math.round(latest));

	const handleSyncProducts = useCallback(async () => {
		setSyncing(true);
		try {
			await syncProducts();
			console.log("[SubscriptionCard] Products synced successfully");
		} catch (error) {
			console.error("Failed to sync products:", error);
		} finally {
			setSyncing(false);
		}
	}, [syncProducts]);

	useEffect(() => {
		if (
			products !== undefined &&
			products.length === 0 &&
			!autoSyncAttempted &&
			!syncing
		) {
			console.log("[SubscriptionCard] No products found, auto-syncing...");
			setAutoSyncAttempted(true);
			handleSyncProducts();
		}
	}, [products, autoSyncAttempted, syncing, handleSyncProducts]);

	useEffect(() => {
		if (!userWithSub?.subscription?.currentPeriodEnd || !userWithSub) {
			setDaysUntilRenewal(0);
			return;
		}

		const isPro = userWithSub.isPro;
		const subscription = userWithSub.subscription;
		const now = new Date();
		const renewalDate = new Date(subscription.currentPeriodEnd ?? "");
		const diffTime = renewalDate.getTime() - now.getTime();
		const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
		const days = Math.max(0, diffDays);

		setDaysUntilRenewal(days);

		if (isPro && days > 0) {
			const controls = animate(count, days, {
				duration: 2,
				ease: "easeOut",
			});
			return () => controls.stop();
		}
	}, [userWithSub, count]);

	const handleUpgrade = async () => {
		if (!products || products.length === 0) return;

		setCheckingOut(true);
		try {
			const productIds = products.map((p) => p.id);
			const result = await generateCheckout({
				productIds,
				origin: window.location.origin,
				successUrl: window.location.href,
			});

			if (result.url) {
				window.location.href = result.url;
			}
		} catch (error) {
			console.error("Failed to create checkout:", error);
			alert("Failed to start checkout. Please try again.");
		} finally {
			setCheckingOut(false);
		}
	};

	if (!userWithSub) {
		return <p>Loading...</p>;
	}

	const isPro = userWithSub.isPro;

	return (
		<div className="space-y-6">
			<Card className="relative overflow-hidden">
				<CardContent className="relative z-10 space-y-4">
					<div
						className={`w-full px-4 py-1.5 rounded-base text-sm font-bold border-2 border-border text-center ${
							isPro
								? "bg-transparent text-foreground"
								: "bg-secondary-background text-foreground"
						}`}
					>
						{isPro ? "Pro Tier" : "Free Tier"}
					</div>
				</CardContent>
				{isPro && <BorderBeam duration={8} size={160} borderWidth={2} />}
			</Card>

			{userWithSub &&
				userWithSub.subscription &&
				userWithSub.subscription.currentPeriodEnd !== null &&
				isPro && (
					<Card>
						<CardContent className="space-y-3">
							<div className="flex gap-6">
								<div className="flex flex-1 flex-col items-center gap-3">
									<div className="flex items-baseline gap-2">
										<motion.span
											className={`text-6xl font-heading bg-transparent text-foreground ${
												userWithSub.subscription.cancelAtPeriodEnd
													? "text-chart-2"
													: "text-chart-4"
											}`}
										>
											{rounded}
										</motion.span>
									</div>
									<div
										className={`w-full px-4 py-1.5 rounded-base text-sm font-bold border-2 border-border text-center ${
											isPro
												? "bg-transparent text-foreground"
												: "bg-secondary-background text-foreground"
										}`}
									>
										{isPro
											? "Days until subscription renewal."
											: "Days until subscription end."}
									</div>
								</div>
							</div>
						</CardContent>
					</Card>
				)}

			{!isPro && (
				<Card>
					<CardHeader>
						<CardTitle>Available Plans</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						{products === undefined && (
							<p className="text-foreground/60">Loading products...</p>
						)}

						{products && products.length === 0 && (
							<div className="space-y-3">
								<Card className="border-chart-2 bg-chart-2/10">
									<CardContent className="py-3">
										<p className="text-sm">
											No products found. Click below to sync products from
											Polar.
										</p>
									</CardContent>
								</Card>
								<Button
									onClick={handleSyncProducts}
									disabled={syncing}
									variant="neutral"
									className="w-full"
								>
									{syncing ? "Syncing..." : "Sync Products from Polar"}
								</Button>
							</div>
						)}

						{products && products.length > 0 && (
							<div className="space-y-4">
								{products.map((product) => (
									<Card key={product.id}>
										<CardHeader>
											<CardTitle>{product.name}</CardTitle>
											<CardDescription>
												{product.prices.map((price) => (
													<span key={price.id}>
														${(price.priceAmount ?? 0) / 100}/
														{price.recurringInterval}
													</span>
												))}
											</CardDescription>
										</CardHeader>
									</Card>
								))}
								<Button
									onClick={handleUpgrade}
									disabled={checkingOut}
									variant="neutral"
									className="w-full"
								>
									{checkingOut ? "Loading..." : "Upgrade to Pro"}
								</Button>
							</div>
						)}
					</CardContent>
				</Card>
			)}

			{isPro && (
				<Card>
					<CardContent>
						<Button
							variant="neutral"
							className="w-full bg-transparent text-foreground"
							asChild
						>
							<CustomerPortalLink
								polarApi={{
									generateCustomerPortalUrl:
										api.payments.generateCustomerPortalUrl,
								}}
							>
								Manage Subscription
							</CustomerPortalLink>
						</Button>
					</CardContent>
				</Card>
			)}
		</div>
	);
}
