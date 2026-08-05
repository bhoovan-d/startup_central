import { sql } from "drizzle-orm";
import { relations } from "drizzle-orm";
import {
  bigint,
  boolean,
  customType,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * Postgres `tsvector` isn't a first-class Drizzle type, so we declare it.
 * Used for full-text search — see the GIN indexes below. This is why the
 * project needs no Algolia/Meilisearch dependency.
 */
const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

/* -------------------------------------------------------------------------- */
/* Enums                                                                       */
/* -------------------------------------------------------------------------- */

export const startupStatusEnum = pgEnum("startup_status", [
  "active",
  "acquired",
  "shutdown",
  "dormant",
]);

export const roundTypeEnum = pgEnum("round_type", [
  "pre_seed",
  "seed",
  "pre_series_a",
  "series_a",
  "series_b",
  "series_c",
  "series_d",
  "series_e",
  "series_f_plus",
  "bridge",
  "debt",
  "grant",
  "undisclosed",
]);

export const investorTypeEnum = pgEnum("investor_type", [
  "vc",
  "angel",
  "cvc",
  "accelerator",
  "family_office",
  "sovereign",
  "other",
]);

export const innovationTypeEnum = pgEnum("innovation_type", [
  "model",
  "product",
  "research",
  "open_source",
  "patent",
  "dataset",
]);

/** Why a company died. Drives the Graveyard's cause-tag filters. */
export const shutdownCauseEnum = pgEnum("shutdown_cause", [
  "capital_crunch",
  "regulatory",
  "governance",
  "no_pmf",
  "acquihire",
  "competition",
  "cofounder_conflict",
  "pivot_failed",
  "fraud",
  "other",
]);

export const newsStatusEnum = pgEnum("news_status", [
  "pending",
  "approved",
  "rejected",
  "auto_published",
]);

export const eventTypeEnum = pgEnum("event_type", [
  "funding",
  "shutdown",
  "launch",
  "acquisition",
  "other",
]);

export const episodeStatusEnum = pgEnum("episode_status", [
  "published",
  "coming_soon",
]);

/* -------------------------------------------------------------------------- */
/* Startups                                                                    */
/* -------------------------------------------------------------------------- */

export const startups = pgTable(
  "startups",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    /**
     * Lowercased, punctuation-stripped name used to catch
     * "Krutrim" / "Krutrim SI Designs" / "Ola Krutrim" as one company.
     * Populated by the ingestion matcher, not by hand.
     */
    normalizedName: text("normalized_name").notNull(),
    tagline: text("tagline"),
    description: text("description"),
    website: text("website"),
    logoUrl: text("logo_url"),
    hqCity: text("hq_city"),
    hqState: text("hq_state"),
    foundedYear: integer("founded_year"),
    status: startupStatusEnum("status").notNull().default("active"),
    employeeRange: text("employee_range"),
    /** True only once a human has confirmed the record. */
    verified: boolean("verified").notNull().default(false),
    sourceUrls: text("source_urls").array(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    searchVector: tsvector("search_vector").generatedAlwaysAs(
      sql`setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
          setweight(to_tsvector('english', coalesce(tagline, '')), 'B') ||
          setweight(to_tsvector('english', coalesce(description, '')), 'C')`,
    ),
  },
  (t) => [
    uniqueIndex("startups_slug_idx").on(t.slug),
    uniqueIndex("startups_normalized_name_idx").on(t.normalizedName),
    index("startups_status_idx").on(t.status),
    index("startups_search_idx").using("gin", t.searchVector),
  ],
);

/* -------------------------------------------------------------------------- */
/* Founders                                                                    */
/* -------------------------------------------------------------------------- */

export const founders = pgTable(
  "founders",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    bio: text("bio"),
    linkedin: text("linkedin"),
    twitter: text("twitter"),
    photoUrl: text("photo_url"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("founders_slug_idx").on(t.slug)],
);

export const startupFounders = pgTable(
  "startup_founders",
  {
    startupId: integer("startup_id")
      .notNull()
      .references(() => startups.id, { onDelete: "cascade" }),
    founderId: integer("founder_id")
      .notNull()
      .references(() => founders.id, { onDelete: "cascade" }),
    role: text("role"),
  },
  (t) => [primaryKey({ columns: [t.startupId, t.founderId] })],
);

/* -------------------------------------------------------------------------- */
/* Funding                                                                     */
/* -------------------------------------------------------------------------- */

export const investors = pgTable(
  "investors",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    type: investorTypeEnum("type").notNull().default("vc"),
    website: text("website"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("investors_slug_idx").on(t.slug),
    uniqueIndex("investors_normalized_name_idx").on(t.normalizedName),
  ],
);

export const fundingRounds = pgTable(
  "funding_rounds",
  {
    id: serial("id").primaryKey(),
    startupId: integer("startup_id")
      .notNull()
      .references(() => startups.id, { onDelete: "cascade" }),
    roundType: roundTypeEnum("round_type").notNull().default("undisclosed"),
    /** Whole USD. Null when the round was undisclosed. */
    amountUsd: bigint("amount_usd", { mode: "number" }),
    /** Whole INR, when the source reported in rupees. */
    amountInr: bigint("amount_inr", { mode: "number" }),
    announcedDate: date("announced_date").notNull(),
    sourceUrl: text("source_url"),
    sourceName: text("source_name"),
    /** 0..1 from the extractor. 1.0 for hand-entered rows. */
    confidence: real("confidence").notNull().default(1),
    /** True when this row was written by ingestion without human review. */
    autoPublished: boolean("auto_published").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("funding_rounds_startup_idx").on(t.startupId),
    index("funding_rounds_date_idx").on(t.announcedDate),
    // Same company + same round type + same day = the same round reported twice.
    uniqueIndex("funding_rounds_dedupe_idx").on(
      t.startupId,
      t.roundType,
      t.announcedDate,
    ),
  ],
);

export const roundInvestors = pgTable(
  "round_investors",
  {
    roundId: integer("round_id")
      .notNull()
      .references(() => fundingRounds.id, { onDelete: "cascade" }),
    investorId: integer("investor_id")
      .notNull()
      .references(() => investors.id, { onDelete: "cascade" }),
    isLead: boolean("is_lead").notNull().default(false),
  },
  (t) => [primaryKey({ columns: [t.roundId, t.investorId] })],
);

/* -------------------------------------------------------------------------- */
/* Innovations — "who invented something new"                                  */
/* -------------------------------------------------------------------------- */

export const innovations = pgTable(
  "innovations",
  {
    id: serial("id").primaryKey(),
    startupId: integer("startup_id")
      .notNull()
      .references(() => startups.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    launchDate: date("launch_date"),
    type: innovationTypeEnum("type").notNull().default("product"),
    arxivUrl: text("arxiv_url"),
    githubUrl: text("github_url"),
    huggingfaceUrl: text("huggingface_url"),
    sourceUrl: text("source_url"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("innovations_startup_idx").on(t.startupId),
    index("innovations_date_idx").on(t.launchDate),
  ],
);

/* -------------------------------------------------------------------------- */
/* Graveyard                                                                   */
/* -------------------------------------------------------------------------- */

export const shutdowns = pgTable(
  "shutdowns",
  {
    id: serial("id").primaryKey(),
    startupId: integer("startup_id")
      .notNull()
      .references(() => startups.id, { onDelete: "cascade" }),
    shutdownDate: date("shutdown_date"),
    causeTags: shutdownCauseEnum("cause_tags").array().notNull(),
    /** What happened, in our own words — never copied from a source article. */
    story: text("story"),
    /** The transferable takeaway. This is the section's whole reason to exist. */
    lessons: text("lessons"),
    totalRaisedUsd: bigint("total_raised_usd", { mode: "number" }),
    sourceUrl: text("source_url"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("shutdowns_startup_idx").on(t.startupId),
    index("shutdowns_date_idx").on(t.shutdownDate),
  ],
);

/* -------------------------------------------------------------------------- */
/* Podcast                                                                     */
/* -------------------------------------------------------------------------- */

export const podcastEpisodes = pgTable(
  "podcast_episodes",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull(),
    episodeNumber: integer("episode_number"),
    title: text("title").notNull(),
    description: text("description"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    youtubeId: text("youtube_id"),
    spotifyUrl: text("spotify_url"),
    appleUrl: text("apple_url"),
    durationSeconds: integer("duration_seconds"),
    transcript: text("transcript"),
    startupId: integer("startup_id").references(() => startups.id, {
      onDelete: "set null",
    }),
    founderId: integer("founder_id").references(() => founders.id, {
      onDelete: "set null",
    }),
    status: episodeStatusEnum("status").notNull().default("coming_soon"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("podcast_episodes_slug_idx").on(t.slug),
    index("podcast_episodes_status_idx").on(t.status),
  ],
);

/* -------------------------------------------------------------------------- */
/* Ingestion                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Raw ingested articles.
 *
 * We deliberately store only the URL, title, and a SHORT excerpt for
 * attribution — never the full article body. Extracted *facts* (company,
 * amount, round, investors, date) are not copyrightable; the prose is.
 */
export const newsItems = pgTable(
  "news_items",
  {
    id: serial("id").primaryKey(),
    url: text("url").notNull(),
    title: text("title").notNull(),
    sourceName: text("source_name").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    excerpt: text("excerpt"),
    status: newsStatusEnum("status").notNull().default("pending"),
    eventType: eventTypeEnum("event_type"),
    /** The extractor's structured output, kept for auditing and re-runs. */
    extracted: text("extracted"),
    confidence: real("confidence"),
    /** Set once an extracted event has been turned into a real row. */
    resolvedStartupId: integer("resolved_startup_id").references(
      () => startups.id,
      { onDelete: "set null" },
    ),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("news_items_url_idx").on(t.url),
    index("news_items_status_idx").on(t.status),
    index("news_items_published_idx").on(t.publishedAt),
  ],
);

/* -------------------------------------------------------------------------- */
/* Taxonomy                                                                    */
/* -------------------------------------------------------------------------- */

export const tags = pgTable(
  "tags",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull(),
    label: text("label").notNull(),
    /**
     * Index into the validated 8-slot categorical chart palette.
     * Colour follows the entity, never its rank — so a filter that changes
     * the visible sector count must never repaint the survivors.
     */
    colorSlot: integer("color_slot"),
  },
  (t) => [uniqueIndex("tags_slug_idx").on(t.slug)],
);

export const startupTags = pgTable(
  "startup_tags",
  {
    startupId: integer("startup_id")
      .notNull()
      .references(() => startups.id, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.startupId, t.tagId] })],
);

/* -------------------------------------------------------------------------- */
/* Relations                                                                   */
/* -------------------------------------------------------------------------- */

export const startupsRelations = relations(startups, ({ many, one }) => ({
  founders: many(startupFounders),
  fundingRounds: many(fundingRounds),
  innovations: many(innovations),
  tags: many(startupTags),
  shutdown: one(shutdowns),
  episodes: many(podcastEpisodes),
}));

export const foundersRelations = relations(founders, ({ many }) => ({
  startups: many(startupFounders),
  episodes: many(podcastEpisodes),
}));

export const startupFoundersRelations = relations(
  startupFounders,
  ({ one }) => ({
    startup: one(startups, {
      fields: [startupFounders.startupId],
      references: [startups.id],
    }),
    founder: one(founders, {
      fields: [startupFounders.founderId],
      references: [founders.id],
    }),
  }),
);

export const fundingRoundsRelations = relations(
  fundingRounds,
  ({ one, many }) => ({
    startup: one(startups, {
      fields: [fundingRounds.startupId],
      references: [startups.id],
    }),
    investors: many(roundInvestors),
  }),
);

export const investorsRelations = relations(investors, ({ many }) => ({
  rounds: many(roundInvestors),
}));

export const roundInvestorsRelations = relations(roundInvestors, ({ one }) => ({
  round: one(fundingRounds, {
    fields: [roundInvestors.roundId],
    references: [fundingRounds.id],
  }),
  investor: one(investors, {
    fields: [roundInvestors.investorId],
    references: [investors.id],
  }),
}));

export const innovationsRelations = relations(innovations, ({ one }) => ({
  startup: one(startups, {
    fields: [innovations.startupId],
    references: [startups.id],
  }),
}));

export const shutdownsRelations = relations(shutdowns, ({ one }) => ({
  startup: one(startups, {
    fields: [shutdowns.startupId],
    references: [startups.id],
  }),
}));

export const podcastEpisodesRelations = relations(
  podcastEpisodes,
  ({ one }) => ({
    startup: one(startups, {
      fields: [podcastEpisodes.startupId],
      references: [startups.id],
    }),
    founder: one(founders, {
      fields: [podcastEpisodes.founderId],
      references: [founders.id],
    }),
  }),
);

export const tagsRelations = relations(tags, ({ many }) => ({
  startups: many(startupTags),
}));

export const startupTagsRelations = relations(startupTags, ({ one }) => ({
  startup: one(startups, {
    fields: [startupTags.startupId],
    references: [startups.id],
  }),
  tag: one(tags, { fields: [startupTags.tagId], references: [tags.id] }),
}));
