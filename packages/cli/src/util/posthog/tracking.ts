import { PostHog } from 'posthog-node'

export const phClient = new PostHog(
  'phc_lc2HxJoKHiUOqvjW7pGsWTLaXj7gTGEO59KYGdMEYSc',
  {
    host: 'https://us.i.posthog.com'
  }
)