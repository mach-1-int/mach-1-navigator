/**
 * Relative "time ago" formatting shared by the supervisor safety map views
 * (map popups, SOS timeline) and their QA verification script.
 */
export function formatTimeAgo(isoTimestamp: string, now: Date = new Date()): string {
  const diffMs = now.getTime() - new Date(isoTimestamp).getTime()
  const diffMins = Math.floor(diffMs / 60000)

  if (diffMins < 1) return "Just now"
  if (diffMins === 1) return "1 min ago"
  if (diffMins < 60) return `${diffMins} mins ago`

  const diffHours = Math.floor(diffMins / 60)
  if (diffHours === 1) return "1 hour ago"
  return `${diffHours} hours ago`
}
