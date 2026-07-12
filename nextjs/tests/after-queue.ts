/** Test double for `after()` from `next/server`. */

const tasks: Promise<unknown>[] = [];

export function enqueueAfter(task: unknown): void {
  tasks.push(
    Promise.resolve(typeof task === "function" ? (task as () => unknown)() : task),
  );
}

/** Waits for every deferred task queued so far, like the end of a request. */
export async function flushAfter(): Promise<void> {
  await Promise.all(tasks.splice(0));
}
