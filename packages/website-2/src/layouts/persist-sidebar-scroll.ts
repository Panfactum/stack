import { documentationStore } from '@/stores/documentation-store.ts'

const scroller = document.getElementById('sidebar-scroll')

addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    documentationStore.setKey('scrollY', scroller?.scrollTop)
  }
})

/* scroller?.addEventListener('scroll', () => {
  documentationStore.setKey('scrollY', scroller.scrollTop)
}) */

const scrollY = documentationStore.get().scrollY

if (scrollY) {
  scroller?.scrollTo(0, scrollY)
}
