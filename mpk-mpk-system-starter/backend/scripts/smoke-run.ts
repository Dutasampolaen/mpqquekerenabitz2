import { MembersController } from '../src/members/members.controller';
import { MembersService } from '../src/members/members.service';
import { ProposalsController } from '../src/proposals/proposals.controller';
import { ProposalsService } from '../src/proposals/proposals.service';
import { BadRequestException } from '@nestjs/common';

type MemberRow = { id: bigint; name: string; org_unit: string | null };
type ProposalRow = { id: string; title: string; status: string };
type ProposalMemberRow = { proposal_id: string; member_id: bigint };

class FakeDatabase {
  private membersByName = new Map<string, MemberRow>();
  private membersById = new Map<bigint, MemberRow>();
  private proposals = new Map<string, ProposalRow>();
  private proposalMembers = new Map<string, Set<bigint>>();
  private memberSeq = 1n;

  upsertMember(name: string, orgUnit: string | null) {
    const existing = this.membersByName.get(name);
    if (existing) {
      existing.org_unit = orgUnit;
      return { ...existing };
    }
    const row: MemberRow = { id: this.memberSeq++, name, org_unit: orgUnit };
    this.membersByName.set(name, row);
    this.membersById.set(row.id, row);
    return { ...row };
  }

  findMembers(filters: { name?: string; org_unit?: string }) {
    const rows = Array.from(this.membersById.values());
    const byName = filters.name?.toLowerCase();
    const byOrg = filters.org_unit?.toLowerCase();
    return rows
      .filter(row => {
        if (byName && !row.name.toLowerCase().includes(byName)) {
          return false;
        }
        if (byOrg) {
          const org = row.org_unit?.toLowerCase() ?? '';
          if (!org.includes(byOrg)) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(row => ({ ...row }));
  }

  upsertProposal(id: string) {
    if (!this.proposals.has(id)) {
      this.proposals.set(id, { id, title: 'Draft', status: 'DRAFT' });
    }
  }

  replaceProposalMembers(proposalId: string, memberIds: bigint[]) {
    const uniq = new Set(memberIds);
    this.proposalMembers.set(proposalId, uniq);
  }

  listProposalMembers(proposalId: string) {
    return Array.from(this.proposalMembers.get(proposalId) ?? []);
  }
}

const db = new FakeDatabase();

const fakePrisma = {
  member: {
    upsert: async ({ where, update, create }: any) => db.upsertMember(where.name ?? create.name, update.org_unit ?? create.org_unit ?? null),
    findMany: async ({ where }: any) => {
      const [nameFilter = {}, orgFilter = {}] = where?.AND ?? [];
      return db.findMembers({
        name: nameFilter?.name?.contains,
        org_unit: orgFilter?.org_unit?.contains
      });
    }
  },
  proposal: {
    upsert: async ({ where }: any) => {
      db.upsertProposal(where.id);
      return { id: where.id } as ProposalRow;
    }
  },
  proposalMember: {
    deleteMany: async ({ where }: any) => {
      db.replaceProposalMembers(where.proposal_id, []);
      return { count: 0 };
    },
    createMany: async ({ data }: any) => {
      const ids = data.map((row: ProposalMemberRow) => row.member_id);
      db.replaceProposalMembers(data[0]?.proposal_id ?? '', ids);
      return { count: ids.length };
    }
  }
} as const;

async function main() {
  const membersService = new MembersService(fakePrisma as unknown as any);
  const membersController = new MembersController(membersService);
  const proposalsService = new ProposalsService(fakePrisma as unknown as any);
  const proposalsController = new ProposalsController(proposalsService);

  const seedMembers = [
    { name: `Alice ${Math.random().toString(36).slice(2, 6)}`, org_unit: 'Litbang' },
    { name: `Budi ${Math.random().toString(36).slice(2, 6)}`, org_unit: 'Akademik' },
    { name: `Cici ${Math.random().toString(36).slice(2, 6)}`, org_unit: 'Logistik' },
    { name: `Dodi ${Math.random().toString(36).slice(2, 6)}`, org_unit: 'Litbang' }
  ];

  console.log('➡️ Bulk import anggota acak');
  const bulkResult = await membersController.bulk(seedMembers);
  console.log('Hasil bulk:', bulkResult);

  console.log('\n➡️ Ambil semua anggota');
  const allMembers = await membersController.list({} as any);
  console.log(allMembers);

  console.log('\n➡️ Filter anggota bidang Litbang');
  const filtered = await membersController.list({ org_unit: 'litbang' } as any);
  console.log(filtered);

  const proposalId = `proposal-${Math.random().toString(36).slice(2, 7)}`;
  const memberIds = allMembers.slice(0, 3).map(row => row.id.toString());

  console.log(`\n➡️ Set anggota untuk proposal ${proposalId}`);
  const setResult = await proposalsController.setMembers(proposalId, { memberIds } as any);
  console.log('Hasil set anggota:', setResult);

  console.log('\n➡️ Coba kirim payload tidak valid (kurang dari 3 anggota)');
  try {
    await proposalsController.setMembers('invalid-proposal', { memberIds: memberIds.slice(0, 2) } as any);
  } catch (err) {
    if (err instanceof BadRequestException) {
      console.log('Validasi bekerja:', err.message);
    } else {
      throw err;
    }
  }

  console.log('\n➡️ Simpan ulang proposal dengan anggota duplikat (harus tetap unik)');
  const duplicatePayload = [...memberIds, memberIds[0]];
  const secondResult = await proposalsController.setMembers(proposalId, { memberIds: duplicatePayload } as any);
  console.log('Hasil set anggota kedua:', secondResult);

  console.log('\nSemua fitur utama berhasil diuji dengan data acak.');
}

main().catch(err => {
  console.error('Terjadi kesalahan saat menjalankan smoke test:', err);
  process.exit(1);
});
