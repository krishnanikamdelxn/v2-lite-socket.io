import PushToken from '../models/PushToken';

interface ExpoPushMessage {
    to: string;
    sound?: 'default' | null;
    title: string;
    body: string;
    data?: Record<string, unknown>;
}

/**
 * Send push notification to a specific user via Expo Push API
 */
export const sendPushNotification = async (
    userId: string,
    title: string,
    body: string,
    data?: Record<string, unknown>
): Promise<boolean> => {
    try {
        // Get user's push token (cast query for TS)
        const pushToken = await PushToken.findOne({
            userId: userId as any,
            isActive: true
        } as any);

        if (!pushToken) {
            console.log(`[Push] No active push token for user: ${userId}`);
            return false;
        }

        const token = pushToken.token;

        // Validate Expo push token format
        if (!token.startsWith('ExponentPushToken[') && !token.startsWith('ExpoPushToken[')) {
            console.log(`[Push] Invalid token format for user: ${userId}`);
            return false;
        }

        const message: ExpoPushMessage = {
            to: token,
            sound: 'default',
            title,
            body,
            data
        };

        console.log(`[Push] Sending to ${userId}:`, { title, body });

        const response = await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Accept-encoding': 'gzip, deflate',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(message),
        });

        const result = await response.json();

        if (result.data?.status === 'error') {
            console.error(`[Push] Error:`, result.data.message);

            // Deactivate invalid tokens
            if (result.data.details?.error === 'DeviceNotRegistered') {
                await PushToken.updateOne({ _id: pushToken._id }, { isActive: false });
            }
            return false;
        }

        console.log(`[Push] Success for user: ${userId}`);
        return true;
    } catch (error) {
        console.error('[Push] Error sending notification:', error);
        return false;
    }
};

/**
 * Send push notification to multiple users
 */
export const sendPushNotificationBulk = async (
    userIds: string[],
    title: string,
    body: string,
    data?: Record<string, unknown>
): Promise<void> => {
    const promises = userIds.map(userId =>
        sendPushNotification(userId, title, body, data)
    );
    await Promise.allSettled(promises);
};
