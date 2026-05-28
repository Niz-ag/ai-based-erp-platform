import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const port = process.env.BACKEND_PORT || 3000;
  app.setGlobalPrefix('api/v1', {
    exclude: ['health/live', 'health/ready'],
  });

  // Swagger Configuration
  const config = new DocumentBuilder()
    .setTitle('AMDOX ERP API')
    .setDescription('The Next-Generation Intelligent Resource Planning Platform API documentation.')
    .setVersion('1.0')
    .addTag('erp')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);

  app.enableCors({
    origin: true, // Allow all origins for the pilot/testing phase
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  await app.listen(port);
  console.log('AMDOX Backend running on http://localhost:' + port);
}
bootstrap();