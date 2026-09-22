import { IsIn, IsOptional, IsString } from 'class-validator';

export class ExportReportDto {
  @IsOptional()
  @IsIn(['excel', 'xlsx', 'csv', 'pdf'], {
    message: 'Format file export harus berupa: excel, csv, atau pdf',
  })
  format?: 'excel' | 'xlsx' | 'csv' | 'pdf' = 'excel';

  @IsOptional()
  @IsString()
  bulan?: string;

  @IsOptional()
  @IsString()
  tahun?: string;
}
