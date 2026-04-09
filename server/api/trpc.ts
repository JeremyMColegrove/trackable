import { initTRPC, TRPCError } from "@trpc/server";

import { logger } from "@/lib/logger";
import { LimitReachedError } from "@/server/errors";
import { getAuth } from "@/server/get-auth";

export async function createTRPCContext() {
	return {
		auth: await getAuth(),
	};
}

type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;

const t = initTRPC.context<TRPCContext>().create();

const loggerMiddleware = t.middleware(async ({ path, type, next }) => {
	const start = Date.now();
	const result = await next();
	const durationMs = Date.now() - start;

	if (result.ok) {
		logger.info({ path, type, durationMs }, "tRPC request successful");
	} else {
		logger.error(
			{
				path,
				type,
				durationMs,
				error: result.error.message,
				code: result.error.code,
			},
			"tRPC request failed",
		);
	}

	return result;
});

const handleDomainErrors = t.middleware(async ({ next }) => {
	try {
		return await next();
	} catch (error) {
		if (error instanceof LimitReachedError) {
			throw new TRPCError({ code: "FORBIDDEN", message: error.message });
		}
		throw error;
	}
});

const isAuthed = t.middleware(async ({ ctx, next }) => {
	if (!ctx.auth.userId) {
		throw new TRPCError({
			code: "UNAUTHORIZED",
		});
	}

	return next({
		ctx,
	});
});

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure.use(loggerMiddleware);
export const protectedProcedure = t.procedure
	.use(loggerMiddleware)
	.use(handleDomainErrors)
	.use(isAuthed);

export function getRequiredUserId(ctx: TRPCContext) {
	if (!ctx.auth.userId) {
		throw new TRPCError({
			code: "UNAUTHORIZED",
		});
	}

	return ctx.auth.userId;
}
