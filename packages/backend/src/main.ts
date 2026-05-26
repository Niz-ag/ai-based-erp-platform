import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Swagger Configuration
  const config = new DocumentBuilder()
    .setTitle('AMDOX ERP API')
    .setDescription('The Next-Generation Intelligent Resource Planning Platform API documentation.')
    .setVersion('1.0')
    .addTag('erp')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  app.enableCors({
    origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5000'],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  const port = process.env.BACKEND_PORT || 3000;
  app.setGlobalPrefix('api');

  await app.listen(port);
  console.log('AMDOX Backend running on http://localhost:' + port);
}
bootstrap();