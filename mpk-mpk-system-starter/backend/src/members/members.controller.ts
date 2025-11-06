import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { MembersService } from './members.service';
import { IsOptional, IsString } from 'class-validator';

class BulkMemberDto {
  name!: string;
  org_unit?: string;
}
class ListQuery {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() org_unit?: string;
}

@Controller('members')
export class MembersController {
  constructor(private readonly svc: MembersService) {}

  @Post('bulk')
  async bulk(@Body() payload: BulkMemberDto[]) {
    return this.svc.bulkUpsert(payload);
  }

  @Get()
  async list(@Query() q: ListQuery) {
    return this.svc.list(q);
  }
}
