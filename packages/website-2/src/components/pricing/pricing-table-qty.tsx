import { faMinus, faPlus } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { ButtonGroup } from '@/components/ui/button-group.tsx'
import { Button } from '@/components/ui/button.tsx'

interface Prop {
  qty: {
    included: number
    price: number
  }

  addl: number

  onChange: (qty: number) => void
}

export function PricingTableQty({ qty, addl, onChange }: Prop) {
  if (!qty) {
    return undefined
  }

  return (
    <>
      <ButtonGroup className={`justify-center`}>
        <Button
          variant="outline"
          size="icon"
          onClick={() => onChange(addl - 1)}
        >
          <FontAwesomeIcon icon={faMinus} />
        </Button>

        <Button variant="outline" size="icon">
          {qty.included + addl}
        </Button>

        <Button
          variant="outline"
          size="icon"
          onClick={() => onChange(addl + 1)}
        >
          <FontAwesomeIcon icon={faPlus} />
        </Button>
      </ButtonGroup>
      <p className={`hidden lg:block text-sm text-tertiary mt-lg`}>
        {qty.included} included • ${qty.price} each/mo
      </p>
    </>
  )
}
