import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger, ConsoleLogger } from '@nestjs/common';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

class CustomLogger extends ConsoleLogger {
  log(message: string, context?: string) {
    // Suppress route mapping and dependency initialization logs
    if (
      context === 'RoutesResolver' ||
      context === 'RouterExplorer' ||
      context === 'InstanceLoader' ||
      message.includes('Mapped {') ||
      message.includes('dependencies initialized')
    ) {
      return;
    }
    super.log(message, context);
  }

  error(message: string, stack?: string, context?: string) {
    // Always show errors
    super.error(message, stack, context);
  }

  warn(message: string, context?: string) {
    // Always show warnings
    super.warn(message, context);
  }
}

async function bootstrap() {
  // Create HTTP application with reduced logging
  const app = await NestFactory.create(AppModule, {
    logger: new CustomLogger(),
  });
  
  // Global exception filter
  app.useGlobalFilters(new HttpExceptionFilter());

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // CORS configuration
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  });

  // Connect TCP microservice
  const tcpHost = process.env.MAIN_APP_HOST || 'localhost';
  const tcpPort = parseInt(process.env.MAIN_APP_TCP_PORT || '3001');
  
  const microservice = app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.TCP,
    options: {
      host: tcpHost,
      port: tcpPort,
    },
  });

  await app.startAllMicroservices();

  const httpPort = process.env.MAIN_APP_HTTP_PORT || process.env.PORT || 3001;
  await app.listen(httpPort);
  
  const logger = new Logger('Bootstrap');
  logger.log(`🚀 Main App HTTP is running on: http://localhost:${httpPort}`);
  logger.log(`📡 Main App TCP microservice is running on: ${tcpHost}:${tcpPort}`);
}

bootstrap();

