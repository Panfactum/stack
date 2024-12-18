import { faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import * as React from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import Search from '@/components/documentation/search/search.tsx'
import {
  Dialog,
  DialogSearchContent,
  DialogTrigger,
} from '@/components/ui/dialog.tsx'
import { cn } from '@/lib/utils.ts'

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode
}

const SearchButton = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => {
    const [open, setOpen] = React.useState(false)

    useHotkeys(['ctrl + k'], () => setOpen(true), { preventDefault: true }, [
      setOpen,
    ])

    return (
      <>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger>
            <div
              className={cn(
                'flex h-10 items-center rounded-md border border-primary bg-primary cursor-pointer shadow-sm hover:bg-secondary px-3 gap-lg text-sm ring-offset-background focus-within:ring-1 focus-within:ring-ring focus-within:ring-offset-2',
                className,
              )}
            >
              <FontAwesomeIcon icon={faMagnifyingGlass} />
              <span>Quick Search ...</span>
              <span className={`ml-auto`}>Ctrl + K</span>
            </div>
          </DialogTrigger>
          <DialogSearchContent>
            <Search />
          </DialogSearchContent>
        </Dialog>
      </>
    )
  },
)

SearchButton.displayName = 'Search'

export { SearchButton }
