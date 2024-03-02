import { Kanit, Roboto_Mono } from 'next/font/google'

export const kanit = Kanit({
  weight: ['300', '400', '500', '600', '700'],
  subsets: ['latin'],
  preload: true
})

export const roboto = Roboto_Mono({
  weight: ['400'],
  subsets: ['latin'],
  preload: true
})
