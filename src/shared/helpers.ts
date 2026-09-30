
/**
 * @description JSON.stringify(), but sorts the keys for consistency.
 */
export default function stringifySorted(obj: any): string {
  return JSON.stringify(obj, (_, value) => {
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      return Object.keys(value).sort().reduce((sorted: Record<string, unknown>, key) => {
        sorted[key] = value[key]
        return sorted
      }, {})
    }
    return value
  })
}