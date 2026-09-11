import axios from 'axios';
import { logger } from '../logger';

const AGORA_APP_ID = process.env.AGORA_APP_ID;
const CUSTOMER_ID = process.env.AGORA_CUSTOMER_ID;
const CUSTOMER_CERTIFICATE = process.env.AGORA_CUSTOMER_CERTIFICATE;

class AgoraChannelService {
  private getAuthHeader() {
    if (!CUSTOMER_ID || !CUSTOMER_CERTIFICATE) {
      throw new Error('Agora Customer ID or Customer Certificate is missing');
    }
    const credentials = Buffer.from(`${CUSTOMER_ID}:${CUSTOMER_CERTIFICATE}`).toString('base64');
    return {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Query the live user count currently inside an Agora channel.
   * Returns the count of users (host + attendees + recording bots).
   */
  async getChannelUserCount(channelName: string): Promise<number> {
    if (!AGORA_APP_ID || !CUSTOMER_ID || !CUSTOMER_CERTIFICATE) {
      return 0;
    }

    try {
      const response = await axios.get(
        `https://api.agora.io/dev/v1/channel/user/${AGORA_APP_ID}/${encodeURIComponent(channelName)}`,
        { headers: this.getAuthHeader(), timeout: 5000 }
      );

      if (response.data && response.data.success && response.data.data) {
        if (response.data.data.channel_exist) {
          return response.data.data.total || 0;
        }
      }
      return 0;
    } catch (error: any) {
      logger.warn(
        { channelName, err: error.message },
        '[AgoraChannelService] Failed to query active channel users'
      );
      return 0;
    }
  }

  /**
   * Forcefully kick all participants and terminate an Agora RTC channel.
   * This immediately prevents any participant (e.g. stranded attendees)
   * from consuming additional RTC minutes from the platform subscription.
   */
  async kickAllFromChannel(channelName: string, durationMinutes: number = 60): Promise<boolean> {
    if (!AGORA_APP_ID || !CUSTOMER_ID || !CUSTOMER_CERTIFICATE) {
      logger.warn('[AgoraChannelService] Agora credentials not set — skipping channel kick');
      return false;
    }

    try {
      const response = await axios.post(
        'https://api.agora.io/dev/v1/kicking-rule',
        {
          appid: AGORA_APP_ID,
          cname: channelName,
          time: Math.max(1, Math.min(1440, durationMinutes)),
          privileges: ['join_channel'],
        },
        { headers: this.getAuthHeader(), timeout: 5000 }
      );

      logger.info(
        { channelName, kickRuleId: response.data?.id },
        `[AgoraChannelService] Kicking rule applied. Channel ${channelName} terminated on Agora.`
      );
      return true;
    } catch (error: any) {
      logger.error(
        { channelName, err: error.response?.data || error.message },
        '[AgoraChannelService] Failed to apply kicking rule for channel'
      );
      return false;
    }
  }
}

export const agoraChannelService = new AgoraChannelService();
