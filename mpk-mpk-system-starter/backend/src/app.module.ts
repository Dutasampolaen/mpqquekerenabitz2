import { Module } from '@nestjs/common';
import { MembersModule } from './members/members.module';
import { ProposalsModule } from './proposals/proposals.module';
import { PrismaService } from './prisma.service';

@Module({
  imports: [MembersModule, ProposalsModule],
  providers: [PrismaService],
})
export class AppModule {}
