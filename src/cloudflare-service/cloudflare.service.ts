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
  private kvNamespaceId: string;
  private baseUrl = 'https://api.cloudflare.com/client/v4';

  constructor() {
    this.apiToken = process.env.CLOUDFLARE_API_TOKEN || '';
    this.accountId = process.env.CLOUDFLARE_ACCOUNT_ID || '';
    this.kvNamespaceId = process.env.CLOUDFLARE_KV_NAMESPACE_ID || '';

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
        
        // Check for specific Cloudflare errors
        const errors = error.response.data.errors || [];
        const invalidDomainError = errors.find((e: any) => e.code === 1002);
        
        if (invalidDomainError) {
          // Throw specific error for invalid domain format
          throw new Error('Invalid domain format. Domain must include a valid extension (e.g., example.com, myblog.net)');
        }
      }
      // Don't throw error for other cases, just return null to continue domain creation
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

  async addWorkerDomain(
    hostname: string,
    zoneId: string
  ): Promise<{ success: boolean; hostname: string }> {
    if (!this.apiToken || !this.accountId) {
      console.log('❌ Cloudflare not configured, skipping worker domain setup');
      return { success: false, hostname };
    }

    try {
      console.log(`\n🔧 Adding Cloudflare Worker domain: ${hostname}`);

      const response = await axios.put(
        `${this.baseUrl}/accounts/${this.accountId}/workers/domains`,
        {
          environment: 'production',
          hostname: hostname,
          service: 'jaal-routerv3',
          zone_id: zoneId,
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data.success) {
        console.log(`✅ Worker domain configured: ${hostname}`);
        return { success: true, hostname };
      }

      console.error(
        `❌ Failed to configure worker domain ${hostname}:`,
        response.data.errors
      );
      return { success: false, hostname };
    } catch (error: any) {
      console.error(
        `❌ Failed to add worker domain ${hostname}:`,
        error.message
      );
      if (error.response?.data) {
        console.error('   Error details:', error.response.data);
      }
      return { success: false, hostname };
    }
  }

  async addKvMapping(
    domainKey: string,
    subdomainValue: string
  ): Promise<{ success: boolean; key: string }> {
    if (!this.apiToken || !this.accountId || !this.kvNamespaceId) {
      console.log('❌ Cloudflare KV not configured, skipping KV mapping');
      return { success: false, key: domainKey };
    }

    try {
      console.log(
        `\n🔑 Adding KV mapping: ${domainKey} → ${subdomainValue}`
      );

      const response = await axios.put(
        `${this.baseUrl}/accounts/${this.accountId}/storage/kv/namespaces/${this.kvNamespaceId}/values/${domainKey}`,
        subdomainValue,
        {
          headers: {
            Authorization: `Bearer ${this.apiToken}`,
            'Content-Type': 'text/plain',
          },
        }
      );

      if (response.data.success) {
        console.log(`✅ KV mapping added: ${domainKey} → ${subdomainValue}`);
        return { success: true, key: domainKey };
      }

      console.error(
        `❌ Failed to add KV mapping for ${domainKey}:`,
        response.data.errors
      );
      return { success: false, key: domainKey };
    } catch (error: any) {
      console.error(
        `❌ Failed to add KV mapping for ${domainKey}:`,
        error.message
      );
      if (error.response?.data) {
        console.error('   Error details:', error.response.data);
      }
      return { success: false, key: domainKey };
    }
  }
}
