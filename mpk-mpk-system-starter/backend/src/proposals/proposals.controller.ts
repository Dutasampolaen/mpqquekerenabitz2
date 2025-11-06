import { BadRequestException, Body, Controller, Param, Put } from '@nestjs/common';
import { ProposalsService } from './proposals.service';

class SetMembersDto {
  memberIds: (number | string)[];
}

function normalizeMemberId(value: number | string, index: number): bigint {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || !Number.isInteger(value)) {
      throw new BadRequestException(`ID anggota pada indeks ${index} harus berupa bilangan bulat`);
    }
    if (!Number.isSafeInteger(value)) {
      throw new BadRequestException(`ID anggota pada indeks ${index} terlalu besar, kirim sebagai string`);
    }
    return BigInt(value);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      throw new BadRequestException(`ID anggota pada indeks ${index} tidak boleh kosong`);
    }
    if (!/^\d+$/.test(trimmed)) {
      throw new BadRequestException(`ID anggota pada indeks ${index} hanya boleh mengandung angka`);
    }
    return BigInt(trimmed);
  }

  throw new BadRequestException(`ID anggota pada indeks ${index} tidak valid`);
}

@Controller('proposals')
export class ProposalsController {
  constructor(private readonly svc: ProposalsService) {}

  @Put(':id/members')
  async setMembers(@Param('id') id: string, @Body() dto: SetMembersDto) {
    if (!dto || !Array.isArray(dto.memberIds)) {
      throw new BadRequestException('memberIds harus berupa array');
    }

    const ids = dto.memberIds.map((value, index) => normalizeMemberId(value, index));
    const uniqueIds = Array.from(new Set(ids));

    if (uniqueIds.length < 3) {
      throw new BadRequestException('Proposal wajib memiliki minimal 3 anggota MPK');
    }

    return this.svc.setMembers(id, uniqueIds);
  }
}
