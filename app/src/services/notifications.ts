// Push notification service for ChoreQuest
// Handles permission requests, push token registration, and local notification scheduling.

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { doc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Request push notification permissions and register the device's push token
 * in Firestore at families/{familyId}/pushTokens/{uid}.
 */
export async function registerForPushNotifications(
  familyId: string,
  uid: string
): Promise<string | null> {
  // Request permission
  const { status: existingStatus } =
    await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.warn('[Notifications] Permission not granted');
    return null;
  }

  // Android requires a notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'ChoreQuest',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#1A3E6E',
    });
  }

  // Get the Expo push token
  const tokenData = await Notifications.getExpoPushTokenAsync();
  const pushToken = tokenData.data;

  // Save token to Firestore
  const tokenDocRef = doc(db, `families/${familyId}/pushTokens/${uid}`);
  await setDoc(tokenDocRef, {
    token: pushToken,
    platform: Platform.OS,
    updatedAt: new Date().toISOString(),
  });

  console.log('[Notifications] Push token registered:', pushToken);
  return pushToken;
}

/**
 * Schedule a local notification for a badge unlock.
 */
export async function scheduleBadgeNotification(
  badge: string,
  childName: string
): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'New Badge Unlocked!',
      body: `${childName} earned the "${badge}" badge!`,
      data: { type: 'badgeUnlock', badge },
    },
    trigger: null, // Fire immediately
  });
}

/**
 * Schedule a local notification when a task is approved.
 */
export async function scheduleTaskApprovalNotification(
  taskTitle: string,
  stars: number
): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Task Approved!',
      body: `"${taskTitle}" was approved! You earned ${stars} star${stars !== 1 ? 's' : ''}.`,
      data: { type: 'taskApproval', taskTitle, stars },
    },
    trigger: null,
  });
}

/**
 * Schedule a local notification for a parent when a child submits a new request.
 */
export async function scheduleRequestNotification(
  requestTitle: string
): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'New Request',
      body: `A new request was submitted: "${requestTitle}"`,
      data: { type: 'newRequest', requestTitle },
    },
    trigger: null,
  });
}
