import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { StorageService } from '../../integrations/storage/storage.service';
import type { ReportRow } from './report-v2.repository';

export interface RenderedPdf {
  bucket: string;
  key: string;
  sizeBytes: number;
}

interface ContentsShape {
  modality?: string;
  sections?: Array<{ key: string; title: string; body: string }>;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class PdfService {
  constructor(private readonly storage: StorageService) {}

  async render(report: ReportRow, patient: { name: string; birthdate: string | null }): Promise<RenderedPdf> {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    const done = new Promise<void>((resolve) => doc.on('end', () => resolve()));

    this.writeHeader(doc, report, patient);
    this.writeSections(doc, report.contents as ContentsShape);
    this.writeSignature(doc, report);

    doc.end();
    await done;

    const buffer = Buffer.concat(chunks);
    const key = `reports/${report.reportStudyId}/v${report.version}.pdf`;
    const stored = await this.storage.put({
      key,
      body: buffer,
      contentType: 'application/pdf',
      bucket: 'reports',
      metadata: {
        reportId: report.id,
        version: String(report.version),
      },
    });
    return { bucket: stored.bucket, key: stored.key, sizeBytes: buffer.length };
  }

  private writeHeader(
    doc: PDFKit.PDFDocument,
    report: ReportRow,
    patient: { name: string; birthdate: string | null },
  ): void {
    doc
      .fontSize(18)
      .text('Telerady — Informe radiológico', { align: 'left' })
      .moveDown(0.5);

    doc.fontSize(10).fillColor('#444');
    doc.text(`Estado: ${report.state}`);
    doc.text(`Versión: ${report.version}`);
    if (report.signedAt) doc.text(`Firmado: ${report.signedAt}`);
    doc.moveDown();
    doc.fillColor('#000').fontSize(12).text(`Paciente: ${patient.name}`);
    if (patient.birthdate) doc.text(`Fecha de nacimiento: ${patient.birthdate}`);
    doc.moveDown();
  }

  private writeSections(doc: PDFKit.PDFDocument, contents: ContentsShape | null): void {
    if (!contents?.sections?.length) {
      doc.fontSize(12).fillColor('#888').text('(Informe vacío)').fillColor('#000');
      return;
    }
    for (const section of contents.sections) {
      doc.moveDown(0.5).fontSize(13).fillColor('#222').text(section.title);
      doc.moveDown(0.2).fontSize(11).fillColor('#000').text(section.body, {
        align: 'left',
        paragraphGap: 4,
      });
    }
  }

  private writeSignature(doc: PDFKit.PDFDocument, report: ReportRow): void {
    if (!report.signatureData) return;
    const sig = report.signatureData as Record<string, any>;
    doc.moveDown(2).fontSize(10).fillColor('#444');
    doc.text(`Firmado por: ${sig.displayedName} (Colegiado nº ${sig.collegiate})`);
    if (sig.policy === 'drawn_hash_tsa') {
      doc.text(`Hash contenido: ${sig.contentsDigest}`);
      if (sig.tsa) {
        doc.text(`TSA: ${sig.tsa.provider} — ${sig.tsa.ts}`);
        doc.text(`Token TSA (sha256): ${sig.tsa.token}`);
      }
    }
    doc.fillColor('#000');
  }
}
