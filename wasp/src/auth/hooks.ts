import type { OnAfterSignupHook } from "wasp/server/auth";

/**
 * SPEC §5: record a welcome notification outside the request/response critical
 * path. Wasp's own mechanism for deferred work is `job`, which runs on pg-boss
 * and "requires that your database provider is set to `postgresql`"
 * (web/docs/advanced/jobs.md at tag v0.25.0). Every implementation in this
 * repository runs on SQLite, so the write is started and deliberately not
 * awaited: signup returns without waiting for it. See SPEC.md, which registers
 * this deviation and the reason for it.
 */
export const onAfterSignup: OnAfterSignupHook = async ({ user, prisma }) => {
  void prisma.notification
    .create({
      data: {
        type: "welcome",
        message: "Welcome to Minilog!",
        userId: user.id,
      },
    })
    .catch((error: unknown) => {
      console.error("failed to record the welcome notification", error);
    });
};
