import { Controller, Get, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ReportService } from './report.service';

@Controller()
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  /** GET /api/projects/:id/report/charts — 图表数据 */
  @Get('projects/:id/report/charts')
  charts(@Param('id') id: string) {
    return this.reportService.charts(Number(id));
  }

  /** GET /api/projects/:id/report/export — 导出 Excel */
  @Get('projects/:id/report/export')
  async exportExcel(@Param('id') id: string, @Res() res: Response) {
    const buffer = await this.reportService.exportExcel(Number(id));
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="project-${id}-report.xlsx"`);
    res.send(buffer);
  }
}
