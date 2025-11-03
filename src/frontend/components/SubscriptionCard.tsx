import { CustomerPortalLink } from "@convex-dev/polar/react";
import { useAction, useQuery } from "convex/react";
import { useCallback, useEffect, useState } from "react";
import { api } from "../../../convex/_generated/api";

export function SubscriptionCard() {
	const products = useQuery(api.polar.listAllProducts);
	const userWithSub = useQuery(api.polar.getCurrentUserWithSubscription);
	const syncProducts = useAction(api.polar.syncProductsFromPolar);
	const generateCheckout = useAction(api.polar.generateCheckoutLink);
	const [syncing, setSyncing] = useState(false);
	const [autoSyncAttempted, setAutoSyncAttempted] = useState(false);
	const [checkingOut, setCheckingOut] = useState(false);

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

	// Auto-sync products if none exist
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

	const handleUpgrade = async () => {
		if (!products || products.length === 0) return;

		setCheckingOut(true);
		try {
			const priceIds = products.flatMap((p) =>
				p.prices.map((price) => price.id),
			);
			const result = await generateCheckout({
				productIds: priceIds,
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
		return <div>Loading...</div>;
	}

	const isPro = userWithSub.isPro;
	const subscription = userWithSub.subscription;

	return (
		<div className="p-5 border-2 border-gray-200 rounded-lg bg-gray-50 mt-5">
			<h2 className="mt-0">Subscription Status</h2>

			<div
				className={`inline-block px-4 py-1.5 rounded text-sm font-semibold mb-4 ${
					isPro ? "bg-emerald-500" : "bg-gray-500"
				} text-white`}
			>
				{isPro ? "Pro Tier ✨" : "Free Tier"}
			</div>

			{subscription && (
				<div className="mb-4 text-sm">
					<p className="my-1">
						<strong>Status:</strong> {subscription.status}
					</p>
					{subscription.cancelAtPeriodEnd && subscription.currentPeriodEnd && (
						<p className="my-1 text-amber-600 font-semibold">
							⚠️ Subscription will end on{" "}
							{new Date(subscription.currentPeriodEnd).toLocaleDateString()}
						</p>
					)}
					{subscription.currentPeriodEnd && !subscription.cancelAtPeriodEnd && (
						<p className="my-1">
							<strong>Renews:</strong>{" "}
							{new Date(subscription.currentPeriodEnd).toLocaleDateString()}
						</p>
					)}
				</div>
			)}

			{!isPro && (
				<div>
					<h3 className="mt-5 mb-3">Available Plans</h3>

					{products === undefined && (
						<p className="text-gray-500">Loading products...</p>
					)}

					{products && products.length === 0 && (
						<div>
							<p className="text-red-500 mb-3">
								No products found. Click below to sync products from Polar.
							</p>
							<button
								type="button"
								onClick={handleSyncProducts}
								disabled={syncing}
								className="px-5 py-2.5 bg-amber-500 text-white rounded-md cursor-pointer text-sm font-semibold hover:bg-amber-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
							>
								{syncing ? "Syncing..." : "Sync Products from Polar"}
							</button>
						</div>
					)}

					{products && products.length > 0 && (
						<div>
							{products.map((product) => (
								<div
									key={product.id}
									className="border border-gray-200 rounded-md p-3 mb-3 bg-white"
								>
									<h4 className="m-0 mb-2">{product.name}</h4>
									{product.prices.map((price) => (
										<p key={price.id} className="my-1 text-gray-500">
											${(price.priceAmount ?? 0) / 100}/
											{price.recurringInterval}
										</p>
									))}
								</div>
							))}
							<button
								type="button"
								onClick={handleUpgrade}
								disabled={checkingOut}
								className="px-5 py-2.5 bg-blue-500 text-white border-none rounded-md cursor-pointer text-base font-semibold hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
							>
								{checkingOut ? "Loading..." : "Upgrade to Pro"}
							</button>
						</div>
					)}
				</div>
			)}

			{isPro && (
				<div>
					<p className="mb-3">Thank you for being a Pro member! 🎉</p>
					<CustomerPortalLink
						polarApi={{
							generateCustomerPortalUrl: api.polar.generateCustomerPortalUrl,
						}}
						className="px-5 py-2.5 bg-violet-500 text-white border-none rounded-md cursor-pointer text-base font-semibold no-underline inline-block hover:bg-violet-600"
					>
						Manage Subscription
					</CustomerPortalLink>
				</div>
			)}
		</div>
	);
}
