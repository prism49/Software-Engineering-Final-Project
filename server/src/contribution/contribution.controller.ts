import { Controller, Get, Param } from '@nestjs/common';
import { ContributionService } from './contribution.service';

@Controller()
export class ContributionController {
  constructor(private readonly contributionService: ContributionService) {}

  /** GET /api/projects/:id/contributions */
  @Get('projects/:id/contributions')
  calculate(@Param('id') id: string) {
    return this.contributionService.calculate(Number(id));
  }
}
