// This file provides a parallel watcher that surfaces fatal Kubernetes-level
// failures encountered during a kube_ingress_nginx deploy. It polls kubectl
// events for the ingress-nginx namespace, matches known failure patterns, and
// throws a CLIError with actionable guidance as soon as a match is seen.

import { z } from "zod";
import { CLIError, CLISubprocessError } from "@/util/error/error";
import { getKubectlContextArgs } from "@/util/kube/getKubectlContextArgs";
import { sleep } from "@/util/util/sleep";
import type { PanfactumContext } from "@/util/context/context";

/** Kubernetes namespace that kube_ingress_nginx deploys into */
const INGRESS_NGINX_NAMESPACE = "ingress-nginx";

/** How often the watcher polls kubectl for new events */
const POLL_INTERVAL_MS = 5_000;

/**
 * Zod schema for the subset of `kubectl get events -o json` output that the
 * watcher cares about.
 *
 * @remarks
 * Defensively handles both the legacy core/v1 Event shape (`message`,
 * `involvedObject`, `lastTimestamp`) and the newer events.k8s.io/v1 shape
 * (`note`, `regarding`, `eventTime`) — `kubectl get events` normalizes to the
 * core shape, but the translation preserves fields differently across
 * kubectl versions.
 */
const kubeEventsListSchema = z.object({
  items: z.array(
    z
      .object({
        reason: z.string().optional(),
        type: z.string().optional(),
        message: z.string().optional(),
        note: z.string().optional(),
        lastTimestamp: z.string().nullable().optional(),
        eventTime: z.string().nullable().optional(),
        involvedObject: z
          .object({
            kind: z.string().optional(),
            name: z.string().optional(),
          })
          .passthrough()
          .optional(),
        regarding: z
          .object({
            kind: z.string().optional(),
            name: z.string().optional(),
          })
          .passthrough()
          .optional(),
      })
      .passthrough()
  ),
});

/**
 * Normalized view of a Kubernetes event used by failure matchers.
 */
interface IKubeEvent {
  /** The event's `reason` field (e.g. "FailedDeployModel") */
  reason: string;
  /** Human-readable message/note text from the event */
  message: string;
  /** Kind of the object the event refers to (e.g. "Service") */
  involvedKind: string;
  /** Name of the object the event refers to */
  involvedName: string;
  /** When the event was reported, or `undefined` if the cluster did not set one */
  timestamp: Date | undefined;
}

/**
 * Definition of a known failure mode that the watcher can translate into
 * actionable guidance.
 *
 * @remarks
 * Add new failure modes by appending a new entry to {@link KNOWN_FAILURES}.
 * Each matcher inspects a single event; if the matcher returns `true`, the
 * watcher throws a {@link CLIError} carrying the entry's `message`.
 */
interface IKnownFailure {
  /** Stable identifier for debugging/logging */
  id: string;
  /** Predicate that returns `true` when this failure mode matches an event */
  matches: (event: IKubeEvent) => boolean;
  /** User-facing error message (array entries are joined with newlines) */
  message: string | string[];
}

/**
 * List of Kubernetes event patterns the watcher knows how to diagnose.
 *
 * @remarks
 * Order does not matter — matchers are evaluated independently against each
 * event. When adding entries, keep `message` focused on what the user must
 * actually do to unblock the install.
 */
const KNOWN_FAILURES: ReadonlyArray<IKnownFailure> = [
  {
    id: "aws-elb-account-restriction",
    matches: (event) =>
      event.reason === "FailedDeployModel" &&
      event.message.includes("OperationNotPermitted") &&
      event.message.includes("does not support creating load balancers"),
    message: [
      "Your AWS account is currently restricted from creating Elastic Load Balancers.",
      "",
      "This is an account-level restriction that AWS applies to some new accounts",
      "(and occasionally existing ones). It is NOT caused by your IAM policies or",
      "Panfactum configuration — only AWS Support can lift it.",
      "",
      "To resolve:",
      "  1. Open a case at https://support.console.aws.amazon.com/",
      "     Type: Account and billing → Service: Account → Category: Activation",
      "  2. Ask AWS Support to enable Elastic Load Balancing on your account.",
      "  3. Re-run `pf cluster add` once the restriction is lifted — already",
      "     completed steps will be skipped automatically.",
    ],
  },
];

/**
 * Input parameters for {@link watchIngressNginxFailure}
 */
interface IWatchIngressNginxFailureInput {
  /** Panfactum context used for logging and subprocess execution */
  context: PanfactumContext;
  /** kubectl context targeting the cluster being installed */
  kubeContext: string;
  /**
   * Signal that fires when the deploy this watcher is attached to finishes.
   * The watcher resolves cleanly (without error) as soon as the signal is
   * aborted.
   */
  abortSignal: AbortSignal;
  /**
   * Earliest event timestamp the watcher should consider. Events with a
   * timestamp strictly before this are ignored so stale events from prior
   * runs cannot produce false positives. Defaults to the time the watcher
   * starts.
   */
  startTime?: Date;
}

/**
 * Watches Kubernetes events in the `ingress-nginx` namespace and rejects with
 * a {@link CLIError} when a known fatal failure mode is detected.
 *
 * @remarks
 * This watcher is designed to run in parallel with a terragrunt apply of the
 * `kube_ingress_nginx` module (via `buildDeployModuleTask`'s `parallelWatcher`
 * option). Its job is to turn opaque downstream failures — like helm/kubectl
 * waits timing out after 5+ minutes — into immediate, actionable error
 * messages rooted in the actual cluster event.
 *
 * Behavior:
 * - Polls `kubectl get events` in the ingress-nginx namespace every
 *   {@link POLL_INTERVAL_MS} ms, filtering to `reason=FailedDeployModel`.
 * - Parses each batch through {@link kubeEventsListSchema}, tolerating both
 *   legacy and events.k8s.io event shapes.
 * - Ignores events older than `startTime` so prior-run noise cannot trigger
 *   a false positive.
 * - Evaluates each event against {@link KNOWN_FAILURES}; the first match
 *   throws a {@link CLIError}.
 * - Transient kubectl errors are logged to `context.logger.debug` and the
 *   watcher keeps polling — a flaky kubectl call should never cause the
 *   deploy to fail.
 * - Resolves cleanly (no error) as soon as `abortSignal` fires.
 *
 * @param input - Watcher configuration. See {@link IWatchIngressNginxFailureInput}.
 * @returns Resolves when `abortSignal` fires. Never resolves otherwise — the
 *   watcher only returns by being cancelled or by throwing.
 *
 * @example
 * ```typescript
 * await buildDeployModuleTask({
 *   module: MODULES.KUBE_INGRESS_NGINX,
 *   parallelWatcher: async ({ ctx, abortSignal }) =>
 *     watchIngressNginxFailure({
 *       context,
 *       kubeContext: ctx.kubeContext!,
 *       abortSignal,
 *     }),
 *   // ...
 * });
 * ```
 *
 * @throws {@link CLIError}
 * Throws when a matching Kubernetes event is detected.
 */
export async function watchIngressNginxFailure(
  input: IWatchIngressNginxFailureInput
): Promise<void> {
  const { context, kubeContext, abortSignal } = input;
  const startTime = input.startTime ?? new Date();

  while (!abortSignal.aborted) {
    try {
      const events = await fetchFailedDeployModelEvents({
        context,
        kubeContext,
      });

      for (const event of events) {
        if (event.timestamp && event.timestamp < startTime) {
          continue;
        }

        for (const failure of KNOWN_FAILURES) {
          if (failure.matches(event)) {
            throw new CLIError([
              ...(Array.isArray(failure.message)
                ? failure.message
                : [failure.message]),
              "",
              "Original Kubernetes event:",
              `  ${event.message}`,
            ]);
          }
        }
      }
    } catch (err) {
      if (err instanceof CLIError) {
        throw err;
      }
      // Transient kubectl / parse error — log and keep polling. A flaky
      // kubectl call must never cause the deploy to fail on its own.
      context.logger.debug(
        `watchIngressNginxFailure: transient error, continuing to poll: ${err instanceof Error ? err.message : JSON.stringify(err)}`
      );
    }

    await sleepUntilAbort({ ms: POLL_INTERVAL_MS, abortSignal });
  }
}

/**
 * Input parameters for {@link fetchFailedDeployModelEvents}
 */
interface IFetchFailedDeployModelEventsInput {
  /** Panfactum context used for subprocess execution */
  context: PanfactumContext;
  /** kubectl context targeting the cluster to query */
  kubeContext: string;
}

/**
 * Fetches `FailedDeployModel` events from the ingress-nginx namespace and
 * normalizes them into {@link IKubeEvent}s.
 *
 * @internal
 * @param input - Fetch configuration
 * @returns Array of normalized events (possibly empty)
 *
 * @throws {@link CLISubprocessError}
 * Throws when kubectl fails to execute (caller treats this as transient)
 */
async function fetchFailedDeployModelEvents(
  input: IFetchFailedDeployModelEventsInput
): Promise<IKubeEvent[]> {
  const { context, kubeContext } = input;

  const eventsCommand = [
    "kubectl",
    ...getKubectlContextArgs(kubeContext),
    "get",
    "events",
    "-n",
    INGRESS_NGINX_NAMESPACE,
    "--field-selector",
    "reason=FailedDeployModel",
    "--ignore-not-found",
    "-o",
    "json",
  ];
  const result = await context.subprocessManager.execute({
    command: eventsCommand,
    workingDirectory: process.cwd(),
  }).exited;

  if (result.exitCode !== 0) {
    throw new CLISubprocessError(
      `Failed to fetch kubectl events in ${INGRESS_NGINX_NAMESPACE}`,
      {
        command: eventsCommand.join(" "),
        subprocessLogs: result.output,
        workingDirectory: process.cwd(),
      }
    );
  }

  if (result.stdout.trim().length === 0) {
    return [];
  }

  const parsedJson: unknown = JSON.parse(result.stdout);
  const parsed = kubeEventsListSchema.parse(parsedJson);

  return parsed.items.map((raw) => {
    const involved = raw.involvedObject ?? raw.regarding ?? {};
    const timestampStr = raw.lastTimestamp ?? raw.eventTime ?? undefined;
    const timestamp = timestampStr ? new Date(timestampStr) : undefined;
    return {
      reason: raw.reason ?? "",
      message: raw.message ?? raw.note ?? "",
      involvedKind: involved.kind ?? "",
      involvedName: involved.name ?? "",
      timestamp:
        timestamp && !Number.isNaN(timestamp.getTime()) ? timestamp : undefined,
    };
  });
}

/**
 * Input parameters for {@link sleepUntilAbort}
 */
interface ISleepUntilAbortInput {
  /** Maximum time to sleep in milliseconds */
  ms: number;
  /** Signal that wakes the sleep early if aborted */
  abortSignal: AbortSignal;
}

/**
 * Sleeps for up to `ms` milliseconds, returning early if `abortSignal` fires.
 *
 * @internal
 * @param input - Sleep configuration
 */
async function sleepUntilAbort(input: ISleepUntilAbortInput): Promise<void> {
  const { ms, abortSignal } = input;
  if (abortSignal.aborted) {
    return;
  }
  // Poll at short intervals so we stay responsive to abortSignal without
  // needing to wire an AbortSignal-aware timer.
  const stepMs = 250;
  let remaining = ms;
  while (remaining > 0 && !abortSignal.aborted) {
    const step = Math.min(stepMs, remaining);
    await sleep(step);
    remaining -= step;
  }
}
