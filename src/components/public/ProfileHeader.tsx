import type { Theme } from '@/lib/theme/spec'
import type { ProfileRow } from '@/lib/supabase/types'

const AVATAR_SHAPE: Record<Theme['avatarShape'], string> = {
  circle: 'rounded-full',
  rounded: 'rounded-2xl',
  square: 'rounded-none',
}

/** The identity block at the top of a public page, in four layouts. */
export default function ProfileHeader({
  profile,
  theme,
}: {
  profile: ProfileRow
  theme: Theme
}) {
  const name = profile.display_name || `@${profile.handle}`
  const initial = name.replace('@', '').charAt(0).toUpperCase()
  const shape = AVATAR_SHAPE[theme.avatarShape]

  const avatar = profile.avatar_url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={profile.avatar_url}
      alt={name}
      className={`${shape} h-24 w-24 object-cover`}
      style={{ boxShadow: '0 0 0 4px var(--pg-bg)' }}
    />
  ) : (
    <div
      className={`${shape} flex h-24 w-24 items-center justify-center text-3xl font-semibold`}
      style={{
        background: 'var(--pg-accent)',
        color: 'var(--pg-accent-contrast)',
        boxShadow: '0 0 0 4px var(--pg-bg)',
      }}
      aria-hidden
    >
      {initial}
    </div>
  )

  const details = (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">{name}</h1>
      {profile.tagline ? (
        <p className="pg-accent mt-1 text-sm font-medium">{profile.tagline}</p>
      ) : null}
      {profile.bio ? (
        <p className="pg-muted mt-2 text-sm leading-relaxed">{profile.bio}</p>
      ) : null}
    </>
  )

  if (theme.header === 'minimal') {
    return <header className="pt-10">{details}</header>
  }

  if (theme.header === 'left') {
    return (
      <header className="flex items-start gap-4 pt-10">
        <div className="shrink-0">{avatar}</div>
        <div className="min-w-0 pt-1">{details}</div>
      </header>
    )
  }

  if (theme.header === 'cover') {
    return (
      <header>
        <div
          className="-mx-5 h-40 sm:mx-0 sm:rounded-b-[var(--pg-radius)]"
          style={{
            background: theme.headerImage
              ? `center / cover no-repeat url(${JSON.stringify(theme.headerImage)})`
              : `linear-gradient(135deg, var(--pg-accent), color-mix(in srgb, var(--pg-accent) 55%, #000))`,
          }}
        />
        <div className="-mt-12">
          {avatar}
          <div className="mt-4">{details}</div>
        </div>
      </header>
    )
  }

  return (
    <header className="flex flex-col items-center pt-12 text-center">
      {avatar}
      <div className="mt-4">{details}</div>
    </header>
  )
}
