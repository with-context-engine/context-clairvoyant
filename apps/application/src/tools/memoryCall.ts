import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Honcho, type Peer, type Session } from "@honcho-ai/sdk";
import { convexClient } from "../core/convex";
import { env } from "../core/env";

export async function initializeMemory(
	mentraUserId: string,
	mentraSessionId: string,
): Promise<[Session, Peer[], string, Id<"users">]> {
	// Ensure user exists (creates if not found) - handles new signups
	const userId = await convexClient.mutation(api.users.getOrCreate, {
		mentraUserId,
		mentraToken: mentraSessionId, // Use session ID as initial token
	});

	// Create a new Honcho session for each app-open (isolated sessions)
	const honchoSessionId = await convexClient.mutation(
		api.honchoSessions.createHonchoSession,
		{ mentraUserId, mentraSessionId },
	);

	const honchoClient = new Honcho({
		apiKey: env.HONCHO_API_KEY,
		environment: "production",
		workspaceId: "with-context",
	});

	const session = await honchoClient.session(honchoSessionId);
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
	return [session, [diatribePeer, synthesisedPeer], honchoSessionId, userId];
}
