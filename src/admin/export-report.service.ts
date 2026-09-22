import { Injectable, NotFoundException } from '@nestjs/common';
import type { Response } from 'express';
import ExcelJS from 'exceljs';
import pdfmake from 'pdfmake';
import { PrismaService } from '../prisma/prisma.service.js';
import { ExportReportDto } from './dto/export-report.dto.js';

// Konfigurasi font standar untuk pdfmake (menggunakan font PDF bawaan tanpa dependensi eksternal)
try {
  pdfmake.addFonts({
    Roboto: {
      normal: 'Helvetica',
      bold: 'Helvetica-Bold',
      italics: 'Helvetica-Oblique',
      bolditalics: 'Helvetica-BoldOblique',
    },
  });
} catch {
  // Font sudah terdaftar sebelumnya
}

@Injectable()
export class ExportReportService {
  constructor(private readonly prisma: PrismaService) {}

  private async getOwner(userId: number) {
    const owner = await this.prisma.space_owner.findFirst({
      where: {
        OR: [{ id_user: userId }, { id: userId }],
      },
    });

    if (!owner) {
      throw new NotFoundException('Data admin / pemilik coworking tidak ditemukan');
    }
    return owner;
  }

  /**
   * Mengambil data transaksi dan menghitung agregasi finansial
   */
  private async getFinancialData(userId: number, query: ExportReportDto) {
    const owner = await this.getOwner(userId);

    const now = new Date();
    const targetYear = query.tahun ? Number(query.tahun) : now.getFullYear();
    const targetMonth = query.bulan ? Number(query.bulan) : now.getMonth() + 1;

    const startOfMonth = new Date(Date.UTC(targetYear, targetMonth - 1, 1));
    const endOfMonth = new Date(Date.UTC(targetYear, targetMonth, 0, 23, 59, 59, 999));

    const reservations = await this.prisma.reservasi.findMany({
      where: {
        id_owner: owner.id,
        tanggal_reservasi: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
      include: {
        member: {
          select: {
            nama_member: true,
            telp: true,
            Instansi: true,
          },
        },
        detailReservasi: {
          include: {
            space: true,
            diskon: true,
          },
        },
      },
      orderBy: { jam_mulai: 'asc' },
    });

    let totalTransaksi = reservations.length;
    let totalJamSewa = 0;
    let omzetKotor = 0;
    let totalDiskon = 0;
    let omzetBersih = 0;
    let totalSukses = 0;

    for (const res of reservations) {
      if (res.status !== 'dibatalkan' && res.detailReservasi) {
        totalSukses += 1;
        totalJamSewa += res.durasi_jam;
        const subtotal = res.detailReservasi.subtotal ?? res.detailReservasi.total_harga;
        const potongan = res.detailReservasi.potongan ?? 0;
        const total = res.detailReservasi.total_harga;

        omzetKotor += subtotal;
        totalDiskon += potongan;
        omzetBersih += total;
      }
    }

    const monthNames = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
    ];

    return {
      owner,
      targetYear,
      targetMonth,
      namaBulan: monthNames[targetMonth - 1] ?? `Bulan-${targetMonth}`,
      summary: {
        totalTransaksi,
        totalSukses,
        totalJamSewa,
        omzetKotor,
        totalDiskon,
        omzetBersih,
      },
      reservations,
    };
  }

  /**
   * Ekspor laporan ke format Excel / CSV / PDF
   */
  async exportReport(userId: number, query: ExportReportDto, res: Response) {
    const data = await this.getFinancialData(userId, query);
    const format = (query.format || 'excel').toLowerCase();
    const cleanCoworkingName = data.owner.nama_coworking.replace(/[^a-zA-Z0-9_-]/g, '_');
    const baseFilename = `Laporan_Keuangan_${cleanCoworkingName}_${data.namaBulan}_${data.targetYear}`;

    if (format === 'csv') {
      return this.generateCsv(data, baseFilename, res);
    } else if (format === 'pdf') {
      return this.generatePdf(data, baseFilename, res);
    } else {
      return this.generateExcel(data, baseFilename, res);
    }
  }

  /**
   * Format Excel (.xlsx) dengan styling modern & KPI summary
   */
  private async generateExcel(data: any, filename: string, res: Response) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Tablify Reservation System';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Laporan Keuangan', {
      views: [{ showGridLines: true }],
    });

    // Judul Utama
    sheet.mergeCells('A1:J1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = `LAPORAN FINANSIAL & OPERASIONAL - ${data.owner.nama_coworking.toUpperCase()}`;
    titleCell.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(1).height = 36;

    // Sub-info
    sheet.mergeCells('A2:J2');
    const subCell = sheet.getCell('A2');
    subCell.value = `Periode: ${data.namaBulan} ${data.targetYear} | Dikeluarkan: ${new Date().toLocaleString('id-ID')}`;
    subCell.font = { italic: true, size: 10, color: { argb: 'FF475569' } };
    subCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(2).height = 20;

    // KPI Summary Box
    sheet.getRow(4).values = [
      'Total Transaksi',
      'Transaksi Berhasil',
      'Total Jam Sewa',
      'Omzet Kotor (Rp)',
      'Total Diskon Promo (Rp)',
      'Pendapatan Bersih (Rp)',
    ];
    sheet.getRow(4).font = { bold: true, color: { argb: 'FF1E293B' } };
    sheet.getRow(4).height = 22;

    sheet.getRow(5).values = [
      data.summary.totalTransaksi,
      data.summary.totalSukses,
      `${data.summary.totalJamSewa} Jam`,
      data.summary.omzetKotor,
      data.summary.totalDiskon,
      data.summary.omzetBersih,
    ];
    sheet.getRow(5).font = { bold: true, size: 12, color: { argb: 'FF0284C7' } };
    sheet.getRow(5).height = 26;

    // Format currency KPI
    sheet.getCell('D5').numFmt = '#,##0';
    sheet.getCell('E5').numFmt = '#,##0';
    sheet.getCell('F5').numFmt = '#,##0';

    // Header Tabel Transaksi
    const headerRow = sheet.getRow(7);
    headerRow.values = [
      'No',
      'Tanggal',
      'Kode Tiket',
      'Nama Tamu / Member',
      'Ruangan / Meja',
      'Durasi (Jam)',
      'Status',
      'Tarif / Jam (Rp)',
      'Subtotal (Rp)',
      'Diskon (Rp)',
      'Total Bayar (Rp)',
    ];
    headerRow.height = 26;
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0F172A' },
    };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };

    // Baris Data
    let rowIdx = 8;
    for (let i = 0; i < data.reservations.length; i++) {
      const resv = data.reservations[i];
      const row = sheet.getRow(rowIdx);
      const subtotal = resv.detailReservasi?.subtotal ?? resv.detailReservasi?.total_harga ?? 0;
      const potongan = resv.detailReservasi?.potongan ?? 0;
      const totalHarga = resv.detailReservasi?.total_harga ?? 0;

      row.values = [
        i + 1,
        new Date(resv.tanggal_reservasi).toISOString().slice(0, 10),
        resv.kode_tiket ?? '-',
        resv.member?.nama_member ?? '-',
        resv.detailReservasi?.space?.nama_space ?? '-',
        resv.durasi_jam,
        resv.status,
        resv.detailReservasi?.tarif_per_jam ?? 0,
        subtotal,
        potongan,
        totalHarga,
      ];

      // Zebra striping
      if (i % 2 === 1) {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF8FAFC' },
        };
      }

      row.getCell(8).numFmt = '#,##0';
      row.getCell(9).numFmt = '#,##0';
      row.getCell(10).numFmt = '#,##0';
      row.getCell(11).numFmt = '#,##0';
      row.alignment = { vertical: 'middle' };
      row.getCell(1).alignment = { horizontal: 'center' };
      row.getCell(2).alignment = { horizontal: 'center' };
      row.getCell(6).alignment = { horizontal: 'center' };
      row.getCell(7).alignment = { horizontal: 'center' };

      rowIdx++;
    }

    // Auto-fit kolom
    sheet.columns = [
      { key: 'no', width: 6 },
      { key: 'tanggal', width: 14 },
      { key: 'kode_tiket', width: 20 },
      { key: 'nama_member', width: 24 },
      { key: 'nama_space', width: 22 },
      { key: 'durasi', width: 14 },
      { key: 'status', width: 18 },
      { key: 'tarif', width: 16 },
      { key: 'subtotal', width: 18 },
      { key: 'diskon', width: 16 },
      { key: 'total_harga', width: 20 },
    ];

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);

    await workbook.xlsx.write(res);
    res.end();
  }

  /**
   * Format CSV
   */
  private async generateCsv(data: any, filename: string, res: Response) {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Data');

    sheet.addRow([
      'No',
      'Tanggal',
      'Kode Tiket',
      'Nama Member',
      'Ruangan / Meja',
      'Durasi Jam',
      'Status',
      'Tarif Per Jam',
      'Subtotal',
      'Diskon',
      'Total Bayar',
    ]);

    data.reservations.forEach((r: any, idx: number) => {
      sheet.addRow([
        idx + 1,
        new Date(r.tanggal_reservasi).toISOString().slice(0, 10),
        r.kode_tiket ?? '',
        r.member?.nama_member ?? '',
        r.detailReservasi?.space?.nama_space ?? '',
        r.durasi_jam,
        r.status,
        r.detailReservasi?.tarif_per_jam ?? 0,
        r.detailReservasi?.subtotal ?? r.detailReservasi?.total_harga ?? 0,
        r.detailReservasi?.potongan ?? 0,
        r.detailReservasi?.total_harga ?? 0,
      ]);
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);

    await workbook.csv.write(res);
    res.end();
  }

  /**
   * Format PDF dengan layout elegan dan tabel finansial
   */
  private async generatePdf(data: any, filename: string, res: Response) {
    const tableBody: any[] = [
      [
        { text: 'No', style: 'tableHeader', alignment: 'center' },
        { text: 'Tanggal', style: 'tableHeader' },
        { text: 'Kode Tiket', style: 'tableHeader' },
        { text: 'Tamu / Space', style: 'tableHeader' },
        { text: 'Jam', style: 'tableHeader', alignment: 'center' },
        { text: 'Status', style: 'tableHeader' },
        { text: 'Total (Rp)', style: 'tableHeader', alignment: 'right' },
      ],
    ];

    data.reservations.forEach((r: any, idx: number) => {
      tableBody.push([
        { text: (idx + 1).toString(), alignment: 'center' },
        { text: new Date(r.tanggal_reservasi).toISOString().slice(0, 10) },
        { text: r.kode_tiket ?? '-', fontSize: 8 },
        {
          text: `${r.member?.nama_member ?? '-'}\n(${r.detailReservasi?.space?.nama_space ?? '-'})`,
          fontSize: 8,
        },
        { text: `${r.durasi_jam}h`, alignment: 'center' },
        { text: r.status, fontSize: 8 },
        {
          text: (r.detailReservasi?.total_harga ?? 0).toLocaleString('id-ID'),
          alignment: 'right',
        },
      ]);
    });

    const docDefinition: any = {
      pageOrientation: 'portrait',
      pageSize: 'A4',
      content: [
        {
          text: `LAPORAN FINANSIAL & TRANSAKSI`,
          style: 'header',
        },
        {
          text: `${data.owner.nama_coworking}`,
          style: 'subheader',
        },
        {
          text: `Periode: ${data.namaBulan} ${data.targetYear} | Dicetak: ${new Date().toLocaleString('id-ID')}`,
          style: 'meta',
        },
        {
          style: 'summaryTable',
          table: {
            widths: ['*', '*', '*', '*'],
            body: [
              [
                { text: 'Total Transaksi', style: 'kpiLabel' },
                { text: 'Total Jam Sewa', style: 'kpiLabel' },
                { text: 'Total Diskon Promo', style: 'kpiLabel' },
                { text: 'Pendapatan Bersih', style: 'kpiLabel' },
              ],
              [
                { text: `${data.summary.totalTransaksi}`, style: 'kpiVal' },
                { text: `${data.summary.totalJamSewa} Jam`, style: 'kpiVal' },
                { text: `Rp ${data.summary.totalDiskon.toLocaleString('id-ID')}`, style: 'kpiVal' },
                { text: `Rp ${data.summary.omzetBersih.toLocaleString('id-ID')}`, style: 'kpiValHighlight' },
              ],
            ],
          },
          layout: 'lightHorizontalLines',
        },
        { text: 'Rincian Transaksi:', style: 'sectionTitle' },
        {
          table: {
            headerRows: 1,
            widths: [20, 55, 75, 130, 30, 60, 70],
            body: tableBody,
          },
          layout: 'lightHorizontalLines',
        },
      ],
      styles: {
        header: { fontSize: 16, bold: true, color: '#0F172A', alignment: 'center' },
        subheader: { fontSize: 13, bold: true, color: '#0284C7', alignment: 'center', margin: [0, 2, 0, 0] },
        meta: { fontSize: 9, color: '#64748B', alignment: 'center', margin: [0, 2, 0, 15] },
        summaryTable: { margin: [0, 0, 0, 15] },
        kpiLabel: { fontSize: 9, color: '#475569', bold: true },
        kpiVal: { fontSize: 11, bold: true, color: '#0F172A' },
        kpiValHighlight: { fontSize: 11, bold: true, color: '#059669' },
        sectionTitle: { fontSize: 11, bold: true, color: '#1E293B', margin: [0, 10, 0, 5] },
        tableHeader: { bold: true, fontSize: 9, color: '#0F172A', fillColor: '#E2E8F0' },
      },
      defaultStyle: {
        fontSize: 9,
      },
    };

    const pdfDoc = pdfmake.createPdf(docDefinition);
    const buffer = await pdfDoc.getBuffer();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
    res.setHeader('Content-Length', buffer.length);
    res.end(buffer);
  }
}
