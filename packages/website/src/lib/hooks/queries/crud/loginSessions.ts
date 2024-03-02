import type {
  LoginSessionFiltersType,
  LoginSessionResultType, LoginSessionSortType
} from '@panfactum/primary-api'

import { RQGetResourceHookFactory } from '@/lib/hooks/queries/util/RQGetResourceHookFactory'

export const {
  useGetOne: useGetOneLoginSession,
  usePrefetchGetOne: usePrefetchGetOneLoginSession,
  useGetList: useGetListLoginSession,
  usePrefetchGetList: usePrefetchGetListLoginSession
} = RQGetResourceHookFactory<
  LoginSessionResultType,
  LoginSessionSortType,
  LoginSessionFiltersType
>(
  'login-session',
  '/v1/login-sessions'
)
