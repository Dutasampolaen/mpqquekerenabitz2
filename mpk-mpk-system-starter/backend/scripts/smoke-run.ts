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
    upsert: async ({ where, update, create }: any) =>
      db.upsertMember(where.name ?? create.name, update.org_unit ?? create.org_unit ?? null),
    findMany: async ({ where }: any) => {
      const [nameFilter = {}, orgFilter = {}] = where?.AND ?? [];
      return db.findMembers({
        name: nameFilter?.name?.contains,
        org_unit: orgFilter?.org_unit?.contains,
      });
    },
  },
  proposal: {
    upsert: async ({ where }: any) => {
      db.upsertProposal(where.id);
      return { id: where.id } as ProposalRow;
    },
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
    },
  },
} as const;

function assert(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

async function expectBadRequest(promise: Promise<unknown>, contains: string) {
  try {
    await promise;
    throw new Error('Expected BadRequestException was not thrown');
  } catch (err) {
    if (!(err instanceof BadRequestException)) {
      throw err;
    }
    assert(
      err.message.includes(contains),
      `Expected error message to contain "${contains}", received "${err.message}"`,
    );
  }
}

async function main() {
  const membersService = new MembersService(fakePrisma as unknown as any);
  const membersController = new MembersController(membersService);
  const proposalsService = new ProposalsService(fakePrisma as unknown as any);
  const proposalsController = new ProposalsController(proposalsService);

  const suffix = Math.random().toString(36).slice(2, 7);
  const seedMembers = [
    { name: ` Alice ${suffix} `, org_unit: ' Litbang ' },
    { name: `Budi ${suffix}`, org_unit: 'Akademik' },
    { name: '', org_unit: 'Harus diabaikan' },
    { name: `Cici ${suffix}`, org_unit: 'Logistik' },
    { name: `Dodi ${suffix}`, org_unit: undefined },
    { name: `Eka ${suffix}`, org_unit: null },
    { name: `Feri ${suffix}`, org_unit: 'Litbang' },
    { name: `Budi ${suffix}`, org_unit: 'Akademik Baru' },
    undefined as any,
  ];

  console.log('➡️ Bulk import anggota awal (mengabaikan entri tidak valid)');
  const bulkResult = await membersController.bulk(seedMembers as any);
  console.log('Hasil bulk:', bulkResult);
  assert(bulkResult.added_or_updated === 7, 'Harus memproses 7 entri valid termasuk pembaruan Budi');

  console.log('\n➡️ Ambil semua anggota');
  const allMembers = await membersController.list({} as any);
  console.log(allMembers);
  assert(allMembers.length === 6, 'Harus ada 6 anggota unik setelah bulk');
  assert(allMembers[0].name.trim().toLowerCase().startsWith('alice'), 'Alice harus berada di urutan pertama');

  console.log('\n➡️ Filter anggota bidang Litbang (case insensitive & trim)');
  const filteredByOrg = await membersController.list({ org_unit: 'litbang' } as any);
  console.log(filteredByOrg);
  assert(filteredByOrg.length >= 2, 'Sedikitnya dua anggota berasal dari Litbang');

  console.log('\n➡️ Filter anggota berdasarkan nama parsial');
  const filteredByName = await membersController.list({ name: 'ci' } as any);
  console.log(filteredByName);
  assert(filteredByName.length === 1, 'Pencarian nama harus menemukan Cici saja');

  console.log('\n➡️ Lakukan pembaruan org unit untuk Budi dan pastikan ter-upsert');
  const updateResult = await membersController.bulk([
    { name: `Budi ${suffix}`, org_unit: 'Penelitian' },
  ] as any);
  console.log('Hasil pembaruan Budi:', updateResult);
  assert(updateResult.added_or_updated === 1, 'Upsert tunggal harus melaporkan satu pembaruan');
  const budiRow = (await membersController.list({ name: 'budi' } as any))[0];
  assert(budiRow.org_unit === 'Penelitian', 'Org unit Budi harus terbarui');

  const proposalId = `proposal-${Math.random().toString(36).slice(2, 7)}`;
  const memberIds = [
    allMembers[0].id.toString(),
    Number(allMembers[1].id),
    `  ${allMembers[2].id}  `,
    String(allMembers[3].id),
  ];

  console.log(`\n➡️ Set anggota proposal ${proposalId} dengan ID campuran string/number/bigint`);
  const setResult = await proposalsController.setMembers(proposalId, { memberIds } as any);
  console.log('Hasil set anggota:', setResult);
  assert(setResult.count === 4, 'Jumlah anggota unik harus 4');
  assert(db.listProposalMembers(proposalId).length === 4, 'Database tiruan harus menyimpan 4 anggota');

  console.log('\n➡️ Coba kirim payload tidak valid (kurang dari 3 anggota)');
  await expectBadRequest(
    proposalsController.setMembers('invalid-proposal', { memberIds: memberIds.slice(0, 2) } as any),
    'minimal 3 anggota',
  );
  console.log('  ↪️ Validasi jumlah anggota berjalan');

  console.log('\n➡️ Payload dengan nilai non numerik harus gagal');
  await expectBadRequest(
    proposalsController.setMembers('invalid-proposal', { memberIds: ['bukan angka'] } as any),
    'hanya boleh mengandung angka',
  );
  console.log('  ↪️ Validasi tipe numerik berjalan');

  console.log('\n➡️ Payload dengan angka terlalu besar tanpa string harus gagal');
  await expectBadRequest(
    proposalsController.setMembers('invalid-proposal', { memberIds: [Number.MAX_SAFE_INTEGER + 10] } as any),
    'terlalu besar',
  );
  console.log('  ↪️ Validasi batas angka besar berjalan');

  console.log('\n➡️ Payload duplikat harus tetap menghasilkan anggota unik');
  const duplicatePayload = [...memberIds, memberIds[0]];
  const secondResult = await proposalsController.setMembers(proposalId, { memberIds: duplicatePayload } as any);
  console.log('Hasil set anggota kedua:', secondResult);
  assert(secondResult.count === 4, 'Duplikat harus dihilangkan sebelum penyimpanan');

  console.log('\n➡️ Kirim payload memberIds yang bukan array');
  await expectBadRequest(
    proposalsController.setMembers('invalid-proposal', { memberIds: null } as any),
    'memberIds harus berupa array',
  );
  console.log('  ↪️ Validasi tipe payload berjalan');

  console.log('\nSemua alur utama dan validasi tambahan berhasil diuji.');
}

main().catch(err => {
  console.error('Terjadi kesalahan saat menjalankan smoke test:', err);
  process.exit(1);
});
