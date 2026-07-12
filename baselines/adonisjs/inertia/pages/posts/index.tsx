import type { InertiaProps } from '~/types'
import type { Data } from '@generated/data'

type PageProps = InertiaProps<{
}>

export default function Index({}: PageProps) {
  return (
    <div>
      <h1>Index</h1>
    </div>
  )
}