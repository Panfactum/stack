import CheckBoxIcon from '@mui/icons-material/CheckBox'
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank'
import { memo } from 'react'
interface ICheckboxFieldProps {
  value?: boolean;
}
export default memo(function CheckboxField (props: ICheckboxFieldProps) {
  const { value } = props
  return value ? <CheckBoxIcon/> : <CheckBoxOutlineBlankIcon/>
})
