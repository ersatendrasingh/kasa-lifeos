import {
  Archive,
  BookOpen,
  Bot,
  CalendarClock,
  CarFront,
  CircleDollarSign,
  ClipboardCheck,
  HeartPulse,
  Home,
  Inbox,
  LayoutDashboard,
  ListChecks,
  NotebookPen,
  RefreshCw,
  Sparkles,
  Target,
  Trophy,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

export type ProductModule = {
  slug: string;
  name: string;
  shortName: string;
  description: string;
  eyebrow: string;
  icon: LucideIcon;
  accent: string;
  primaryAction: string;
  metrics: Array<{ label: string; value: string; detail: string }>;
  focus: Array<{ title: string; detail: string; status: string }>;
  insight: string;
};

export const productModules: ProductModule[] = [
  {
    slug: "calendar",
    name: "Calendar",
    shortName: "Calendar",
    description:
      "One calm calendar for plans, tasks, reminders, renewals, and the moments that matter.",
    eyebrow: "Your time, connected",
    icon: CalendarClock,
    accent: "bg-brand-soft text-brand",
    primaryAction: "Plan something",
    metrics: [],
    focus: [],
    insight: "",
  },
  {
    slug: "life-vault",
    name: "Life Vault",
    shortName: "Vault",
    description:
      "Your important documents, records, and expiry dates—securely organized.",
    eyebrow: "Personal records",
    icon: Archive,
    accent: "bg-info-soft text-info",
    primaryAction: "Add a document",
    metrics: [
      { label: "Documents", value: "0", detail: "Secure records" },
      { label: "Expiring soon", value: "0", detail: "Next 30 days" },
      { label: "Categories", value: "8", detail: "Ready to organize" },
      { label: "Vault status", value: "Ready", detail: "Private by default" },
    ],
    focus: [
      {
        title: "Identity",
        detail: "PAN, Aadhaar, passport, licence",
        status: "Add records",
      },
      {
        title: "Work",
        detail: "Offer letters and salary slips",
        status: "Organize",
      },
      {
        title: "Health",
        detail: "Reports, prescriptions, insurance",
        status: "Keep safe",
      },
    ],
    insight:
      "Add expiry dates once and KASA will surface renewals before they become urgent.",
  },
  {
    slug: "timeline",
    name: "Timeline",
    shortName: "Timeline",
    description:
      "A searchable history of the moments, decisions, and events that shape your life.",
    eyebrow: "Life history",
    icon: CalendarClock,
    accent: "bg-brand-soft text-brand",
    primaryAction: "Add a life event",
    metrics: [
      { label: "This month", value: "0", detail: "Recorded moments" },
      { label: "Milestones", value: "0", detail: "Major events" },
      { label: "Categories", value: "12", detail: "Life areas" },
      { label: "History", value: "Private", detail: "Only for you" },
    ],
    focus: [
      {
        title: "Career",
        detail: "Jobs, promotions, achievements",
        status: "Track",
      },
      {
        title: "Money",
        detail: "Salary, purchases, investments",
        status: "Remember",
      },
      {
        title: "Life moments",
        detail: "Travel, family, health, decisions",
        status: "Preserve",
      },
    ],
    insight:
      "Your timeline will grow automatically as you complete meaningful actions across KASA.",
  },
  {
    slug: "renewals",
    name: "Responsibilities",
    shortName: "Responsibilities",
    description:
      "Subscriptions, bills, EMIs, and policies with one reliable renewal calendar.",
    eyebrow: "Recurring commitments",
    icon: RefreshCw,
    accent: "bg-warning-soft text-warning",
    primaryAction: "Add a responsibility",
    metrics: [
      { label: "Monthly total", value: "₹0", detail: "Recurring spend" },
      { label: "Due soon", value: "0", detail: "Next 7 days" },
      { label: "Active", value: "0", detail: "Subscriptions" },
      { label: "Potential savings", value: "₹0", detail: "Review regularly" },
    ],
    focus: [
      {
        title: "Digital services",
        detail: "Streaming, AI tools, software",
        status: "Add",
      },
      {
        title: "Household bills",
        detail: "Electricity, internet, phone",
        status: "Schedule",
      },
      {
        title: "Financial commitments",
        detail: "EMIs and insurance premiums",
        status: "Protect",
      },
    ],
    insight:
      "KASA will group renewals by urgency and warn you before avoidable charges.",
  },
  {
    slug: "rhythms",
    name: "Rhythms",
    shortName: "Rhythms",
    description:
      "Build balanced routines across health, career, learning, and relationships.",
    eyebrow: "Habit system",
    icon: ListChecks,
    accent: "bg-positive-soft text-positive",
    primaryAction: "Create a rhythm",
    metrics: [
      { label: "Active rhythms", value: "0", detail: "Across your life" },
      { label: "Consistency", value: "—", detail: "Starts after check-ins" },
      { label: "Best streak", value: "0", detail: "Days" },
      { label: "Balance", value: "Ready", detail: "Four life areas" },
    ],
    focus: [
      { title: "Health", detail: "Movement, water, sleep", status: "Start" },
      {
        title: "Growth",
        detail: "Learning and focused practice",
        status: "Build",
      },
      {
        title: "Relationships",
        detail: "Family and meaningful connection",
        status: "Nurture",
      },
    ],
    insight:
      "A sustainable week beats a perfect day. KASA prioritizes balance over pressure.",
  },
  {
    slug: "money",
    name: "Money",
    shortName: "Money",
    description:
      "Understand income, spending, commitments, savings, and long-term security.",
    eyebrow: "Financial life",
    icon: CircleDollarSign,
    accent: "bg-positive-soft text-positive",
    primaryAction: "Add a transaction",
    metrics: [
      { label: "Available", value: "₹0", detail: "This month" },
      { label: "Expenses", value: "₹0", detail: "Tracked spend" },
      { label: "Invested", value: "₹0", detail: "SIP, FD, PF" },
      { label: "Upcoming dues", value: "₹0", detail: "Bills and EMIs" },
    ],
    focus: [
      {
        title: "Cash flow",
        detail: "Salary and everyday spending",
        status: "Connect",
      },
      {
        title: "Safety",
        detail: "Emergency fund and insurance",
        status: "Plan",
      },
      {
        title: "Future",
        detail: "Investments and financial goals",
        status: "Grow",
      },
    ],
    insight:
      "Start with one month of expenses. KASA will build useful patterns without demanding perfect bookkeeping.",
  },
  {
    slug: "follow-ups",
    name: "Follow-ups",
    shortName: "Follow-ups",
    description:
      "Never lose track of a reply, application, request, or promise again.",
    eyebrow: "Waiting and next actions",
    icon: ClipboardCheck,
    accent: "bg-brand-soft text-brand",
    primaryAction: "Track a follow-up",
    metrics: [
      { label: "Waiting", value: "0", detail: "Open replies" },
      { label: "Due today", value: "0", detail: "Needs action" },
      { label: "Overdue", value: "0", detail: "Requires attention" },
      { label: "Closed", value: "0", detail: "Resolved" },
    ],
    focus: [
      { title: "Work", detail: "HR, managers, approvals", status: "Track" },
      {
        title: "Opportunities",
        detail: "Resumes, interviews, proposals",
        status: "Follow up",
      },
      {
        title: "Personal",
        detail: "Services, requests, commitments",
        status: "Remember",
      },
    ],
    insight:
      "KASA will suggest the right follow-up date based on when you last reached out.",
  },
  {
    slug: "people",
    name: "People",
    shortName: "People",
    description:
      "A thoughtful space for the people who matter—not another contact list.",
    eyebrow: "Personal relationships",
    icon: UsersRound,
    accent: "bg-info-soft text-info",
    primaryAction: "Add a person",
    metrics: [
      { label: "People", value: "0", detail: "Important connections" },
      { label: "Birthdays", value: "0", detail: "Upcoming" },
      { label: "Follow-ups", value: "0", detail: "Stay connected" },
      { label: "Recent notes", value: "0", detail: "Relationship context" },
    ],
    focus: [
      {
        title: "Personal circle",
        detail: "Family and close friends",
        status: "Add",
      },
      {
        title: "Professional circle",
        detail: "Manager, mentors, colleagues",
        status: "Organize",
      },
      {
        title: "Trusted services",
        detail: "Doctor, lawyer, bank RM",
        status: "Keep handy",
      },
    ],
    insight:
      "Remembering context is a form of care. KASA keeps private notes ready when you need them.",
  },
  {
    slug: "mobility",
    name: "Mobility",
    shortName: "Mobility",
    description:
      "Vehicles, documents, service schedules, and road-ready reminders in one place.",
    eyebrow: "Vehicle management",
    icon: CarFront,
    accent: "bg-warning-soft text-warning",
    primaryAction: "Add a vehicle",
    metrics: [
      { label: "Vehicles", value: "0", detail: "Managed" },
      { label: "Service due", value: "0", detail: "Upcoming" },
      { label: "Documents", value: "0", detail: "RC, PUC, insurance" },
      { label: "FASTag", value: "—", detail: "Balance tracking" },
    ],
    focus: [
      {
        title: "Compliance",
        detail: "RC, licence, insurance, PUC",
        status: "Add",
      },
      {
        title: "Maintenance",
        detail: "Service, oil, tyres",
        status: "Schedule",
      },
      {
        title: "Running costs",
        detail: "Fuel, tolls, repairs",
        status: "Understand",
      },
    ],
    insight:
      "Add your insurance and PUC expiry dates first to activate proactive reminders.",
  },
  {
    slug: "health",
    name: "Health",
    shortName: "Health",
    description:
      "Medicines, appointments, hydration, reports, and care routines without clutter.",
    eyebrow: "Personal wellbeing",
    icon: HeartPulse,
    accent: "bg-danger-soft text-danger",
    primaryAction: "Add a health item",
    metrics: [
      { label: "Today’s care", value: "0", detail: "Scheduled items" },
      { label: "Medicines", value: "0", detail: "Active reminders" },
      { label: "Appointments", value: "0", detail: "Upcoming" },
      { label: "Water", value: "0%", detail: "Daily target" },
    ],
    focus: [
      {
        title: "Medication",
        detail: "Dose and refill reminders",
        status: "Set up",
      },
      {
        title: "Appointments",
        detail: "Doctors, tests, follow-ups",
        status: "Plan",
      },
      {
        title: "Daily care",
        detail: "Water, vitamins, movement",
        status: "Build",
      },
    ],
    insight:
      "Health data stays private. KASA surfaces routines and reminders, not medical diagnoses.",
  },
  {
    slug: "saved-items",
    name: "Saved Items",
    shortName: "Saved",
    description:
      "Remember products, links, and purchases you want to reconsider later.",
    eyebrow: "Shopping memory",
    icon: Inbox,
    accent: "bg-info-soft text-info",
    primaryAction: "Save an item",
    metrics: [
      { label: "Saved", value: "0", detail: "Items to revisit" },
      { label: "Price alerts", value: "0", detail: "Watching" },
      { label: "Purchased", value: "0", detail: "Completed" },
      { label: "Lists", value: "0", detail: "Organized groups" },
    ],
    focus: [
      {
        title: "Buy later",
        detail: "Products worth reconsidering",
        status: "Save",
      },
      {
        title: "Price watch",
        detail: "Track meaningful price changes",
        status: "Watch",
      },
      {
        title: "Research",
        detail: "Links, notes, comparisons",
        status: "Collect",
      },
    ],
    insight:
      "Saving first creates distance from impulse purchases and makes better decisions easier.",
  },
  {
    slug: "goals",
    name: "Goals",
    shortName: "Goals",
    description:
      "Turn meaningful wishes into clear targets, savings plans, and next steps.",
    eyebrow: "Future planning",
    icon: Target,
    accent: "bg-brand-soft text-brand",
    primaryAction: "Create a goal",
    metrics: [
      { label: "Active goals", value: "0", detail: "In progress" },
      { label: "Saved", value: "₹0", detail: "Across goals" },
      { label: "Next target", value: "—", detail: "Choose a priority" },
      { label: "Achieved", value: "0", detail: "Completed goals" },
    ],
    focus: [
      {
        title: "Things",
        detail: "Phone, laptop, vehicle, camera",
        status: "Plan",
      },
      {
        title: "Experiences",
        detail: "Travel, learning, family",
        status: "Imagine",
      },
      {
        title: "Security",
        detail: "Savings and emergency goals",
        status: "Build",
      },
    ],
    insight:
      "Choose one priority goal first. KASA will connect its cost, timeline, and next action.",
  },
  {
    slug: "household",
    name: "Household",
    shortName: "Home",
    description:
      "Recurring home needs, services, payments, and shared responsibilities.",
    eyebrow: "Home operations",
    icon: Home,
    accent: "bg-warning-soft text-warning",
    primaryAction: "Add a home item",
    metrics: [
      { label: "Due this week", value: "0", detail: "Home tasks" },
      { label: "Monthly bills", value: "₹0", detail: "Recurring" },
      { label: "Supplies", value: "0", detail: "Running low" },
      { label: "Services", value: "0", detail: "Regular providers" },
    ],
    focus: [
      {
        title: "Essentials",
        detail: "Gas, milk, grocery, water",
        status: "Track",
      },
      {
        title: "Payments",
        detail: "Rent, maid, utilities, Wi-Fi",
        status: "Schedule",
      },
      {
        title: "Maintenance",
        detail: "Repairs and service contacts",
        status: "Organize",
      },
    ],
    insight:
      "KASA can turn repeated household entries into predictable recurring routines.",
  },
  {
    slug: "guide",
    name: "KASA Guide",
    shortName: "Guide",
    description:
      "Ask for help, get a practical plan, and turn guidance into tracked actions.",
    eyebrow: "Personal AI assistant",
    icon: Bot,
    accent: "bg-brand-soft text-brand",
    primaryAction: "Ask KASA",
    metrics: [
      { label: "Active plans", value: "0", detail: "Guided workflows" },
      { label: "Next actions", value: "0", detail: "Ready for you" },
      { label: "Completed", value: "0", detail: "Guided outcomes" },
      { label: "Context", value: "Private", detail: "Personalized help" },
    ],
    focus: [
      {
        title: "Get something done",
        detail: "Documents, applications, renewals",
        status: "Ask",
      },
      {
        title: "Make a decision",
        detail: "Compare options and trade-offs",
        status: "Think",
      },
      {
        title: "Build a plan",
        detail: "Turn intent into practical steps",
        status: "Plan",
      },
    ],
    insight:
      "KASA Guide will use only the life context you choose and always show actions before taking them.",
  },
  {
    slug: "learning",
    name: "Learning",
    shortName: "Learning",
    description:
      "Courses, books, practice, interviews, and progress in one growth system.",
    eyebrow: "Skills and career growth",
    icon: BookOpen,
    accent: "bg-info-soft text-info",
    primaryAction: "Add learning",
    metrics: [
      { label: "In progress", value: "0", detail: "Learning tracks" },
      { label: "This week", value: "0m", detail: "Focused learning" },
      { label: "Completed", value: "0", detail: "Courses and books" },
      { label: "Practice streak", value: "0", detail: "Days" },
    ],
    focus: [
      {
        title: "Courses",
        detail: "Udemy, YouTube, structured study",
        status: "Learn",
      },
      {
        title: "Practice",
        detail: "Projects, LeetCode, exercises",
        status: "Apply",
      },
      {
        title: "Career readiness",
        detail: "Resume and interview preparation",
        status: "Prepare",
      },
    ],
    insight:
      "Progress becomes easier when KASA tracks the next lesson instead of the whole mountain.",
  },
  {
    slug: "milestones",
    name: "Milestones",
    shortName: "Milestones",
    description:
      "A motivating record of progress, achievements, and meaningful personal wins.",
    eyebrow: "Achievement record",
    icon: Trophy,
    accent: "bg-warning-soft text-warning",
    primaryAction: "Add a milestone",
    metrics: [
      { label: "Milestones", value: "0", detail: "All time" },
      { label: "This year", value: "0", detail: "New achievements" },
      { label: "Current streak", value: "0", detail: "Days" },
      { label: "Life areas", value: "0", detail: "Growing" },
    ],
    focus: [
      {
        title: "Career",
        detail: "New roles, promotions, compensation",
        status: "Celebrate",
      },
      {
        title: "Growth",
        detail: "Skills, streaks, completed work",
        status: "Remember",
      },
      {
        title: "Life",
        detail: "Purchases, travel, personal firsts",
        status: "Preserve",
      },
    ],
    insight:
      "KASA will suggest milestones from meaningful completed goals while leaving the final choice to you.",
  },
  {
    slug: "journal",
    name: "Journal",
    shortName: "Journal",
    description:
      "Quick mood check-ins and private notes that reveal patterns over time.",
    eyebrow: "Mood and wellbeing",
    icon: NotebookPen,
    accent: "bg-info-soft text-info",
    primaryAction: "Check in",
    metrics: [
      { label: "Today", value: "—", detail: "Mood check-in" },
      { label: "Entries", value: "0", detail: "This month" },
      { label: "Pattern", value: "Learning", detail: "Needs more data" },
      { label: "Privacy", value: "Private", detail: "Only for you" },
    ],
    focus: [
      { title: "Mood", detail: "A simple emoji is enough", status: "Check in" },
      {
        title: "Context",
        detail: "Add a note only when useful",
        status: "Optional",
      },
      {
        title: "Patterns",
        detail: "Notice what supports your wellbeing",
        status: "Discover",
      },
    ],
    insight:
      "You do not need to write an essay. Consistent one-tap check-ins create useful patterns.",
  },
  {
    slug: "daily-review",
    name: "Daily Review",
    shortName: "Review",
    description:
      "Close the day in one minute and begin tomorrow with a clear priority.",
    eyebrow: "Daily reflection",
    icon: Sparkles,
    accent: "bg-brand-soft text-brand",
    primaryAction: "Start today’s review",
    metrics: [
      { label: "Reviews", value: "0", detail: "This month" },
      { label: "Consistency", value: "0%", detail: "Evening rhythm" },
      { label: "Tomorrow", value: "—", detail: "Top priority" },
      { label: "Time needed", value: "1 min", detail: "Keep it simple" },
    ],
    focus: [
      {
        title: "What went well?",
        detail: "Notice progress",
        status: "Reflect",
      },
      {
        title: "What felt difficult?",
        detail: "Learn without judgment",
        status: "Understand",
      },
      {
        title: "What matters tomorrow?",
        detail: "Choose one priority",
        status: "Decide",
      },
    ],
    insight:
      "A short honest review is more useful than a perfect journal you stop using.",
  },
];

export const navigationGroups = [
  {
    label: "Your day",
    items: [
      {
        name: "Today",
        shortName: "Today",
        href: "/app",
        icon: LayoutDashboard,
      },
      {
        name: "Smart Inbox",
        shortName: "Inbox",
        href: "/app/inbox",
        icon: Inbox,
      },
      ...productModules
        .filter((item) =>
          ["calendar", "life-vault", "timeline"].includes(item.slug),
        )
        .map((item) => ({ ...item, href: `/app/${item.slug}` })),
    ],
  },
  {
    label: "Life management",
    items: productModules
      .filter((item) =>
        [
          "renewals",
          "rhythms",
          "money",
          "follow-ups",
          "people",
          "mobility",
          "health",
          "saved-items",
          "household",
        ].includes(item.slug),
      )
      .map((item) => ({ ...item, href: `/app/${item.slug}` })),
  },
  {
    label: "Growth & reflection",
    items: productModules
      .filter((item) =>
        [
          "goals",
          "learning",
          "milestones",
          "journal",
          "daily-review",
          "guide",
        ].includes(item.slug),
      )
      .map((item) => ({ ...item, href: `/app/${item.slug}` })),
  },
];

export function getProductModule(slug: string) {
  return productModules.find((module) => module.slug === slug);
}
