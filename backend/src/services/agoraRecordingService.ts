import axios from 'axios';

const AGORA_APP_ID = process.env.AGORA_APP_ID!;
const CUSTOMER_ID = process.env.AGORA_CUSTOMER_ID!;
const CUSTOMER_CERTIFICATE = process.env.AGORA_CUSTOMER_CERTIFICATE!;

// Basic Auth header for Agora Console API
const getAuthHeader = () => {
  const credentials = Buffer.from(`${CUSTOMER_ID}:${CUSTOMER_CERTIFICATE}`).toString('base64');
  return { Authorization: `Basic ${credentials}` };
};

const RECORDING_BASE = `https://api.agora.io/v1/apps/${AGORA_APP_ID}/cloud_recording`;

class AgoraRecordingService {
  private isConfigured(): boolean {
    return !!(AGORA_APP_ID && CUSTOMER_ID && CUSTOMER_CERTIFICATE);
  }

  /**
   * Step 1: Acquire a resource ID before starting a recording.
   */
  async acquireResource(channelName: string, uid: string): Promise<string | null> {
    if (!this.isConfigured()) {
      console.warn('[Recording] Agora credentials not configured — skipping recording');
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
            scene: 0, // 0 = individual recording
          },
        },
        { headers: { ...getAuthHeader(), 'Content-Type': 'application/json' } }
      );
      return response.data.resourceId;
    } catch (error: any) {
      console.error('[Recording] Failed to acquire resource:', error?.response?.data || error.message);
      return null;
    }
  }

  /**
   * Step 2: Start the cloud recording session.
   * Returns { resourceId, sid } needed to stop later.
   */
  async startRecording(
    channelName: string,
    uid: string,
    token: string,
    resourceId: string,
    storageConfig?: object
  ): Promise<{ sid: string } | null> {
    if (!this.isConfigured()) return null;
    try {
      // Default to Agora's temporary storage if no S3 config provided
      const storage = storageConfig || {
        vendor: 0, // Agora temporary storage
        region: 0,
        bucket: '',
        accessKey: '',
        secretKey: '',
        fileNamePrefix: ['svsm', channelName],
      };

      const response = await axios.post(
        `${RECORDING_BASE}/resourceid/${resourceId}/mode/mix/start`,
        {
          cname: channelName,
          uid,
          clientRequest: {
            token,
            recordingConfig: {
              maxIdleTime: 300, // Stop if no participants for 5 mins
              streamTypes: 2,   // 0=audio, 1=video, 2=both
              channelType: 0,   // 0=communication, 1=live
              videoStreamType: 0,
              transcodingConfig: {
                width: 1280, height: 720, fps: 15, bitrate: 2000,
              },
            },
            storageConfig: storage,
          },
        },
        { headers: { ...getAuthHeader(), 'Content-Type': 'application/json' } }
      );
      return { sid: response.data.sid };
    } catch (error: any) {
      console.error('[Recording] Failed to start recording:', error?.response?.data || error.message);
      return null;
    }
  }

  /**
   * Step 3: Stop the recording and retrieve the file URL.
   */
  async stopRecording(
    channelName: string,
    uid: string,
    resourceId: string,
    sid: string
  ): Promise<string | null> {
    if (!this.isConfigured()) return null;
    try {
      const response = await axios.post(
        `${RECORDING_BASE}/resourceid/${resourceId}/sid/${sid}/mode/mix/stop`,
        {
          cname: channelName,
          uid,
          clientRequest: {},
        },
        { headers: { ...getAuthHeader(), 'Content-Type': 'application/json' } }
      );

      const fileList = response.data?.serverResponse?.fileList;
      if (fileList && fileList.length > 0) {
        // Return the first recording file URL
        return fileList[0].fileName || null;
      }
      return null;
    } catch (error: any) {
      console.error('[Recording] Failed to stop recording:', error?.response?.data || error.message);
      return null;
    }
  }
}

export const agoraRecordingService = new AgoraRecordingService();
