import type { FilterSet } from '@panfactum/primary-api'

import type { CRUDResultType } from '@/lib/hooks/queries/util/CRUDResultType'

export type FilterConfig<ResultType extends CRUDResultType> = {[prop in keyof ResultType]?: FilterSet}

type FilterParamObject<ResultType extends CRUDResultType, FilterType extends FilterConfig<ResultType>> = {
  [K in keyof FilterType]: FilterType[K] extends 'boolean' ? (
    {field: (string & K), operator: 'boolean', value: boolean}
    ): never
} | {
  [K in keyof FilterType]: FilterType[K] extends 'string' ? (
    {field: (string & K), operator: 'strEq', value: string}
    ): never
} | {
  [K in keyof FilterType]: FilterType[K] extends 'name' ? (
    {field: (string & K), operator: 'strEq', value: string} |
    {field: (string & K), operator: 'nameSearch', value: string}
    ): never
} | {
  [K in keyof FilterType]: FilterType[K] extends 'number' ? (
    {field: (string & K), operator: 'numEq', value: number} |
    {field: (string & K), operator: 'gt', value: number} |
    {field: (string & K), operator: 'gte', value: number} |
    {field: (string & K), operator: 'lt', value: number} |
    {field: (string & K), operator: 'lte', value: number}
    ): never
} | {
  [K in keyof FilterType]: FilterType[K] extends 'date' ? (
    {field: (string & K), operator: 'before', value: number} |
    {field: (string & K), operator: 'after', value: number}
    ): never
}

export type FilterParamList<ResultType extends CRUDResultType, FilterType extends FilterConfig<ResultType>> = Array<
  FilterParamObject<ResultType, FilterType>[keyof FilterType] | {field: 'ids', operator: '', value: string[]}
>
