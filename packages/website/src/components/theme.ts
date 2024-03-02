import type { Components, Theme as MUITheme } from '@mui/material'
import { createTheme } from '@mui/material'

import tailwindTheme from '../../theme'
import { kanit } from '../app/font'

/************************************************
 * Hardcoded values -
 * When possible, we use hardcoded values for customizing
 * css as it enables us to improve rendering performance
 * **********************************************/

/* eslint-disable @typescript-eslint/prefer-literal-enum-member */
export enum BREAKPOINT {
  XS = 0,
  SM = tailwindTheme.screens.sm,
  MD = tailwindTheme.screens.md,
  LG = tailwindTheme.screens.lg,
  XL = tailwindTheme.screens.xl
}
/* eslint-enable @typescript-eslint/prefer-literal-enum-member */

export const WEB_NAVBAR_HEIGHT_REM = 2.9
export const WEB_NAVBAR_BORDER_WIDTH_PX = 4
export const WEB_TABBAR_HEIGHT_REM = 2.2
export const WEB_TABBAR_BORDER_WIDTH_PX = 2
export const WEB_FOOTER_HEIGHT_REM = 10
export const WEB_ARTICLE_MAX_WIDTH_PX = 1280
export const WEB_ARTICLE_SIDEBAR_WIDTH_PX = 240

/************************************************
 * Provide typings for the theme objects
 * including our extra theme properties
 * **********************************************/

interface CustomTheme {
  extraColors: {
    gray: {
      light: string
      dark: string
    };
  };
}

declare module '@mui/material/styles' {
  interface Theme extends CustomTheme{}

  // allow configuration using `createTheme`
  interface ThemeOptions extends CustomTheme {}
}

declare module '@emotion/react' {
  export interface Theme extends MUITheme {}
}

/************************************************
 * MUI Theme that the Actual MUI Framework uses
 * **********************************************/

export const theme = createTheme({
  typography: {
    fontFamily: kanit.style.fontFamily,
    fontWeightRegular: kanit.style.fontWeight
  },
  palette: {
    primary: {
      main: tailwindTheme.colors.primary,
      light: tailwindTheme.colors.neutral
    },
    secondary: {
      main: tailwindTheme.colors.secondary
    },
    warning: {
      main: tailwindTheme.colors.red
    },
    error: {
      main: tailwindTheme.colors.red
    }
  },
  extraColors: {
    gray: {
      light: tailwindTheme.colors['gray-light'],
      dark: tailwindTheme.colors['gray-dark']
    }
  },
  breakpoints: {
    values: {
      xs: BREAKPOINT.XS,
      sm: BREAKPOINT.SM,
      md: BREAKPOINT.MD,
      lg: BREAKPOINT.LG,
      xl: BREAKPOINT.XL
    }
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: `
        @font-face {
          font-family: ${kanit.style.fontFamily};
          font-style: normal;
          font-display: swap;
          font-weight: 300;
        }
      `
    }
  } as Components<Omit<MUITheme, 'components'>>
})
