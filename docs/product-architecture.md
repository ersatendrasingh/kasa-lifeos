# KASA — Life OS Product Architecture

## Product principle

KASA is one connected personal operating system, not twenty unrelated tools.
Every feature is private and user-owned. Modules publish normalized signals into
the shared Reminder, Timeline, Search, Notification, and Dashboard layers. This
lets the product answer “what needs my attention now?” without forcing the user
to open every module.

## Platform layers

1. **Identity and personalization** — user profile, timezone, locale, currency,
   quiet hours, notification preferences, and dashboard layout.
2. **Universal capture** — text/voice/import input, classification, confidence,
   review queue, and promotion to a typed record.
3. **Life graph** — typed entities connected to people, documents, money,
   vehicles, learning, health, home, and goals.
4. **Time and attention** — reminders, recurrence, follow-ups, expiry rules,
   notification delivery, snooze, and escalation.
5. **History and intelligence** — immutable timeline events, daily aggregates,
   patterns, summaries, and safe AI suggestions.
6. **Personal dashboard** — ranked user-specific signals and configurable
   widgets rather than a globally fixed dashboard.

## Shared data rules

- Every personal row has a `userId`; every query and mutation scopes by it.
- IDs are opaque CUIDs. No sequential public identifiers.
- Timestamps are stored in UTC. Rendering and recurrence use the user profile
  timezone.
- Money uses `Decimal`, never floating-point. Currency is stored per record.
- Source text is retained for auditability; AI output never overwrites it.
- AI classifications store classifier, confidence, timestamp, and metadata.
- Low-confidence classification goes to `NEEDS_REVIEW`.
- Reminders are shared infrastructure and reference their target by type/id.
- Meaningful mutations publish a `TimelineEvent` in the same transaction.
- Deletion is cascade-only for user ownership. Important future modules use
  archive/soft-delete before permanent deletion.

## Domain map for the 20 features

| Feature              | Primary models                                                           | Shared integrations                 |
| -------------------- | ------------------------------------------------------------------------ | ----------------------------------- |
| Brain Dump           | `Capture`, `Task`, `Reminder`, `Idea`, `Expense`, `ShoppingItem`, `Wish` | Timeline, AI classification, search |
| Memory Vault         | `VaultDocument`, `DocumentVersion`, `DocumentExpiry`, `SecureField`      | Files, reminders, audit log         |
| Life Timeline        | `TimelineEvent`, `TimelineAttachment`                                    | Every domain publishes events       |
| Subscription Tracker | `Subscription`, `SubscriptionCharge`                                     | Finance, reminders, dashboard       |
| Habit System         | `Habit`, `HabitSchedule`, `HabitLog`, `LifeAreaScore`                    | Streaks, score, timeline            |
| Finance              | `FinancialAccount`, `Transaction`, `Investment`, `Loan`, `Bill`          | Reminders, dashboard, reports       |
| Follow Up Tracker    | `FollowUp`, `FollowUpUpdate`                                             | People, reminders, timeline         |
| People CRM           | `Person`, `PersonNote`, `Interaction`, `ImportantDate`                   | Follow-ups, reminders, timeline     |
| Vehicle              | `Vehicle`, `VehicleDocument`, `MaintenanceRecord`                        | Vault, expenses, reminders          |
| Medicine             | `Medication`, `MedicationSchedule`, `MedicationLog`, `DoctorVisit`       | Health, reminders, timeline         |
| Shopping Memory      | `ShoppingItem`, `PriceWatch`, `PriceObservation`                         | Capture, notifications              |
| Wishlist             | `Wish`, `SavingsGoal`, `GoalContribution`                                | Finance, reminders                  |
| Home Management      | `Household`, `HouseholdItem`, `HomeService`, `Bill`                      | People, shopping, reminders         |
| AI Assistant         | `AssistantThread`, `AssistantMessage`, `ActionPlan`, `ActionStep`        | All domains through guarded tools   |
| Learn Tracker        | `LearningResource`, `LearningSession`, `LearningProgress`                | Habits, goals, timeline             |
| Achievement Wall     | `Achievement`, `AchievementEvidence`                                     | Timeline, sharing (opt-in)          |
| Mood Journal         | `MoodEntry`, `MoodFactor`                                                | Health insights, private timeline   |
| Daily Reflection     | `Reflection`, `ReflectionAnswer`                                         | Tomorrow focus, mood, timeline      |
| Auto Reminder Engine | `Reminder`, `Notification`, `ReminderRule`                               | All expiring/due entities           |
| Smart Dashboard      | `DashboardWidget`, `DashboardSignal`, `DailyScore`                       | Aggregates all modules              |

## Personalized dashboard model

Dashboard layout is stored per user in `DashboardWidget`. Widget content is
computed from ranked signals. A signal score uses:

```text
urgency + overdue weight + user importance + recurrence relevance
+ neglected-area weight + confidence - dismissal fatigue
```

Examples:

- A bill due today outranks a reading suggestion.
- A missed medicine reminder outranks a shopping price drop.
- A birthday appears only inside the configured lead window.
- Habit widgets emphasize the user’s weakest selected life area.
- Dismissed recommendations decay so the dashboard does not nag.

The initial dashboard uses Today Score, Streak, Focus, and Quick Capture. Later
widgets plug into the same semantic contract without rewriting the shell.

## Brain Dump vertical slice

### Pipeline

```text
raw input
  → normalize
  → classify (rules fallback, AI provider later)
  → confidence threshold
  → create Capture
  → create exactly one typed entity
  → publish TimelineEvent
  → schedule Reminder/Notification when applicable
```

The rules classifier makes the feature usable without an AI key. The classifier
interface remains replaceable; an AI implementation must return the same typed
result and can never write directly to the database.

### Supported outputs in phase 1

- Task
- Reminder
- Idea
- Expense
- Shopping item
- Wish

### Examples

| Input                              | Expected output |
| ---------------------------------- | --------------- |
| `Laptop service`                   | Task            |
| `Remind me to call Gayle tomorrow` | Reminder        |
| `Idea for a family health app`     | Idea            |
| `Paid ₹1200 electricity bill`      | Expense         |
| `Milk khatam`                      | Shopping        |
| `Someday buy a camera`             | Wish            |

## Life Automation Engine

KASA treats manual capture as only one signal source. Email, calendar, SMS,
health, location, contacts, notifications, camera, documents, browser and voice
all enter the same ingestion boundary.

```text
source signal
  → authenticated ingestion + idempotency
  → retain original evidence and source metadata
  → AI creates a structured multi-action plan
  → schema and confidence validation
  → per-source privacy/automation policy
  → execute safe additive actions or place them in review
  → persist action result and immutable audit trail
```

`AutomationEvent` is the source evidence, `AutomationAction` is the proposed or
executed change, and `AutomationPolicy` records whether a user wants review-first,
auto-safe, or paused behavior for a source. AI never writes to the database. The
guarded executor is the only component allowed to create tasks, reminders,
expenses, timeline events or life records.

### Trust rules

- Every integration is optional and review-first by default.
- Manual text and voice are explicit user intent and may auto-run above the
  confidence threshold.
- Connected sources auto-run only in `AUTO_SAFE` mode and above the stricter
  connector confidence threshold.
- All current actions are additive and auditable. Imported expenses remain
  unconfirmed until finance reconciliation.
- Duplicate provider events use `(userId, source, sourceExternalId)` idempotency.
- Uploaded camera images and PDFs are processed but not retained by the current
  ingestion endpoint; only extracted evidence and file metadata are stored.
- Sensitive document storage belongs in the encrypted Memory Vault boundary.

## Memory Vault security boundary

Vault development starts only after storage and encryption are selected.

- Files live in private object storage, never the public web directory.
- Database stores opaque storage keys, hashes, MIME types, and metadata.
- PAN/Aadhaar/passport numbers are encrypted at application level; searchable
  values use a separate keyed blind index when genuinely necessary.
- Downloads use short-lived signed URLs after authorization.
- Every read/download/update creates an audit event.
- AI/OCR receives only explicitly approved document data.
- Sensitive values never enter logs, analytics, timeline summaries, or push
  notification bodies.

## Reminder engine

Reminder producers include explicit user reminders, document expiry, bills,
subscriptions, medicines, follow-ups, important dates, vehicle service, and
learning plans. A worker claims due `Reminder` rows, creates idempotent
`Notification` deliveries, respects quiet hours, and records attempts. The
delivery key will be unique per reminder/channel/scheduled occurrence to avoid
duplicate alerts.

## Delivery phases

### Phase 0 — foundation (current)

- Identity/profile and timezone
- Semantic theme and personalized dashboard shell
- Capture taxonomy and typed outputs
- Reminder, notification, timeline, dashboard preferences
- Brain Dump UI and rules classifier

### Phase 1 — daily attention

- Tasks and reminders
- Habit system and daily score
- Follow-ups and People CRM
- Daily reflection and mood
- Dashboard signal ranking

### Phase 2 — records and obligations

- Memory Vault with encrypted fields and private storage
- Subscriptions, bills, finance foundation
- Vehicle, medicine, and home management
- Expiry detection and notification worker

### Phase 3 — growth and goals

- Learn tracker
- Wishlist and savings goals
- Achievement wall
- Shopping price watches

### Phase 4 — guarded AI assistant

- Retrieval over the user’s authorized data
- Explainable plans and suggested actions
- Confirmation before creating obligations or exposing sensitive records
- Evaluation suite for classification, dates, amounts, and privacy boundaries

## Non-negotiable quality checks

- Authorization tests prove one user cannot read or mutate another user’s row.
- Reminder jobs are idempotent and timezone-tested.
- Money and expiry extraction always exposes a confirmation path.
- AI suggestions show their source records and confidence.
- Destructive actions and external side effects require explicit confirmation.
- Dashboard queries are bounded and indexed; no module performs an unbounded
  cross-domain scan on each page load.
