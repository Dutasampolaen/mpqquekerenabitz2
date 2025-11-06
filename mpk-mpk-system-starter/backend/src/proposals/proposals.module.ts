import { Module } from '@nestjs/common';
import { ProposalsController } from './proposals.controller';
import { ProposalsService } from './proposals.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [ProposalsController],
  providers: [ProposalsService, PrismaService],
})
export class ProposalsModule {}
