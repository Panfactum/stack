import {
  type AddlFeatures,
  FeatureName,
  type Plan,
} from '@/components/pricing/pricing-table.tsx'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CURRENCY_FORMAT } from '@/lib/utils.ts'

interface Props {
  plan: Plan
  addlFeatures: { [featureName in FeatureName]?: number }
}

export function PricingHeader({ plan, addlFeatures, ...props }: Props) {
  if (!plan) {
    return null
  }

  const planAddlFeatures = Object.keys(addlFeatures).reduce((acc, key) => {
    const feature = plan.features[key as FeatureName]

    return (
      acc + (feature.qty?.price || 0) * (addlFeatures[key as FeatureName] || 0)
    )
  }, 0)

  return (
    <div className="flex flex-col gap-y-3xl pb-3xl self-stretch">
      <div className="flex gap-x-md border-b border-secondary pb-xl">
        <h3 className="text-primary text-xl font-semibold">{plan.name}</h3>
        {plan.popular ? (
          <Badge variant="brand" size="md">
            Popular
          </Badge>
        ) : undefined}
      </div>

      <div className="flex flex-col gap-y-xl items-start">
        <h3 className="text-display-sm xl:text-display-md font-medium whitespace-nowrap">
          {CURRENCY_FORMAT.format(plan.price + planAddlFeatures)}{' '}
          <span className="text-md text-tertiary">per month</span>
        </h3>
        <p className="text-sm text-tertiary whitespace-nowrap">{plan.description}</p>
      </div>

      <Button variant="primary" size="xl">
        Chat with Sales
      </Button>
    </div>
  )
}
