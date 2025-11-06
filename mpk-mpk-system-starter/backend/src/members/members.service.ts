import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class MembersService {
  constructor(private prisma: PrismaService) {}

  async bulkUpsert(rows: { name: string; org_unit?: string }[]) {
    const data = (rows || []).filter(r => r?.name?.trim()).map(r => ({
      name: r.name.trim(),
      org_unit: r.org_unit?.trim() || null,
    }));
    // naive upsert by unique name
    const results = [];
    for (const r of data) {
      const res = await this.prisma.member.upsert({
        where: { name: r.name },
        update: { org_unit: r.org_unit },
        create: { name: r.name, org_unit: r.org_unit },
      });
      results.push(res);
    }
    return { added_or_updated: results.length };
  }

  async list(q: { name?: string; org_unit?: string }) {
    return this.prisma.member.findMany({
      where: {
        AND: [
          q.name ? { name: { contains: q.name, mode: 'insensitive' } } : {},
          q.org_unit ? { org_unit: { contains: q.org_unit, mode: 'insensitive' } } : {},
        ]
      },
      orderBy: { name: 'asc' }
    });
  }
}
