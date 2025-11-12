import { SubscriptionCard } from "./SubscriptionCard";

export function BillingPage({ mentraUserId }: { mentraUserId: string }) {
	return (
		<div className="space-y-6">
			<SubscriptionCard mentraUserId={mentraUserId} />
		</div>
	);
}
