import { Module } from '@nestjs/common';
import { KeycloakService } from './keycloak.service';
import { KeycloakController } from './keycloak.controller';
import { AuthModule } from '../auth.module';

@Module({
  imports: [AuthModule],
  providers: [KeycloakService],
  controllers: [KeycloakController],
  exports: [KeycloakService],
})
export class KeycloakModule {}