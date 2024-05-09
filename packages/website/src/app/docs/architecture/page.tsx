import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'

export default function Page () {
  return (
    <Tabs
      value={'4'}
      variant="scrollable"
    >
      <Tab
        label="Very long string 1"
        value="1"
      />
      <Tab
        label="Very long string 2"
        value="2"
      />
      <Tab
        label="Very long string 3"
        value="3"
      />
      <Tab
        label="Very long string 4"
        value="4"
      />
    </Tabs>
  )
}
