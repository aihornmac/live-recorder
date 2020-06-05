declare module 'chrono-node' {
  /**
   * parse date string and return Date
   * @param dateString date string
   * @param referenceDate reference date
   */
  export function parseDate(dateString: string, referenceDate?: Date): Date | null
}
