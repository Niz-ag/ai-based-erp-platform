import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

export interface KeycloakConfig {
  realm: string;
  clientId: string;
  clientSecret: string;
  authServerUrl: string;
  callbackUrl: string;
}

@Injectable()
export class KeycloakService {
  constructor(private prisma: PrismaService) {}

  private async getConfig(tenantId: string): Promise<KeycloakConfig | null> {
    const tenantSetting = await this.prisma.tenantSetting.findUnique({
      where: { tenantId },
    });

    if (!tenantSetting || !tenantSetting.settings) {
      return null;
    }

    const settings = tenantSetting.settings as any;
    
    // Fallback to process.env if settings are not in DB for this tenant
    return {
      realm: settings.keycloak_realm || process.env.KEYCLOAK_REALM || 'amdox',
      clientId: settings.keycloak_client_id || process.env.KEYCLOAK_CLIENT_ID || 'amdox-app',
      clientSecret: settings.keycloak_client_secret || process.env.KEYCLOAK_CLIENT_SECRET || '',
      authServerUrl: settings.keycloak_url || process.env.KEYCLOAK_URL || 'http://localhost:8080',
      callbackUrl: settings.keycloak_callback_url || process.env.KEYCLOAK_CALLBACK_URL || 'http://localhost:3000/api/auth/callback',
    };
  }

  async getLoginUrl(tenantId: string, state: string): Promise<string> {
    const config = await this.getConfig(tenantId);
    if (!config) throw new Error('SSO not configured for this tenant');

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.callbackUrl,
      scope: 'openid profile email',
      state,
    });
    return `${config.authServerUrl}/realms/${config.realm}/protocol/openid-connect/auth?${params}`;
  }

  async getToken(tenantId: string, code: string): Promise<{
    access_token: string;
    refresh_token: string;
    id_token: string;
    expires_in: number;
  }> {
    const config = await this.getConfig(tenantId);
    if (!config) throw new Error('SSO not configured for this tenant');

    const response = await fetch(
      `${config.authServerUrl}/realms/${config.realm}/protocol/openid-connect/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: config.clientId,
          client_secret: config.clientSecret,
          code,
          redirect_uri: config.callbackUrl,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Keycloak token exchange failed: ${response.statusText}`);
    }

    return response.json() as Promise<{
      access_token: string;
      refresh_token: string;
      id_token: string;
      expires_in: number;
    }>;
  }

  async refreshToken(tenantId: string, refreshToken: string): Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
  }> {
    const config = await this.getConfig(tenantId);
    if (!config) throw new Error('SSO not configured for this tenant');

    const response = await fetch(
      `${config.authServerUrl}/realms/${config.realm}/protocol/openid-connect/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: config.clientId,
          client_secret: config.clientSecret,
          refresh_token: refreshToken,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Keycloak refresh failed: ${response.statusText}`);
    }

    return response.json() as Promise<{
      access_token: string;
      refresh_token: string;
      expires_in: number;
    }>;
  }

  async getUserInfo(tenantId: string, accessToken: string): Promise<{
    sub: string;
    email: string;
    name: string;
    given_name?: string;
    family_name?: string;
  }> {
    const config = await this.getConfig(tenantId);
    if (!config) throw new Error('SSO not configured for this tenant');

    const response = await fetch(
      `${config.authServerUrl}/realms/${config.realm}/protocol/openid-connect/userinfo`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!response.ok) {
      throw new Error(`Keycloak userinfo failed: ${response.statusText}`);
    }

    return response.json() as Promise<{
      sub: string;
      email: string;
      name: string;
      given_name?: string;
      family_name?: string;
    }>;
  }

  async logout(tenantId: string, refreshToken: string): Promise<void> {
    const config = await this.getConfig(tenantId);
    if (!config) return;

    await fetch(
      `${config.authServerUrl}/realms/${config.realm}/protocol/openid-connect/logout`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          refresh_token: refreshToken,
        }),
      }
    );
  }

  // SAML support
  async getSamlLoginUrl(tenantId: string): Promise<string> {
    const config = await this.getConfig(tenantId);
    if (!config) throw new Error('SSO not configured for this tenant');

    return `${config.authServerUrl}/realms/${config.realm}/protocol/saml`;
  }

  async validateSamlAssertion(tenantId: string, assertion: string): Promise<{
    nameId: string;
    attributes: Record<string, string[]>;
  }> {
    // SAML validation would go here
    return Promise.resolve({
      nameId: 'user@example.com',
      attributes: { email: ['user@example.com'], name: ['Test User'] },
    });
  }

  async isEnabled(tenantId: string): Promise<boolean> {
    const config = await this.getConfig(tenantId);
    return !!(config && config.clientSecret);
  }
}