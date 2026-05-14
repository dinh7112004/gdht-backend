import { Global, Module } from '@nestjs/common';
import { EventsGateway } from './events.gateway';

@Global() // Để Global để mọi module khác đều dùng được
@Module({
  providers: [EventsGateway],
  exports: [EventsGateway],
})
export class EventsModule {}
