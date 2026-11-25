type AnyFunction = (...args: never[]) => unknown

type Primitive = string | number | boolean | bigint | symbol | null | undefined | Date | AnyFunction

type PathKey = string | number

type ArrayKey = number

export type DataPath<TData> = TData extends Primitive
  ? never
  : TData extends readonly (infer TItem)[]
    ? TItem extends Primitive
      ? `${ArrayKey}`
      : `${ArrayKey}` | `${ArrayKey}.${DataPath<TItem>}`
    : {
        [TKey in Extract<keyof TData, PathKey>]: TData[TKey] extends Primitive
          ? `${TKey}`
          : TData[TKey] extends readonly (infer TItem)[]
            ? TItem extends Primitive
              ? `${TKey}` | `${TKey}.${ArrayKey}`
              : `${TKey}` | `${TKey}.${ArrayKey}` | `${TKey}.${ArrayKey}.${DataPath<TItem>}`
            : `${TKey}` | `${TKey}.${DataPath<TData[TKey]>}`
      }[Extract<keyof TData, PathKey>]

export function getValueByPath<TData>(record: TData, path: DataPath<TData> | string): unknown {
  return String(path)
    .split('.')
    .reduce<unknown>((currentValue, key) => {
      if (currentValue == null) return undefined
      if (typeof currentValue !== 'object') return undefined

      return (currentValue as Record<string, unknown>)[key]
    }, record)
}
