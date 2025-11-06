import { BadRequestException, Body, Controller, Param, Put } from '@nestjs/common';
import { ProposalsService } from './proposals.service';

class SetMembersDto {
  memberIds: (number | string)[];
}
@Controller('proposals')
export class ProposalsController {
  constructor(private readonly svc: ProposalsService) {}

  @Put(':id/members')
  async setMembers(@Param('id') id: string, @Body() dto: SetMembersDto) {
    const ids = (dto.memberIds || []).map(x => typeof x === 'string' ? BigInt(parseInt(x as string)) : BigInt(x as number));
    if (ids.length < 3) throw new BadRequestException('Proposal wajib memiliki minimal 3 anggota MPK');
    return this.svc.setMembers(id, ids);
  }
}
