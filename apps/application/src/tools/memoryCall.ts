import { randomUUID } from "node:crypto";
import { api } from "@convex/_generated/api";
import { Honcho, type Peer, type Session } from "@honcho-ai/sdk";
import { convexClient } from "../core/convex";
import { env } from "../core/env";

export async function initializeMemory(
	mentraUserId: string,
): Promise<[Session, Peer[]]> {
	// Fetch user to get their _id
	const user = await convexClient.query(
		api.payments.getCurrentUserWithSubscription,
		{ mentraUserId },
	);

	if (!user) {
		throw new Error(`User not found for mentraUserId: ${mentraUserId}`);
	}

	const userId = user._id;

	const honchoClient = new Honcho({
		apiKey: env.HONCHO_API_KEY,
		environment: "production",
		workspaceId: "with-context",
	});
	const session = await honchoClient.session(randomUUID());
	const diatribePeer = await honchoClient.peer(`${userId}-diatribe`, {
		metadata: {
			name: "Diatribe",
			description:
				"A peer that listens to the raw translations of the users' speech.",
		},
	});
	const synthesisedPeer = await honchoClient.peer(`${userId}-synthesis`, {
		metadata: {
			name: "Synthesis Peer",
			description:
				"A peer that captures synthesiszed  knowledge from the user's speech.",
		},
	});
	await session.addPeers([diatribePeer, synthesisedPeer]);
	return [session, [diatribePeer, synthesisedPeer]];
}
