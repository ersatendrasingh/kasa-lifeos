# Health Hub

Health Hub is KASA's personal wellbeing module. It is not a medical dashboard
and does not diagnose, prescribe, or predict disease. The product turns a small
set of daily signals into calm, useful context.

## Product structure

```text
Health Hub
├── Measurements — numbers that change over time
├── Activities   — movement and mindfulness events
└── Wellness     — care routines, reminders, and behavior
```

Measurements: weight, height, BMI, blood pressure, blood sugar, heart rate,
SpO2, body fat, and temperature.

Activities: walk, run, cycling, gym, yoga, swimming, meditation, and
stretching.

Wellness: water, medicine, sleep, stand up, eye rest, breathing, sunlight, and
healthy meals.

## Experience principles

1. Today comes first. Four common check-ins and one health score should answer
   “how am I doing?” without a dense dashboard.
2. Details use progressive disclosure. Measurements, Activities, and Wellness
   each have their own focused view and history.
3. Empty states never invent health data. Scores and trends appear only after
   enough real entries exist.
4. Wellness Coach sends fewer, better nudges. It respects quiet hours, work
   patterns, recent activity, dismissals, and a daily notification budget.
5. Every insight explains its evidence and remains wellness guidance—not a
   medical conclusion.

## Canonical data contract

All manual and connected data is normalized before it reaches the application:

```ts
type NormalizedHealthEntry = {
  type: HealthEntryType;
  value: number;
  unit: string;
  source:
    | "manual"
    | "apple-health"
    | "google-fit"
    | "samsung-health"
    | "fitbit"
    | "garmin";
  recordedAt: Date;
  metadata?: Record<string, string | number | boolean>;
};
```

`HealthEntry` is the only event store. Provider payloads, tokens, permissions,
and sync cursors belong to the connector/sync layer and never leak into this
model. A connector implements `HealthSourceConnector`, maps provider data to
the canonical contract, and writes through the same service as manual entry.

## System boundary

```text
Watch or wearable
  → Apple Health / Google Fit / provider SDK
  → Expo mobile connector
  → Health Sync Service (normalize, deduplicate, checkpoint)
  → Next.js API
  → HealthEntry
  → Web and mobile views
```

The web app reads and displays normalized data. Native health permissions and
device collection belong in the Expo app. A future sync request should use a
stable idempotency key such as `source + providerRecordId` to prevent duplicate
entries.

## Wellness Coach policy

The existing reminder engine remains the delivery mechanism. Health adds
templates and policy, not a second notification system.

Before scheduling a nudge, evaluate:

- whether the goal is genuinely behind;
- whether the user normally acts around this time;
- calendar focus, sleep, recent activity, and quiet hours;
- the last nudge of the same kind;
- dismissals and completed check-ins;
- daily and weekly notification budgets.

Start deterministic and observable. AI may rank or phrase eligible suggestions
later, but it must not bypass notification policy.

## Health score v1

The first score uses four explainable components: hydration, sleep, activity,
and medicine adherence. Missing components are excluded rather than scored as
zero. Each component is capped at 100%, and the UI always exposes the component
breakdown. Future versions can use personal baselines, but should preserve a
stable explanation and avoid medical-risk language.

## Delivery roadmap

### Phase A — manual foundation

- Health Hub navigation and calm Today view
- generic HealthEntry store and manual source
- water, weight, sleep, steps, and medicine check-ins
- transparent health score and weekly review
- reminder-engine templates for medicine and wellness routines
- goal settings, history editing, timezone tests, and mobile parity

### Phase B — phone health platforms

- Apple Health connector in Expo (steps, heart rate, calories, distance, sleep)
- Android Health Connect connector; Google Fit adapter only where still required
- permission education, background sync, deduplication, and sync health UI

### Phase C — device ecosystem

- Apple Watch through Apple Health
- Samsung Health, Fitbit, Garmin, and smart-scale connectors
- connector observability, retries, rate limits, and revocation

### Phase D — Life Intelligence

- contextual Wellness Coach suggestions across calendar and health
- personalized weekly reports and baseline-aware recommendations
- explicit evidence, confidence, feedback, and safety controls
- wellness risk signals only; no diagnosis or emergency decision-making

## Acceptance gates

- A provider can be added without changing Health Hub components.
- All reads and writes are scoped to the authenticated user.
- Unit normalization and duplicate handling are tested before automatic sync.
- Notifications pass quiet-hours, cooldown, and budget policies.
- Scores never use fabricated values and always show their breakdown.
- Mobile and web remain usable at 320 px width and in light/dark themes.
