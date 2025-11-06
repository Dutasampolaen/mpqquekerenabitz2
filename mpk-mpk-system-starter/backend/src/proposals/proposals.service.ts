import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class ProposalsService {
  constructor(private prisma: PrismaService) {}

  async setMembers(proposalId: string, memberIds: bigint[]) {
    // ensure proposal exists or create stub
    await this.prisma.proposal.upsert({
      where: { id: proposalId },
      update: {},
      create: { id: proposalId, title: 'Draft', status: 'DRAFT' }
    });
    // replace all members for proposal
    await this.prisma.proposalMember.deleteMany({ where: { proposal_id: proposalId } });
    await this.prisma.proposalMember.createMany({
      data: memberIds.map(mid => ({ proposal_id: proposalId, member_id: mid })),
      skipDuplicates: true
    });
    return { ok: true, count: memberIds.length };
  }
}
