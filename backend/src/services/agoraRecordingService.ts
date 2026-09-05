import axios from 'axios';

const AGORA_APP_ID = process.env.AGORA_APP_ID;
const CUSTOMER_ID = process.env.AGORA_CUSTOMER_ID;
const CUSTOMER_CERTIFICATE = process.env.AGORA_CUSTOMER_CERTIFICATE;

const RECORDING_BASE =
  `https://api.agora.io/v1/apps/${AGORA_APP_ID}/cloud_recording`;

const getAuthHeader = () => {
  if (!CUSTOMER_ID || !CUSTOMER_CERTIFICATE) {
    throw new Error('Agora Customer ID/Certificate not configured');
  }

  const credentials = Buffer
    .from(`${CUSTOMER_ID}:${CUSTOMER_CERTIFICATE}`)
    .toString('base64');

  return {
    Authorization: `Basic ${credentials}`,
    'Content-Type': 'application/json',
  };
};

class AgoraRecordingService {

  private isConfigured(): boolean {
    return Boolean(
      AGORA_APP_ID &&
      CUSTOMER_ID &&
      CUSTOMER_CERTIFICATE
    );
  }

  /**
   * Acquire a recording resource.
   */
  async acquireResource(
    channelName: string,
    uid: string
  ): Promise<string | null> {

    if (!this.isConfigured()) {
      console.warn(
        '[Recording] Agora recording credentials are not configured'
      );

      return null;
    }

    try {
      const response = await axios.post(
        `${RECORDING_BASE}/acquire`,
        {
          cname: channelName,
          uid,
          clientRequest: {
            resourceExpiredHour: 24,
            scene: 0,
          },
        },
        {
          headers: getAuthHeader(),
        }
      );

      const resourceId = response.data?.resourceId;

      if (!resourceId) {
        console.error(
          '[Recording] Agora did not return a resourceId',
          response.data
        );

        return null;
      }

      console.log(
        `[Recording] Resource acquired for ${channelName}`
      );

      return resourceId;

    } catch (error: any) {
      console.error(
        '[Recording] Acquire failed:',
        error?.response?.status,
        error?.response?.data || error.message
      );

      return null;
    }
  }

  /**
   * Start cloud recording.
   */
  async startRecording(
    channelName: string,
    uid: string,
    token: string,
    resourceId: string,
    storageConfig?: Record<string, any>
  ): Promise<{ sid: string } | null> {

    if (!this.isConfigured()) {
      return null;
    }

    try {

      const storage = storageConfig || {
        vendor: 0,
        region: 0,
        bucket: '',
        accessKey: '',
        secretKey: '',
        fileNamePrefix: [
          'rulevid',
          channelName,
        ],
      };

      const response = await axios.post(
        `${RECORDING_BASE}/resourceid/${resourceId}/mode/mix/start`,
        {
          cname: channelName,
          uid,

          clientRequest: {
            token,

            recordingConfig: {
              maxIdleTime: 300,
              streamTypes: 2,
              channelType: 0,
              videoStreamType: 0,

              transcodingConfig: {
                width: 1280,
                height: 720,
                fps: 15,
                bitrate: 2000,
              },
            },

            storageConfig: storage,
          },
        },
        {
          headers: getAuthHeader(),
        }
      );

      const sid = response.data?.sid;

      if (!sid) {
        console.error(
          '[Recording] Agora did not return SID',
          response.data
        );

        return null;
      }

      console.log(
        `[Recording] Started: channel=${channelName}, sid=${sid}`
      );

      return { sid };

    } catch (error: any) {
      console.error(
        '[Recording] Start failed:',
        error?.response?.status,
        error?.response?.data || error.message
      );

      return null;
    }
  }

  /**
   * Stop cloud recording.
   */
  async stopRecording(
    channelName: string,
    uid: string,
    resourceId: string,
    sid: string
  ): Promise<any | null> {

    if (!this.isConfigured()) {
      return null;
    }

    try {

      const response = await axios.post(
        `${RECORDING_BASE}/resourceid/${resourceId}/sid/${sid}/mode/mix/stop`,
        {
          cname: channelName,
          uid,
          clientRequest: {},
        },
        {
          headers: getAuthHeader(),
        }
      );

      console.log(
        '[Recording] Stop response:',
        JSON.stringify(response.data, null, 2)
      );

      return response.data;

    } catch (error: any) {
      console.error(
        '[Recording] Stop failed:',
        error?.response?.status,
        error?.response?.data || error.message
      );

      return null;
    }
  }
}

export const agoraRecordingService =
  new AgoraRecordingService();