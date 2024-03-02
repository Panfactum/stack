import Checkbox from '@mui/material/Checkbox'
import type {
  GridEventPublisher,
  GridRowSelectionCheckboxParams
} from '@mui/x-data-grid-pro'
import type { ChangeEvent, KeyboardEvent } from 'react'
import { memo, useCallback, useEffect, useRef } from 'react'

interface IGridCellCheckboxRendererProps {
  id: string
  value?: boolean
  hasFocus: boolean
  tabIndex: number
  rowType: string
  selectable: boolean
  label: string,
  onSelect: GridEventPublisher
}

// This is an extremely paired down version of the
// GridCellCheckboxRenderer which is used for the selection checkbox on each row.
// Profiling showed that this checkbox was _always_ being re-rendered when grid data
// changed and it was a surprisingly heavyweight component. This removes all of the
// non-critical data dependencies that could have caused re-rendering and then
// memoizes the component. This resulted in a substantial performance improvement.
// https://github.com/mui/mui-x/blob/master/packages/grid/x-data-grid/src/components/columnSelection/GridCellCheckboxRenderer.tsx#L32
export default memo(function RowSelectionField (props: IGridCellCheckboxRendererProps) {
  const {
    id,
    value: isChecked,
    hasFocus,
    tabIndex,
    rowType,
    selectable,
    label,
    onSelect
  } = props
  const checkboxElement = useRef<HTMLButtonElement | null>(null)
  const handleChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const params: GridRowSelectionCheckboxParams = { value: event.target.checked, id }
    onSelect('rowSelectionCheckboxChange', params, event)
  }, [onSelect, id])

  useEffect(() => {
    if (hasFocus) {
      const input = checkboxElement.current?.querySelector('input')
      input?.focus({ preventScroll: true })
    }
  }, [hasFocus])

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === ' ' || event.key === 'Spacebar') {
      // We call event.stopPropagation to avoid selecting the row and also scrolling to bottom
      event.stopPropagation()
    }
  }, [])

  if (rowType === 'footer' || rowType === 'pinnedRow') {
    return null
  }

  return (
    <Checkbox
      ref={checkboxElement}
      tabIndex={tabIndex}
      checked={isChecked}
      onChange={handleChange}
      inputProps={{ 'aria-label': label }}
      onKeyDown={handleKeyDown}
      disabled={!selectable}
      disableRipple
    />
  )
})
