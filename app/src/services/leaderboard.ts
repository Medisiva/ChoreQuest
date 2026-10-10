import { db } from './firebase';
import { getDocs, getDoc, doc, query, where, Timestamp } from 'firebase/firestore';
import { childProfilesRef, parentUsersRef, starTransactionsRef, parentStarTransactionsRef } from './firestore';
import { earnedInPeriod, type LeaderboardEntry, type LeaderboardPeriod } from '../utils/leaderboard';
export async function loadLeaderboard(familyId: string, timezone: string, period: LeaderboardPeriod, targetProgress = false): Promise<LeaderboardEntry[]> {
  const settings = await getDoc(doc(db, 'families', familyId, 'settings', 'config'));
  if (settings.data()?.leaderboardEnabled === false) return [];
  const now = new Date();
  // A civil month is at most 31 days; padding covers timezone offsets and DST.
  const since = Timestamp.fromMillis(now.getTime() - 33 * 86400000);
  const [children, parents, childLedger, parentLedger] = await Promise.all([
    getDocs(childProfilesRef(familyId)), getDocs(parentUsersRef(familyId)),
    period === 'allTime' ? null : getDocs(query(starTransactionsRef(familyId), where('createdAt', '>=', since))),
    period === 'allTime' ? null : getDocs(query(parentStarTransactionsRef(familyId), where('createdAt', '>=', since))),
  ]);
  const childRecords = childLedger?.docs.map((doc) => doc.data()) ?? [];
  const parentRecords = parentLedger?.docs.map((doc) => doc.data()) ?? [];
  return [
    ...children.docs.map((doc): LeaderboardEntry => { const child = doc.data(); return { id: child.id, name: child.nickname, avatarEmoji: '🧒', role: 'child', stars: period === 'allTime' ? child.totalStarsEarned ?? 0 : earnedInPeriod(childRecords.filter((r) => r.childProfileId === child.id && (!targetProgress || r.transactionType !== 'streakBonus')), timezone, period, now) }; }),
    ...parents.docs.map((doc): LeaderboardEntry => { const parent = doc.data(); return { id: parent.id, name: parent.displayName, avatarEmoji: '🧑', role: 'parent', stars: period === 'allTime' ? parent.totalStarsEarned ?? 0 : earnedInPeriod(parentRecords.filter((r) => r.parentUserId === parent.id), timezone, period, now) }; }),
  ].sort((a, b) => b.stars - a.stars || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}
