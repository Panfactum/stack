import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable'
import React, { useEffect, useState } from 'react'
import GridWrapper from './GridWrapper'
import SortableItem from './SortableItem'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'

function moveItemInArray(array: any[], fromIndex: number, toIndex: number) {
  if (
    fromIndex < 0 ||
    fromIndex >= array.length ||
    toIndex < 0 ||
    toIndex >= array.length
  ) {
    throw new Error('Invalid indices: Ensure indices are within array bounds.')
  }

  // Remove the item from its current position
  const [item] = array.splice(fromIndex, 1)

  // Insert the item at the new position
  array.splice(toIndex, 0, item)

  return array
}

const lastFiveNumbers = [0, 6, 7, 8, 9]
const lastFiveNumbersMD = [
  3, 4, 5, 6, 7, 10, 11, 12, 13, 14, 17, 18, 19, 20, 21, 24, 25, 26, 27, 28, 31,
  32, 33, 34, 35, 38, 39, 40, 41, 42, 45, 46, 47, 48, 49, 52, 53, 54, 55, 56,
  59, 60, 61, 62, 63, 66,
]
const lastSevenNumbersMD = [
  {
    root: 2,
    children: [3, 4, 5, 6, 7],
  },
  {
    root: 9,
    children: [10, 11, 12, 13, 14],
  },
  {
    root: 16,
    children: [17, 18, 19, 20, 21],
  },
  {
    root: 23,
    children: [24, 25, 26, 27, 28],
  },
  {
    root: 30,
    children: [31, 32, 33, 34, 35],
  },
  {
    root: 37,
    children: [38, 39, 40, 41, 42],
  },
  {
    root: 44,
    children: [45, 46, 47, 48, 49],
  },
  {
    root: 51,
    children: [52, 53, 54, 55, 56],
  },
  {
    root: 58,
    children: [59, 60, 61, 62, 63],
  },
  {
    root: 65,
    children: [66],
  },
]

function roundDownToNearestFive(num: number) {
  if (typeof num !== 'number') {
    throw new Error('Input must be a number')
  }

  return Math.floor(num / 5) * 5
}

enum TabOptions {
  ALL = 'All',
  CATEGORY_B = 'Category-B',
  CATEGORY_C = 'Category-C',
  CATEGORY_D = 'Category-D',
}

const defaultItems = [
  {
    id: 1,
    icon: 'move-icon-postgres.svg',
    title: 'PostgresSQL',
    category: TabOptions.CATEGORY_B,
    content:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    avg_savings: 1982,
  },
  {
    id: 2,
    icon: 'move-icon-cilium.svg',
    title: 'Cilium',
    category: TabOptions.CATEGORY_C,
    content:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    avg_savings: 1982,
  },
  {
    id: 3,
    icon: 'move-icon-vault.svg',
    title: 'Vault',
    category: TabOptions.CATEGORY_D,
    content:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    avg_savings: 1982,
  },
  {
    id: 4,
    icon: 'move-icon-canary-checker.svg',
    title: 'Canary',
    category: TabOptions.CATEGORY_B,
    content:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    avg_savings: 1982,
  },
  {
    id: 5,
    icon: 'move-icon-redis.svg',
    title: 'Redis',
    category: TabOptions.CATEGORY_C,
    content:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    avg_savings: 1982,
  },
  {
    id: 6,
    icon: 'move-icon-ferris-wheel.svg',
    title: 'Ferris Wheel',
    category: TabOptions.CATEGORY_D,
    content:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    avg_savings: 1982,
  },
  {
    id: 7,
    icon: 'move-icon-clip.svg',
    title: 'Clip',
    category: TabOptions.CATEGORY_B,
    content:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    avg_savings: 1982,
  },
  {
    id: 8,
    icon: 'move-icon-keda.svg',
    title: 'Keda',
    category: TabOptions.CATEGORY_C,
    content:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    avg_savings: 1982,
  },
  {
    id: 9,
    icon: 'move-icon-anchor.svg',
    title: 'Cert Manager',
    category: TabOptions.CATEGORY_D,
    content:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    avg_savings: 1982,
  },
  {
    id: 10,
    icon: 'move-icon-grafana.svg',
    title: 'Grafana',
    category: TabOptions.CATEGORY_B,
    content:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    avg_savings: 1982,
  },
  {
    id: 11,
    icon: 'move-icon-argo.svg',
    title: 'Argo',
    category: TabOptions.CATEGORY_C,
    content:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    avg_savings: 1982,
  },
  {
    id: 12,
    icon: 'move-icon-lock-key.svg',
    title: 'Lock Key',
    category: TabOptions.CATEGORY_D,
    content:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    avg_savings: 1982,
  },
  {
    id: 13,
    icon: 'move-icon-ocean.svg',
    title: 'Ocean Waves',
    category: TabOptions.CATEGORY_B,
    content:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    avg_savings: 1982,
  },
  {
    id: 14,
    icon: 'move-icon-prometheus.svg',
    title: 'Prometheus',
    category: TabOptions.CATEGORY_C,
    content:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    avg_savings: 1982,
  },
  {
    id: 15,
    icon: 'move-icon-k.svg',
    title: 'K',
    category: TabOptions.CATEGORY_D,
    content:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    avg_savings: 1982,
  },
  {
    id: 16,
    icon: 'move-icon-green-cube.svg',
    title: 'Green Cube',
    category: TabOptions.CATEGORY_B,
    content:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    avg_savings: 1982,
  },

  {
    id: 17,
    icon: 'move-icon-postgres.svg',
    title: 'PostgresSQL',
    category: TabOptions.CATEGORY_B,
    content:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    avg_savings: 1982,
  },
  {
    id: 18,
    icon: 'move-icon-cilium.svg',
    title: 'Cilium',
    category: TabOptions.CATEGORY_C,
    content:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    avg_savings: 1982,
  },
  {
    id: 19,
    icon: 'move-icon-vault.svg',
    title: 'Vault',
    category: TabOptions.CATEGORY_D,
    content:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    avg_savings: 1982,
  },
  {
    id: 20,
    icon: 'move-icon-canary-checker.svg',
    title: 'Canary',
    category: TabOptions.CATEGORY_B,
    content:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    avg_savings: 1982,
  },
  {
    id: 21,
    icon: 'move-icon-redis.svg',
    title: 'Redis',
    category: TabOptions.CATEGORY_C,
    content:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    avg_savings: 1982,
  },
  {
    id: 22,
    icon: 'move-icon-ferris-wheel.svg',
    title: 'Ferris Wheel',
    category: TabOptions.CATEGORY_D,
    content:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    avg_savings: 1982,
  },
  {
    id: 23,
    icon: 'move-icon-clip.svg',
    title: 'Clip',
    category: TabOptions.CATEGORY_B,
    content:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    avg_savings: 1982,
  },
  {
    id: 24,
    icon: 'move-icon-keda.svg',
    title: 'Keda',
    category: TabOptions.CATEGORY_C,
    content:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    avg_savings: 1982,
  },
  {
    id: 25,
    icon: 'move-icon-anchor.svg',
    title: 'Cert Manager',
    category: TabOptions.CATEGORY_D,
    content:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    avg_savings: 1982,
  },
  {
    id: 26,
    icon: 'move-icon-grafana.svg',
    title: 'Grafana',
    category: TabOptions.CATEGORY_B,
    content:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    avg_savings: 1982,
  },
  {
    id: 27,
    icon: 'move-icon-argo.svg',
    title: 'Argo',
    category: TabOptions.CATEGORY_C,
    content:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    avg_savings: 1982,
  },
  {
    id: 28,
    icon: 'move-icon-lock-key.svg',
    title: 'Lock Key',
    category: TabOptions.CATEGORY_D,
    content:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    avg_savings: 1982,
  },
  {
    id: 29,
    icon: 'move-icon-ocean.svg',
    title: 'Ocean Waves',
    category: TabOptions.CATEGORY_B,
    content:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    avg_savings: 1982,
  },
  {
    id: 30,
    icon: 'move-icon-prometheus.svg',
    title: 'Prometheus',
    category: TabOptions.CATEGORY_C,
    content:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    avg_savings: 1982,
  },
  {
    id: 31,
    icon: 'move-icon-k.svg',
    title: 'K',
    category: TabOptions.CATEGORY_D,
    content:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    avg_savings: 1982,
  },
  {
    id: 32,
    icon: 'move-icon-green-cube.svg',
    title: 'Green Cube',
    category: TabOptions.CATEGORY_B,
    content:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    avg_savings: 1982,
  },
  {
    id: 33,
    icon: 'move-icon-postgres.svg',
    title: 'PostgresSQL',
    category: TabOptions.CATEGORY_B,
    content:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    avg_savings: 1982,
  },
  {
    id: 34,
    icon: 'move-icon-cilium.svg',
    title: 'Cilium',
    category: TabOptions.CATEGORY_C,
    content:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    avg_savings: 1982,
  },
  {
    id: 35,
    icon: 'move-icon-vault.svg',
    title: 'Vault',
    category: TabOptions.CATEGORY_D,
    content:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    avg_savings: 1982,
  },
  {
    id: 36,
    icon: 'move-icon-canary-checker.svg',
    title: 'Canary',
    category: TabOptions.CATEGORY_B,
    content:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    avg_savings: 1982,
  },
  {
    id: 37,
    icon: 'move-icon-redis.svg',
    title: 'Redis',
    category: TabOptions.CATEGORY_C,
    content:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    avg_savings: 1982,
  },
  {
    id: 38,
    icon: 'move-icon-ferris-wheel.svg',
    title: 'Ferris Wheel',
    category: TabOptions.CATEGORY_D,
    content:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    avg_savings: 1982,
  },
  {
    id: 39,
    icon: 'move-icon-clip.svg',
    title: 'Clip',
    category: TabOptions.CATEGORY_B,
    content:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    avg_savings: 1982,
  },
  {
    id: 40,
    icon: 'move-icon-keda.svg',
    title: 'Keda',
    category: TabOptions.CATEGORY_C,
    content:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    avg_savings: 1982,
  },
  {
    id: 41,
    icon: 'move-icon-anchor.svg',
    title: 'Cert Manager',
    category: TabOptions.CATEGORY_D,
    content:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    avg_savings: 1982,
  },
  {
    id: 42,
    icon: 'move-icon-grafana.svg',
    title: 'Grafana',
    category: TabOptions.CATEGORY_B,
    content:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    avg_savings: 1982,
  },
  {
    id: 43,
    icon: 'move-icon-argo.svg',
    title: 'Argo',
    category: TabOptions.CATEGORY_C,
    content:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    avg_savings: 1982,
  },
  {
    id: 44,
    icon: 'move-icon-lock-key.svg',
    title: 'Lock Key',
    category: TabOptions.CATEGORY_D,
    content:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    avg_savings: 1982,
  },
  {
    id: 45,
    icon: 'move-icon-ocean.svg',
    title: 'Ocean Waves',
    category: TabOptions.CATEGORY_B,
    content:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    avg_savings: 1982,
  },
  {
    id: 46,
    icon: 'move-icon-prometheus.svg',
    title: 'Prometheus',
    category: TabOptions.CATEGORY_C,
    content:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    avg_savings: 1982,
  },
  {
    id: 47,
    icon: 'move-icon-k.svg',
    title: 'K',
    category: TabOptions.CATEGORY_D,
    content:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    avg_savings: 1982,
  },
  {
    id: 48,
    icon: 'move-icon-green-cube.svg',
    title: 'Green Cube',
    category: TabOptions.CATEGORY_B,
    content:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    avg_savings: 1982,
  },
  {
    id: 49,
    icon: 'move-icon-postgres.svg',
    title: 'PostgresSQL',
    category: TabOptions.CATEGORY_B,
    content:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    avg_savings: 1982,
  },
  {
    id: 50,
    icon: 'move-icon-cilium.svg',
    title: 'Cilium',
    category: TabOptions.CATEGORY_C,
    content:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    avg_savings: 1982,
  },
  {
    id: 51,
    icon: 'move-icon-vault.svg',
    title: 'Vault',
    category: TabOptions.CATEGORY_D,
    content:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    avg_savings: 1982,
  },
  {
    id: 52,
    icon: 'move-icon-canary-checker.svg',
    title: 'Canary',
    category: TabOptions.CATEGORY_B,
    content:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    avg_savings: 1982,
  },
  {
    id: 53,
    icon: 'move-icon-redis.svg',
    title: 'Redis',
    category: TabOptions.CATEGORY_C,
    content:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    avg_savings: 1982,
  },
  {
    id: 54,
    icon: 'move-icon-ferris-wheel.svg',
    title: 'Ferris Wheel',
    category: TabOptions.CATEGORY_D,
    content:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    avg_savings: 1982,
  },
  {
    id: 55,
    icon: 'move-icon-clip.svg',
    title: 'Clip',
    category: TabOptions.CATEGORY_B,
    content:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    avg_savings: 1982,
  },
  {
    id: 56,
    icon: 'move-icon-keda.svg',
    title: 'Keda',
    category: TabOptions.CATEGORY_C,
    content:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    avg_savings: 1982,
  },
  {
    id: 57,
    icon: 'move-icon-anchor.svg',
    title: 'Cert Manager',
    category: TabOptions.CATEGORY_D,
    content:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    avg_savings: 1982,
  },
  {
    id: 58,
    icon: 'move-icon-grafana.svg',
    title: 'Grafana',
    category: TabOptions.CATEGORY_B,
    content:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    avg_savings: 1982,
  },
  {
    id: 59,
    icon: 'move-icon-argo.svg',
    title: 'Argo',
    category: TabOptions.CATEGORY_C,
    content:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    avg_savings: 1982,
  },
  {
    id: 60,
    icon: 'move-icon-lock-key.svg',
    title: 'Lock Key',
    category: TabOptions.CATEGORY_D,
    content:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    avg_savings: 1982,
  },
  {
    id: 61,
    icon: 'move-icon-ocean.svg',
    title: 'Ocean Waves',
    category: TabOptions.CATEGORY_B,
    content:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    avg_savings: 1982,
  },
  {
    id: 62,
    icon: 'move-icon-prometheus.svg',
    title: 'Prometheus',
    category: TabOptions.CATEGORY_C,
    content:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    avg_savings: 1982,
  },
  {
    id: 63,
    icon: 'move-icon-k.svg',
    title: 'K',
    category: TabOptions.CATEGORY_D,
    content:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    avg_savings: 1982,
  },
  {
    id: 64,
    icon: 'move-icon-green-cube.svg',
    title: 'Green Cube',
    category: TabOptions.CATEGORY_B,
    content:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    avg_savings: 1982,
  },
  {
    id: 65,
    icon: 'move-icon-postgres.svg',
    title: 'PostgresSQL',
    category: TabOptions.CATEGORY_B,
    content:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    avg_savings: 1982,
  },
  {
    id: 66,
    icon: 'move-icon-cilium.svg',
    title: 'Cilium',
    category: TabOptions.CATEGORY_C,
    content:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    avg_savings: 1982,
  },
]

const tabs = [
  TabOptions.ALL,
  TabOptions.CATEGORY_B,
  TabOptions.CATEGORY_C,
  TabOptions.CATEGORY_D,
]

const VariableSizeMasonry = () => {
  const [currentTab, setCurrentTab] = useState<TabOptions>(TabOptions.ALL)
  const [mediaQuery, setMediaQuery] = useState<string>()
  const [activeItemId, setActiveItemId] = useState<number | null>(null)
  const [items, setItems] = useState<
    {
      id: number
      icon: string
      title: string
      category: string
      content: string
      avg_savings: number
    }[]
  >(defaultItems)
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      distance: 5,
      delay: 300,
    }),
  )

  useEffect(() => {
    const handleMediaQueryChange = (event) => {
      setActiveItemId(null)
      if (event.target.matchMedia('(max-width: 640px)').matches) {
        setMediaQuery('xs')
      } else if (event.target.matchMedia('(max-width: 768px)').matches) {
        setMediaQuery('sm')
      } else if (event.target.matchMedia('(max-width: 1280px)').matches) {
        setMediaQuery('md')
      } else {
        setMediaQuery('lg')
      }
    }

    if (window) {
      if (window.matchMedia('(max-width: 640px)').matches) {
        setMediaQuery('xs')
      } else if (window.matchMedia('(max-width: 768px)').matches) {
        setMediaQuery('sm')
      } else if (window.matchMedia('(max-width: 1280px)').matches) {
        setMediaQuery('md')
      } else {
        setMediaQuery('lg')
      }
    }
    window.addEventListener('resize', handleMediaQueryChange)

    // Cleanup the event listener on component unmount
    return () => {
      window.removeEventListener('resize', handleMediaQueryChange)
    }
  }, [])

  useEffect(() => {
    if (mediaQuery && !['sm', 'md', 'lg'].includes(mediaQuery)) {
      setActiveItemId(null)
    }
  }, [mediaQuery])

  useEffect(() => {
    setActiveItemId(null)
    if (currentTab === TabOptions.ALL) {
      setItems(defaultItems)
    }
    if (currentTab === TabOptions.CATEGORY_B) {
      const categoryBItems = defaultItems.filter(
        (item) => item.category === TabOptions.CATEGORY_B,
      )
      setItems(
        categoryBItems.map((item, index) => ({ ...item, id: index + 1 })),
      )
    }
    if (currentTab === TabOptions.CATEGORY_C) {
      const categoryCItems = defaultItems.filter(
        (item) => item.category === TabOptions.CATEGORY_C,
      )
      setItems(
        categoryCItems.map((item, index) => ({ ...item, id: index + 1 })),
      )
    }
    if (currentTab === TabOptions.CATEGORY_D) {
      const categoryDItems = defaultItems.filter(
        (item) => item.category === TabOptions.CATEGORY_D,
      )
      setItems(
        categoryDItems.map((item, index) => ({ ...item, id: index + 1 })),
      )
    }
  }, [currentTab])

  const activateItem = (itemId: number) => {
    setItems((pv) => pv.sort((a, b) => a.id - b.id))
    const onesDigit = Math.abs(itemId) % 10
    const tensDigit = Math.floor(Math.abs(itemId) / 10) % 10
    console.log('mediaQuery', mediaQuery)
    if (mediaQuery === 'lg' && lastFiveNumbers.includes(onesDigit)) {
      if (tensDigit !== 0) {
        setItems((pv) => {
          const newPayload = moveItemInArray(
            pv,
            itemId - 1,
            parseInt(`${onesDigit === 0 ? tensDigit - 1 : tensDigit}5`),
          )
          return newPayload
        })
      } else {
        setItems((pv) => {
          const newPayload = moveItemInArray(
            pv,
            onesDigit === 0 ? 9 : onesDigit - 1,
            5,
          )
          return newPayload
        })
      }
    }
    if (mediaQuery === 'md' && lastFiveNumbersMD.includes(itemId)) {
      const findRoot = lastSevenNumbersMD.find((item) =>
        item.children.includes(itemId),
      )?.root
      if (findRoot) {
        setItems((pv) => {
          const newPayload = moveItemInArray(pv, itemId - 1, findRoot)
          return newPayload
        })
      }
    }

    if (mediaQuery === 'sm') {
      const root = roundDownToNearestFive(itemId - 1)
      setItems((pv) => {
        const newPayload = moveItemInArray(pv, itemId - 1, root)
        return newPayload
      })
    }
    if (['sm', 'md', 'lg'].includes(mediaQuery!)) {
      setActiveItemId(itemId)
    }
  }

  return (
    <>
      <div className="hidden md:grid tab grid-cols-4 items-center justify-items-center w-full gap-4 mb-16 border-b border-primary md:max-w-lg lg:max-w-xl xl:max-w-2xl mx-auto">
        {tabs.map((tab, index) => (
          <div
            key={`tab-item-${index}`}
            className={`tab col-span-1 text-md py-2 w-full flex items-center justify-center cursor-pointer ${currentTab === tab ? 'font-semibold border-b-2 border-brand-secondary text-brand-secondary' : 'text-quaternary'}`}
            onClick={() => setCurrentTab(tab)}
          >
            {tab}
          </div>
        ))}
      </div>
      <div className="flex justify-center max-w-none w-64 mx-auto sm:max-w-md sm:w-full md:hidden mb-8">
        <div className="max-w-md w-full z-50">
          <Select
            value={currentTab}
            onValueChange={(value) => setCurrentTab(value as TabOptions)}
            
          >
            <SelectTrigger className="border-secondary h-[46px]">
              <SelectValue placeholder="Select a category" />
            </SelectTrigger>
            <SelectContent>
              {tabs.map((tab) => (
                <SelectItem key={`tab-${tab}`} value={tab}>
                  {tab}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
      </div>
      <div className="max-w-3xl mx-auto">
        <GridWrapper>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragMove={() => setActiveItemId(null)}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={items} strategy={rectSortingStrategy}>
              {items.map((id, index) => (
                <SortableItem
                  key={`sort-item-${id.id}`}
                  id={id?.id}
                  isExpanded={activeItemId === id.id ? true : false}
                  content={id}
                  onClick={() => activateItem(index + 1)}
                />
              ))}
            </SortableContext>
          </DndContext>
        </GridWrapper>
      </div>
    </>
  )

  function handleDragEnd(event) {
    const { active, over } = event
    console.log(active, over)

    if (active.id === over.id) {
      activateItem(active.id)
    }

    if (active.id !== over.id) {
      setActiveItemId(null)
      setItems((items) => {
        const oldIndex = items.findIndex((item) => item.id === active?.id)
        const newIndex = items.findIndex((item) => item.id === over?.id)

        return arrayMove(items, oldIndex, newIndex)
      })
    }
  }
}

export default VariableSizeMasonry
