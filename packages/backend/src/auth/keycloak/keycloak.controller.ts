import { Controller, Get, Query, Redirect, Req, Res, HttpStatus } from '@nestjs/common';
import { KeycloakService } from './keycloak.service';
import { AuthService } from '../auth.service';

@Controller('auth/sso')
export class KeycloakController {
  constructor(
    private readonly keycloakService: KeycloakService,
    private readonly authService: AuthService,
  ) {}

  @Get('login')
  @Redirect()
  async ssoLogin(@Query('tenantId') tenantId: string) {
    if (!tenantId) {
      return { url: '/login?error=no_tenant_id' };
    }

    if (!(await this.keycloakService.isEnabled(tenantId))) {
      return { url: '/login?error=sso_not_configured' };
    }

    const state = Buffer.from(JSON.stringify({ 
      tenantId, 
      timestamp: Date.now() 
    })).toString('base64');

    const loginUrl = await this.keycloakService.getLoginUrl(tenantId, state);
    return { url: loginUrl };
  }

  @Get('callback')
  @Redirect()
  async ssoCallback(@Query('code') code: string, @Query('state') state: string) {
    let tenantId: string;
    try {
      const decodedState = JSON.parse(Buffer.from(state, 'base64').toString());
      tenantId = decodedState.tenantId;
    } catch (e) {
      return { url: '/login?error=invalid_state' };
    }

    if (!tenantId || !(await this.keycloakService.isEnabled(tenantId))) {
      return { url: '/login?error=sso_not_configured' };
    }

    try {
      const tokens = await this.keycloakService.getToken(tenantId, code);
      const userInfo = await this.keycloakService.getUserInfo(tenantId, tokens.access_token);

      // Create or update user in our system
      const user = await this.authService.findOrCreateFromSSO({
        email: userInfo.email,
        name: userInfo.name || `${userInfo.given_name} ${userInfo.family_name}`,
        ssoId: userInfo.sub,
      });

      // Generate our JWT
      const jwt = await this.authService.generateToken(user);

      return {
        url: `/dashboard?token=${jwt.access_token}`,
      };
    } catch (error) {
      console.error('SSO callback error:', error);
      return { url: '/login?error=sso_failed' };
    }
  }

  @Get('saml')
  @Redirect()
  async samlLogin(@Query('tenantId') tenantId: string) {
    if (!tenantId || !(await this.keycloakService.isEnabled(tenantId))) {
      return { url: '/api/auth/login' };
    }
    const samlUrl = await this.keycloakService.getSamlLoginUrl(tenantId);
    return { url: samlUrl };
  }

  @Get('logout')
  @Redirect()
  async ssoLogout(
    @Query('refresh_token') refreshToken: string,
    @Query('tenantId') tenantId: string
  ) {
    if (tenantId && (await this.keycloakService.isEnabled(tenantId)) && refreshToken) {
      await this.keycloakService.logout(tenantId, refreshToken);
    }
    return { url: '/login?logged_out=true' };
  }

  @Get('status')
  async getSSOStatus(@Query('tenantId') tenantId: string) {
    if (!tenantId) {
      return { enabled: false };
    }
    return {
      enabled: await this.keycloakService.isEnabled(tenantId),
      provider: 'keycloak',
    };
  }
}