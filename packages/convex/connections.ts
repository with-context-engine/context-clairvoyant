import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { internalQuery, mutation, query } from "./_generated/server";

// =============================================================================
// Utilities
// =============================================================================

async function getUserByEmail(ctx: QueryCtx, email: string) {
	return await ctx.db
		.query("users")
		.withIndex("by_email", (q) => q.eq("email", email))
		.first();
}

async function getConnectionBetween(
	ctx: QueryCtx,
	userA: Id<"users">,
	userB: Id<"users">,
) {
	const forward = await ctx.db
		.query("connections")
		.withIndex("by_pair", (q) =>
			q.eq("requesterId", userA).eq("accepterId", userB),
		)
		.first();
	if (forward) return forward;

	return await ctx.db
		.query("connections")
		.withIndex("by_pair", (q) =>
			q.eq("requesterId", userB).eq("accepterId", userA),
		)
		.first();
}

async function getLabelForUser(
	ctx: QueryCtx,
	connectionId: Id<"connections">,
	userId: Id<"users">,
) {
	return await ctx.db
		.query("connectionLabels")
		.withIndex("by_connection", (q) => q.eq("connectionId", connectionId))
		.filter((q) => q.eq(q.field("userId"), userId))
		.first();
}

// =============================================================================
// Public Mutations
// =============================================================================

export const sendConnectionRequest = mutation({
	args: {
		mentraUserId: v.string(),
		targetEmail: v.string(),
	},
	handler: async (ctx, args) => {
		const requester = await ctx.db
			.query("users")
			.withIndex("by_mentra_id", (q) =>
				q.eq("mentraUserId", args.mentraUserId),
			)
			.first();
		if (!requester) throw new Error("User not found");

		const accepter = await getUserByEmail(ctx, args.targetEmail);
		if (!accepter) throw new Error("No user found with that email");

		if (requester._id === accepter._id) {
			throw new Error("Cannot connect with yourself");
		}

		const existing = await getConnectionBetween(
			ctx,
			requester._id,
			accepter._id,
		);
		if (existing && existing.status !== "revoked") {
			throw new Error(
				existing.status === "pending"
					? "Connection request already pending"
					: "Connection already exists",
			);
		}

		if (existing && existing.status === "revoked") {
			await ctx.db.patch(existing._id, {
				requesterId: requester._id,
				accepterId: accepter._id,
				status: "pending",
				sharedMemoryEnabled: false,
			});
			return existing._id;
		}

		return await ctx.db.insert("connections", {
			requesterId: requester._id,
			accepterId: accepter._id,
			status: "pending",
			sharedMemoryEnabled: false,
		});
	},
});

export const acceptConnection = mutation({
	args: {
		mentraUserId: v.string(),
		connectionId: v.id("connections"),
	},
	handler: async (ctx, args) => {
		const user = await ctx.db
			.query("users")
			.withIndex("by_mentra_id", (q) =>
				q.eq("mentraUserId", args.mentraUserId),
			)
			.first();
		if (!user) throw new Error("User not found");

		const connection = await ctx.db.get(args.connectionId);
		if (!connection) throw new Error("Connection not found");
		if (connection.accepterId !== user._id) {
			throw new Error("Only the invited user can accept");
		}
		if (connection.status !== "pending") {
			throw new Error("Connection is not pending");
		}

		await ctx.db.patch(args.connectionId, { status: "active" });
		return { success: true };
	},
});

export const rejectConnection = mutation({
	args: {
		mentraUserId: v.string(),
		connectionId: v.id("connections"),
	},
	handler: async (ctx, args) => {
		const user = await ctx.db
			.query("users")
			.withIndex("by_mentra_id", (q) =>
				q.eq("mentraUserId", args.mentraUserId),
			)
			.first();
		if (!user) throw new Error("User not found");

		const connection = await ctx.db.get(args.connectionId);
		if (!connection) throw new Error("Connection not found");
		if (connection.accepterId !== user._id) {
			throw new Error("Only the invited user can reject");
		}
		if (connection.status !== "pending") {
			throw new Error("Connection is not pending");
		}

		await ctx.db.patch(args.connectionId, { status: "revoked" });
		return { success: true };
	},
});

export const revokeConnection = mutation({
	args: {
		mentraUserId: v.string(),
		connectionId: v.id("connections"),
	},
	handler: async (ctx, args) => {
		const user = await ctx.db
			.query("users")
			.withIndex("by_mentra_id", (q) =>
				q.eq("mentraUserId", args.mentraUserId),
			)
			.first();
		if (!user) throw new Error("User not found");

		const connection = await ctx.db.get(args.connectionId);
		if (!connection) throw new Error("Connection not found");

		if (
			connection.requesterId !== user._id &&
			connection.accepterId !== user._id
		) {
			throw new Error("Not a participant in this connection");
		}
		if (connection.status !== "active") {
			throw new Error("Connection is not active");
		}

		await ctx.db.patch(args.connectionId, {
			status: "revoked",
			sharedMemoryEnabled: false,
		});
		return { success: true };
	},
});

export const toggleSharedMemory = mutation({
	args: {
		mentraUserId: v.string(),
		connectionId: v.id("connections"),
		enabled: v.boolean(),
	},
	handler: async (ctx, args) => {
		const user = await ctx.db
			.query("users")
			.withIndex("by_mentra_id", (q) =>
				q.eq("mentraUserId", args.mentraUserId),
			)
			.first();
		if (!user) throw new Error("User not found");

		const connection = await ctx.db.get(args.connectionId);
		if (!connection) throw new Error("Connection not found");

		if (
			connection.requesterId !== user._id &&
			connection.accepterId !== user._id
		) {
			throw new Error("Not a participant in this connection");
		}
		if (connection.status !== "active") {
			throw new Error("Connection must be active to toggle shared memory");
		}

		await ctx.db.patch(args.connectionId, {
			sharedMemoryEnabled: args.enabled,
		});
		return { success: true };
	},
});

export const updateLabel = mutation({
	args: {
		mentraUserId: v.string(),
		connectionId: v.id("connections"),
		label: v.string(),
	},
	handler: async (ctx, args) => {
		const user = await ctx.db
			.query("users")
			.withIndex("by_mentra_id", (q) =>
				q.eq("mentraUserId", args.mentraUserId),
			)
			.first();
		if (!user) throw new Error("User not found");

		const connection = await ctx.db.get(args.connectionId);
		if (!connection) throw new Error("Connection not found");

		if (
			connection.requesterId !== user._id &&
			connection.accepterId !== user._id
		) {
			throw new Error("Not a participant in this connection");
		}

		const existing = await getLabelForUser(ctx, args.connectionId, user._id);
		if (existing) {
			await ctx.db.patch(existing._id, { label: args.label });
			return existing._id;
		}

		return await ctx.db.insert("connectionLabels", {
			connectionId: args.connectionId,
			userId: user._id,
			label: args.label,
		});
	},
});

// =============================================================================
// Public Queries
// =============================================================================

export const getConnectionsForUser = query({
	args: { mentraUserId: v.string() },
	handler: async (ctx, args) => {
		const user = await ctx.db
			.query("users")
			.withIndex("by_mentra_id", (q) =>
				q.eq("mentraUserId", args.mentraUserId),
			)
			.first();
		if (!user) return [];

		const asRequester = await ctx.db
			.query("connections")
			.withIndex("by_requester", (q) => q.eq("requesterId", user._id))
			.collect();

		const asAccepter = await ctx.db
			.query("connections")
			.withIndex("by_accepter", (q) => q.eq("accepterId", user._id))
			.collect();

		const all = [...asRequester, ...asAccepter].filter(
			(c) => c.status !== "revoked",
		);

		const results = await Promise.all(
			all.map(async (conn) => {
				const otherUserId =
					conn.requesterId === user._id
						? conn.accepterId
						: conn.requesterId;
				const otherUser = await ctx.db.get(otherUserId);
				const label = await getLabelForUser(ctx, conn._id, user._id);

				return {
					_id: conn._id,
					status: conn.status,
					sharedMemoryEnabled: conn.sharedMemoryEnabled,
					isRequester: conn.requesterId === user._id,
					otherUser: otherUser
						? { _id: otherUser._id, email: otherUser.email ?? null }
						: null,
					label: label?.label ?? null,
				};
			}),
		);

		return results;
	},
});

export const getPendingInvitesForUser = query({
	args: { mentraUserId: v.string() },
	handler: async (ctx, args) => {
		const user = await ctx.db
			.query("users")
			.withIndex("by_mentra_id", (q) =>
				q.eq("mentraUserId", args.mentraUserId),
			)
			.first();
		if (!user) return [];

		const pending = await ctx.db
			.query("connections")
			.withIndex("by_accepter", (q) => q.eq("accepterId", user._id))
			.filter((q) => q.eq(q.field("status"), "pending"))
			.collect();

		const results = await Promise.all(
			pending.map(async (conn) => {
				const requester = await ctx.db.get(conn.requesterId);
				return {
					_id: conn._id,
					requesterEmail: requester?.email ?? null,
					_creationTime: conn._creationTime,
				};
			}),
		);

		return results;
	},
});

export const getActiveSharedMemoryConnectionsByMentraId = query({
	args: { mentraUserId: v.string() },
	handler: async (ctx, args) => {
		const user = await ctx.db
			.query("users")
			.withIndex("by_mentra_id", (q) =>
				q.eq("mentraUserId", args.mentraUserId),
			)
			.first();
		if (!user) return [];

		const asRequester = await ctx.db
			.query("connections")
			.withIndex("by_requester", (q) => q.eq("requesterId", user._id))
			.filter((q) =>
				q.and(
					q.eq(q.field("status"), "active"),
					q.eq(q.field("sharedMemoryEnabled"), true),
				),
			)
			.collect();

		const asAccepter = await ctx.db
			.query("connections")
			.withIndex("by_accepter", (q) => q.eq("accepterId", user._id))
			.filter((q) =>
				q.and(
					q.eq(q.field("status"), "active"),
					q.eq(q.field("sharedMemoryEnabled"), true),
				),
			)
			.collect();

		const all = [...asRequester, ...asAccepter];

		const results = await Promise.all(
			all.map(async (conn) => {
				const connectedUserId =
					conn.requesterId === user._id
						? conn.accepterId
						: conn.requesterId;
				const label = await getLabelForUser(ctx, conn._id, user._id);

				return {
					connectedUserId,
					label: label?.label ?? null,
				};
			}),
		);

		return results;
	},
});

// =============================================================================
// Internal Queries (for Phase 2+ cross-peer lookups)
// =============================================================================

export const getActiveSharedMemoryConnections = internalQuery({
	args: { userId: v.id("users") },
	handler: async (ctx, args) => {
		const asRequester = await ctx.db
			.query("connections")
			.withIndex("by_requester", (q) => q.eq("requesterId", args.userId))
			.filter((q) =>
				q.and(
					q.eq(q.field("status"), "active"),
					q.eq(q.field("sharedMemoryEnabled"), true),
				),
			)
			.collect();

		const asAccepter = await ctx.db
			.query("connections")
			.withIndex("by_accepter", (q) => q.eq("accepterId", args.userId))
			.filter((q) =>
				q.and(
					q.eq(q.field("status"), "active"),
					q.eq(q.field("sharedMemoryEnabled"), true),
				),
			)
			.collect();

		const all = [...asRequester, ...asAccepter];

		const results = await Promise.all(
			all.map(async (conn) => {
				const connectedUserId =
					conn.requesterId === args.userId
						? conn.accepterId
						: conn.requesterId;
				const label = await getLabelForUser(ctx, conn._id, args.userId);

				return {
					_id: conn._id,
					connectedUserId,
					label: label?.label ?? null,
				};
			}),
		);

		return results;
	},
});

// =============================================================================
// Group Connections
// =============================================================================

export const createConnectionGroup = mutation({
	args: {
		mentraUserId: v.string(),
		name: v.string(),
		memberEmails: v.optional(v.array(v.string())),
	},
	handler: async (ctx, args) => {
		const creator = await ctx.db
			.query("users")
			.withIndex("by_mentra_id", (q) =>
				q.eq("mentraUserId", args.mentraUserId),
			)
			.first();
		if (!creator) throw new Error("User not found");

		const groupId = await ctx.db.insert("connectionGroups", {
			name: args.name,
			creatorId: creator._id,
			sharedMemoryEnabled: false,
		});

		// Add creator as active member
		await ctx.db.insert("connectionGroupMembers", {
			groupId,
			userId: creator._id,
			status: "active",
		});

		// Invite members by email
		if (args.memberEmails) {
			for (const email of args.memberEmails) {
				const member = await getUserByEmail(ctx, email);
				if (member && member._id !== creator._id) {
					const existing = await ctx.db
						.query("connectionGroupMembers")
						.withIndex("by_group_user", (q) =>
							q.eq("groupId", groupId).eq("userId", member._id),
						)
						.first();
					if (!existing) {
						await ctx.db.insert("connectionGroupMembers", {
							groupId,
							userId: member._id,
							status: "pending",
						});
					}
				}
			}
		}

		return groupId;
	},
});

export const acceptGroupInvite = mutation({
	args: {
		mentraUserId: v.string(),
		groupId: v.id("connectionGroups"),
	},
	handler: async (ctx, args) => {
		const user = await ctx.db
			.query("users")
			.withIndex("by_mentra_id", (q) =>
				q.eq("mentraUserId", args.mentraUserId),
			)
			.first();
		if (!user) throw new Error("User not found");

		const membership = await ctx.db
			.query("connectionGroupMembers")
			.withIndex("by_group_user", (q) =>
				q.eq("groupId", args.groupId).eq("userId", user._id),
			)
			.first();
		if (!membership) throw new Error("No invitation found");
		if (membership.status !== "pending") {
			throw new Error("Invitation is not pending");
		}

		await ctx.db.patch(membership._id, { status: "active" });
		return { success: true };
	},
});

export const leaveConnectionGroup = mutation({
	args: {
		mentraUserId: v.string(),
		groupId: v.id("connectionGroups"),
	},
	handler: async (ctx, args) => {
		const user = await ctx.db
			.query("users")
			.withIndex("by_mentra_id", (q) =>
				q.eq("mentraUserId", args.mentraUserId),
			)
			.first();
		if (!user) throw new Error("User not found");

		const membership = await ctx.db
			.query("connectionGroupMembers")
			.withIndex("by_group_user", (q) =>
				q.eq("groupId", args.groupId).eq("userId", user._id),
			)
			.first();
		if (!membership) throw new Error("Not a member of this group");

		await ctx.db.patch(membership._id, { status: "removed" });
		return { success: true };
	},
});

export const toggleGroupSharedMemory = mutation({
	args: {
		mentraUserId: v.string(),
		groupId: v.id("connectionGroups"),
		enabled: v.boolean(),
	},
	handler: async (ctx, args) => {
		const user = await ctx.db
			.query("users")
			.withIndex("by_mentra_id", (q) =>
				q.eq("mentraUserId", args.mentraUserId),
			)
			.first();
		if (!user) throw new Error("User not found");

		const group = await ctx.db.get(args.groupId);
		if (!group) throw new Error("Group not found");
		if (group.creatorId !== user._id) {
			throw new Error("Only the group creator can toggle shared memory");
		}

		await ctx.db.patch(args.groupId, {
			sharedMemoryEnabled: args.enabled,
		});
		return { success: true };
	},
});

export const updateGroupMemberLabel = mutation({
	args: {
		mentraUserId: v.string(),
		groupId: v.id("connectionGroups"),
		label: v.string(),
	},
	handler: async (ctx, args) => {
		const user = await ctx.db
			.query("users")
			.withIndex("by_mentra_id", (q) =>
				q.eq("mentraUserId", args.mentraUserId),
			)
			.first();
		if (!user) throw new Error("User not found");

		const membership = await ctx.db
			.query("connectionGroupMembers")
			.withIndex("by_group_user", (q) =>
				q.eq("groupId", args.groupId).eq("userId", user._id),
			)
			.first();
		if (!membership) throw new Error("Not a member of this group");

		await ctx.db.patch(membership._id, { label: args.label });
		return { success: true };
	},
});

export const getGroupsForUser = query({
	args: { mentraUserId: v.string() },
	handler: async (ctx, args) => {
		const user = await ctx.db
			.query("users")
			.withIndex("by_mentra_id", (q) =>
				q.eq("mentraUserId", args.mentraUserId),
			)
			.first();
		if (!user) return [];

		const memberships = await ctx.db
			.query("connectionGroupMembers")
			.withIndex("by_user", (q) => q.eq("userId", user._id))
			.filter((q) => q.neq(q.field("status"), "removed"))
			.collect();

		const results = await Promise.all(
			memberships.map(async (m) => {
				const group = await ctx.db.get(m.groupId);
				if (!group) return null;

				const allMembers = await ctx.db
					.query("connectionGroupMembers")
					.withIndex("by_group", (q) => q.eq("groupId", m.groupId))
					.filter((q) => q.neq(q.field("status"), "removed"))
					.collect();

				const memberDetails = await Promise.all(
					allMembers.map(async (member) => {
						const memberUser = await ctx.db.get(member.userId);
						return {
							userId: member.userId,
							email: memberUser?.email ?? null,
							label: member.label ?? null,
							status: member.status,
							isCreator: member.userId === group.creatorId,
						};
					}),
				);

				return {
					_id: group._id,
					name: group.name,
					sharedMemoryEnabled: group.sharedMemoryEnabled,
					isCreator: group.creatorId === user._id,
					myStatus: m.status,
					myLabel: m.label ?? null,
					members: memberDetails,
				};
			}),
		);

		return results.filter((r) => r !== null);
	},
});

export const getActiveSharedMemoryGroupMembers = internalQuery({
	args: { userId: v.id("users") },
	handler: async (ctx, args) => {
		// Find groups where this user is an active member and shared memory is enabled
		const memberships = await ctx.db
			.query("connectionGroupMembers")
			.withIndex("by_user", (q) => q.eq("userId", args.userId))
			.filter((q) => q.eq(q.field("status"), "active"))
			.collect();

		const results: Array<{
			groupId: Id<"connectionGroups">;
			connectedUserId: Id<"users">;
			label: string | null;
		}> = [];

		for (const membership of memberships) {
			const group = await ctx.db.get(membership.groupId);
			if (!group || !group.sharedMemoryEnabled) continue;

			// Get all other active members in this group
			const groupMembers = await ctx.db
				.query("connectionGroupMembers")
				.withIndex("by_group", (q) => q.eq("groupId", membership.groupId))
				.filter((q) =>
					q.and(
						q.eq(q.field("status"), "active"),
						q.neq(q.field("userId"), args.userId),
					),
				)
				.collect();

			for (const member of groupMembers) {
				// Avoid duplicates if user is already connected via 1:1
				if (!results.some((r) => r.connectedUserId === member.userId)) {
					results.push({
						groupId: membership.groupId,
						connectedUserId: member.userId,
						label: member.label ?? null,
					});
				}
			}
		}

		return results;
	},
});
