import axios from 'axios';
const { ChatTokenBuilder } = require('agora-token');

const APP_ID = process.env.AGORA_APP_ID!;
const APP_CERTIFICATE = process.env.AGORA_APP_CERTIFICATE!;
const ORG_NAME = process.env.AGORA_CHAT_ORG_NAME!;
const APP_NAME = process.env.AGORA_CHAT_APP_NAME!;
const REST_API_DOMAIN = process.env.AGORA_CHAT_REST_API!;

const REST_URL = `https://${REST_API_DOMAIN}/${ORG_NAME}/${APP_NAME}`;

class AgoraChatService {
  private appToken: string | null = null;
  private appTokenExpiry: number = 0;

  /**
   * Generates or returns a cached App Token for administrative REST API calls.
   */
  private async getAppToken(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    
    // Return cached token if valid for at least 5 more minutes
    if (this.appToken && this.appTokenExpiry > now + 300) {
      return this.appToken;
    }

    // Generate new App Token (valid for 24h)
    const expirationTimeInSeconds = 86400;
    const privilegeExpiredTs = now + expirationTimeInSeconds;

    const token = ChatTokenBuilder.buildAppToken(
      APP_ID,
      APP_CERTIFICATE,
      privilegeExpiredTs
    );

    this.appToken = token;
    this.appTokenExpiry = privilegeExpiredTs;
    return token;
  }

  private getAuthHeader(token: string) {
    return { Authorization: `Bearer ${token}` };
  }

  /**
   * Registers a user in Agora Chat. 
   * Usernames are sanitized (e.g. user_email_com).
   */
  async registerUser(username: string): Promise<boolean> {
    const token = await this.getAppToken();
    try {
      await axios.post(
        `${REST_URL}/users`,
        {
          username,
          password: 'svsm_default_password_2026', // Simplified for internal use
        },
        { headers: this.getAuthHeader(token) }
      );
      return true;
    } catch (error: any) {
      // If user already exists, it's fine
      if (error.response?.status === 400 && error.response?.data?.error === 'duplicate_unique_property_exists') {
        return true;
      }
      console.error('[ChatService] Registration failed:', error.response?.data || error.message);
      return false;
    }
  }

  /**
   * Creates a Chat Room for a session.
   */
  async createChatRoom(sessionTitle: string, owner: string): Promise<string | null> {
    const token = await this.getAppToken();
    try {
      const response = await axios.post(
        `${REST_URL}/chatrooms`,
        {
          name: sessionTitle.substring(0, 50),
          description: `SVSM Session Chat Room: ${sessionTitle}`,
          maxusers: 500,
          owner: owner,
        },
        { headers: this.getAuthHeader(token) }
      );
      return response.data?.data?.id || null;
    } catch (error: any) {
      console.error('[ChatService] Room creation failed:', error.response?.data || error.message);
      return null;
    }
  }

  /**
   * Generates a User Token for frontend login.
   */
  generateUserToken(username: string): string {
    const expirationTimeInSeconds = 86400; // 24h
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

    return ChatTokenBuilder.buildUserToken(
      APP_ID,
      APP_CERTIFICATE,
      username,
      privilegeExpiredTs
    );
  }
}

export const agoraChatService = new AgoraChatService();
