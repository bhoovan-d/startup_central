import { chartVar } from "@/lib/chart-palette";
import { formatDuration, formatTimestamp, isoDate, youtubeUrl } from "@/lib/format";
import type { EpisodeRow } from "@/lib/queries/podcast";

/**
 * Episodes are catalogue entries, not media cards: the number is the loud
 * element, the way a label numbers a release.
 *
 * Every media field is nullable in the schema and every one of them is
 * checked here. A `coming_soon` episode has no video, no runtime and no date,
 * and must render as an announcement rather than as a broken player link.
 */

function CompanyTag({ episode }: { episode: EpisodeRow }) {
  if (!episode.company) return null;
  return (
    <span
      className="tag"
      style={{
        color:
          episode.colorSlot === null
            ? "var(--text-muted)"
            : chartVar(episode.colorSlot),
      }}
    >
      {episode.company.name}
    </span>
  );
}

function EpisodeNumber({ n, className, style }: { n: number | null; className: string; style?: React.CSSProperties }) {
  return (
    <span className={className} style={style}>
      {n === null ? "—" : String(n).padStart(2, "0")}
    </span>
  );
}

export function FeaturedEpisode({
  episode,
  total,
}: {
  episode: EpisodeRow;
  total: number;
}) {
  const duration = formatDuration(episode.durationSeconds);
  const published = formatTimestamp(episode.publishedAt);

  return (
    <article className="block-card grid gap-0 lg:grid-cols-[1fr_auto]">
      <div className="min-w-0 p-6 sm:p-7">
        <div className="flex items-center gap-3">
          <span className="eyebrow" style={{ color: "var(--color-marigold)" }}>
            Latest
          </span>
          <span
            aria-hidden
            className="h-px flex-1"
            style={{ background: "var(--rule-hairline)" }}
          />
        </div>

        <div className="mt-4 flex flex-wrap items-baseline gap-x-5 gap-y-2">
          <EpisodeNumber
            n={episode.episodeNumber}
            className="num text-[clamp(2.5rem,7vw,4.5rem)] font-bold leading-none tracking-tight"
            style={{ color: "var(--text-muted)" }}
          />
          <h3 className="display min-w-0 flex-1 text-[clamp(1.5rem,3vw,2.25rem)]">
            {episode.title}
          </h3>
        </div>

        {episode.guest || episode.company ? (
          <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2">
            {episode.guest ? (
              <span className="text-sm font-semibold">{episode.guest.name}</span>
            ) : null}
            <CompanyTag episode={episode} />
          </div>
        ) : null}

        {episode.description ? (
          <p
            className="mt-4 max-w-lg text-sm leading-relaxed"
            style={{ color: "var(--text-secondary)" }}
          >
            {episode.description}
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-3">
          {episode.youtubeId ? (
            <a
              className="link-block link-block--primary"
              href={youtubeUrl(episode.youtubeId)}
              target="_blank"
              rel="noopener noreferrer"
            >
              Watch on YouTube
            </a>
          ) : null}
          {episode.spotifyUrl ? (
            <a
              className="link-block"
              href={episode.spotifyUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Spotify
            </a>
          ) : null}
          {episode.appleUrl ? (
            <a
              className="link-block"
              href={episode.appleUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Apple
            </a>
          ) : null}
        </div>
      </div>

      {/* Right rail: the metadata, ruled off like a colophon. */}
      <div className="flex gap-8 border-t-[3px] p-6 sm:p-7 lg:min-w-44 lg:flex-col lg:gap-7 lg:border-l-[3px] lg:border-t-0">
        {published ? (
          <div>
            <div className="eyebrow mb-1.5">Published</div>
            <time className="num text-sm font-semibold" dateTime={isoDate(episode.publishedAt)}>
              {published}
            </time>
          </div>
        ) : null}
        {duration ? (
          <div>
            <div className="eyebrow mb-1.5">Runtime</div>
            <span className="num text-sm font-semibold">{duration}</span>
          </div>
        ) : null}
        <div>
          <div className="eyebrow mb-1.5">Episode</div>
          <span className="num text-sm font-semibold">
            {episode.episodeNumber === null
              ? "—"
              : `${String(episode.episodeNumber).padStart(2, "0")} / ${String(total).padStart(2, "0")}`}
          </span>
        </div>
      </div>
    </article>
  );
}

/** The three-up row of recent episodes under the featured one. */
export function EpisodeStrip({ episodes }: { episodes: EpisodeRow[] }) {
  if (episodes.length === 0) return null;

  return (
    <ul className="mt-6 grid gap-4 md:grid-cols-3">
      {episodes.map((ep) => {
        const duration = formatDuration(ep.durationSeconds);
        return (
          <li key={ep.slug} className="block-card-sm min-w-0 p-4">
            <div className="flex items-baseline justify-between gap-3">
              <EpisodeNumber
                n={ep.episodeNumber}
                className="num text-2xl font-bold leading-none"
                style={{ color: "var(--text-muted)" }}
              />
              {duration ? (
                <span className="num text-[0.625rem]" style={{ color: "var(--text-muted)" }}>
                  {duration}
                </span>
              ) : null}
            </div>
            <h4 className="display mt-3 text-lg leading-[1.05]">{ep.title}</h4>
            <div className="mt-3">
              <CompanyTag episode={ep} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * An announced-but-unrecorded episode. Dashed hairline rule and no offset
 * block, so it reads as unbuilt rather than merely differently coloured —
 * status is never carried by colour alone.
 */
export function UpcomingEpisode({ episode }: { episode: EpisodeRow }) {
  return (
    <article
      className="mb-6 border-2 border-dashed p-5 sm:p-6"
      style={{ borderColor: "var(--rule-hairline)" }}
    >
      <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2">
        <EpisodeNumber
          n={episode.episodeNumber}
          className="num text-3xl font-bold leading-none"
          style={{ color: "var(--text-muted)" }}
        />
        <h3
          className="display min-w-0 flex-1 text-2xl"
          style={{ color: "var(--text-secondary)" }}
        >
          {episode.title}
        </h3>
        <span className="tag" style={{ color: "var(--text-muted)" }}>
          Coming soon
        </span>
      </div>
      {episode.guest || episode.company ? (
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
          {episode.guest ? (
            <span className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>
              {episode.guest.name}
            </span>
          ) : null}
          <CompanyTag episode={episode} />
        </div>
      ) : null}
      {episode.description ? (
        <p className="mt-3 max-w-2xl text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
          {episode.description}
        </p>
      ) : null}
    </article>
  );
}

/** The full archive entry — same card, more metadata. */
export function EpisodeRowCard({ episode }: { episode: EpisodeRow }) {
  const duration = formatDuration(episode.durationSeconds);
  const published = formatTimestamp(episode.publishedAt);

  return (
    <article className="block-card grid gap-0 lg:grid-cols-[1fr_auto]">
      <div className="min-w-0 p-5 sm:p-6">
        <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2">
          <EpisodeNumber
            n={episode.episodeNumber}
            className="num text-3xl font-bold leading-none"
            style={{ color: "var(--text-muted)" }}
          />
          <h3 className="display min-w-0 flex-1 text-2xl">{episode.title}</h3>
        </div>

        {episode.guest || episode.company ? (
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
            {episode.guest ? (
              <span className="text-sm font-semibold">{episode.guest.name}</span>
            ) : null}
            <CompanyTag episode={episode} />
          </div>
        ) : null}

        {episode.description ? (
          <p className="mt-3 max-w-2xl text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            {episode.description}
          </p>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-3">
          {episode.youtubeId ? (
            <a
              className="link-block link-block--primary"
              href={youtubeUrl(episode.youtubeId)}
              target="_blank"
              rel="noopener noreferrer"
            >
              YouTube
            </a>
          ) : null}
          {episode.spotifyUrl ? (
            <a className="link-block" href={episode.spotifyUrl} target="_blank" rel="noopener noreferrer">
              Spotify
            </a>
          ) : null}
          {episode.appleUrl ? (
            <a className="link-block" href={episode.appleUrl} target="_blank" rel="noopener noreferrer">
              Apple
            </a>
          ) : null}
        </div>
      </div>

      <div className="flex gap-8 border-t-[3px] p-5 sm:p-6 lg:min-w-40 lg:flex-col lg:gap-6 lg:border-l-[3px] lg:border-t-0">
        {published ? (
          <div>
            <div className="eyebrow mb-1.5">Published</div>
            <time className="num text-sm font-semibold" dateTime={isoDate(episode.publishedAt)}>
              {published}
            </time>
          </div>
        ) : null}
        {duration ? (
          <div>
            <div className="eyebrow mb-1.5">Runtime</div>
            <span className="num text-sm font-semibold">{duration}</span>
          </div>
        ) : null}
      </div>
    </article>
  );
}
