import { PostHog } from 'posthog-node'

export const phClient = new PostHog(
  'phc_OAyUkW0PitOtfs2CpzRnSS3fL5HkKwSzO4MrcIibhtA',
  {
    host: 'https://us.i.posthog.com'
  }
)