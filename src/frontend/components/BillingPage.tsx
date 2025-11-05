import { SubscriptionCard } from "./SubscriptionCard";

export function BillingPage({ mentraUserId }: { mentraUserId: string }) {
	return (
		<div>
			<h2>Billing</h2>
			<SubscriptionCard mentraUserId={mentraUserId} />
		</div>
	);
}
