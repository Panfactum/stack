import {scrollYStore} from '@/stores/documentation-store.ts'

export const scroller = document.querySelector('.scrollbar')

addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
        scrollYStore.set(scroller.scrollTop)
    }
})

scroller?.addEventListener('scroll', () => {
    scrollYStore.set(scroller.scrollTop)
})

const scrollY = scrollYStore.get()

if (scrollY) {
    scroller?.scrollTo(0, scrollY)
}
