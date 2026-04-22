export function extractApiError(err: unknown, fallback = 'Something went wrong'): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const res = (err as { response?: { data?: { error?: { message?: string } } } }).response
    return res?.data?.error?.message ?? fallback
  }
  return fallback
}
