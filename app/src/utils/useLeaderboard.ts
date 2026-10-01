import { useEffect, useState } from 'react';
import { useFamilyStore } from '../stores/familyStore';
import { loadLeaderboard } from '../services/leaderboard';
import type { LeaderboardEntry, LeaderboardPeriod } from './leaderboard';
export function useLeaderboard(period: LeaderboardPeriod) {
  const family = useFamilyStore((s) => s.family);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setEntries([]); setError(null); setLoading(true);
    if (!family) { setLoading(false); return; }
    loadLeaderboard(family.id, family.timezone || 'UTC', period).then((data) => { if (!cancelled) setEntries(data); }).catch(() => { if (!cancelled) setError('Could not load scores. Pull down to retry.'); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [family, period, refresh]);
  return { entries, loading, error, reload: () => setRefresh((value) => value + 1) };
}
