export function errorMessage(error: unknown, fallback = 'Please try again.'): string {
  const failure = error as {code?: string; message?: string};
  if (failure?.code === 'functions/unauthenticated') return 'Your child session ended. Enter your PIN again.';
  if (failure?.code === 'ALREADY_CLAIMED' || (failure?.code === 'functions/already-exists' && /someone.*claim/i.test(failure.message || ''))) return 'Someone else just grabbed this quest! Pick another one.';
  if (['functions/unavailable','functions/internal','auth/network-request-failed'].includes(failure?.code || '')) return 'Could not reach ChoreQuest. Check your connection and try again when you’re online.';
  if(typeof failure?.message === 'string' && failure.message && failure.message !== 'internal') return failure.message.replace(/^Firebase:\s*/, '').replace(/\s*\(functions\/[^)]+\)\.?$/, '');
  return fallback;
}
/** Firestore client writes: separate refused values from connectivity problems. */
export function saveErrorMessage(error: unknown): string {
  const code = (error as {code?: string})?.code || '';
  if (code === 'permission-denied' || code === 'firestore/permission-denied' || code === 'invalid-argument') return 'Some details weren’t accepted. Check the title, stars and steps, then try again. Your details are still here.';
  if (['unavailable','firestore/unavailable','deadline-exceeded','auth/network-request-failed'].includes(code)) return 'Could not reach ChoreQuest. Check your connection and try again. Your details are still here.';
  return errorMessage(error, 'Please try again. Your details are still here.');
}
