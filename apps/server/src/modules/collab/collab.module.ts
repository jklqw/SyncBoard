import { Module } from '@nestjs/common';
import { CollabGateway } from './collab.gateway';
import { CollabService } from './collab.service';
import { PersistenceService } from './persistence.service';
import { WsTicketService } from './ws-ticket.service';

@Module({
  providers: [CollabService, PersistenceService, WsTicketService, CollabGateway],
  exports: [CollabService, PersistenceService, WsTicketService],
})
export class CollabModule {}
