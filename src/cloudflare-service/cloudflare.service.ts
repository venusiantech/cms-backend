import axios from 'axios';

interface CloudflareZoneResponse {
  result: {
    id: string;
    name: string;
    status: string;
    name_servers: string[];
  };
  success: boolean;
  errors: any[];
  messages: any[];
}

export class CloudflareService {
  private apiToken: string;
  private accountId: string;
  private baseUrl = 'https://api.cloudflare.com/client/v4';

  constructor() {
    this.apiToken = process.env.CLOUDFLARE_API_TOKEN || '';
    this.accountId = process.env.CLOUDFLARE_ACCOUNT_ID || '';

    if (!this.apiToken || !this.accountId) {
      console.warn(
        '⚠️  Cloudflare credentials not configured. DNS zone creation will be skipped.'
      );
    }
  }

  async addDnsZone(domainName: string): Promise<{
    zoneId: string;
    status: string;
    nameServers: string[];
  } | null> {
    if (!this.apiToken || !this.accountId) {
      console.log('❌ Cloudflare not configured, skipping DNS zone creation');
      return null;
    }

    try {
      console.log(`\n🌐 Creating Cloudflare DNS zone for: ${domainName}`);

      const response = await axios.post<CloudflareZoneResponse>(
        `${this.baseUrl}/zones`,
        {
          account: {
            id: this.accountId,
          },
          name: domainName,
          type: 'full',
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data.success && response.data.result) {
        const { id, status, name_servers } = response.data.result;

        console.log(`✅ DNS zone created successfully!`);
        console.log(`   Zone ID: ${id}`);
        console.log(`   Status: ${status}`);
        console.log(`   Name Servers: ${name_servers.join(', ')}`);

        return {
          zoneId: id,
          status: status,
          nameServers: name_servers,
        };
      } else {
        console.error(
          '❌ Cloudflare API returned unsuccessful response:',
          response.data.errors
        );
        return null;
      }
    } catch (error: any) {
      console.error('❌ Failed to create Cloudflare DNS zone:', error.message);
      if (error.response?.data) {
        console.error('   Error details:', error.response.data);
      }
      // Don't throw error, just return null to continue domain creation
      return null;
    }
  }

  async checkZoneStatus(zoneId: string): Promise<string | null> {
    if (!this.apiToken) {
      return null;
    }

    try {
      const response = await axios.get(`${this.baseUrl}/zones/${zoneId}`, {
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.data.success && response.data.result) {
        return response.data.result.status;
      }

      return null;
    } catch (error: any) {
      console.error('❌ Failed to check zone status:', error.message);
      return null;
    }
  }
}
