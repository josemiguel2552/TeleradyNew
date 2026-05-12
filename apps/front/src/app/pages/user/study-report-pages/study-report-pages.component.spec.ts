import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StudyReportPagesComponent } from './study-report-pages.component';
import { ReportService } from '../../../service/report.service';
import { MessageService } from 'primeng/api';
import { of, throwError } from 'rxjs';
import { MarkdownModule } from 'ngx-markdown';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

jest.mock('../../../shared/i18n/i18n', () => ({
  t: (key: string) => key
}));

const reportServiceMock = {
  getReports: jest.fn().mockReturnValue(of(['General', 'Cardiac'])),
  generateReport: jest.fn()
};

const messageServiceMock = {
  add: jest.fn()
};

describe('StudyReportPagesComponent', () => {
  let component: StudyReportPagesComponent;
  let fixture: ComponentFixture<StudyReportPagesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        MarkdownModule.forRoot(),
        CommonModule,
        FormsModule
      ],
      declarations: [StudyReportPagesComponent],
      providers: [
        { provide: ReportService, useValue: reportServiceMock },
        { provide: MessageService, useValue: messageServiceMock }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(StudyReportPagesComponent);
    component = fixture.componentInstance;
      component.selectedStudy = {
    pat_name: 'Juan Pérez',
    sex: 'M',
    pat_birthdate: '1990-01-01',
    institution: 'Hospital Central',
    modalities: 'CT'
  };
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should load report types from service', () => {
    component.getReportType();
    expect(reportServiceMock.getReports).toHaveBeenCalled();
    expect(component.reportTypes).toEqual(['General', 'Cardiac']);
  });

  it('should show warning if getReports fails', () => {
    reportServiceMock.getReports.mockReturnValueOnce(throwError(() => new Error('Error')));
    component.getReportType();
    expect(messageServiceMock.add).toHaveBeenCalledWith(expect.objectContaining({
      severity: 'warn'
    }));
  });

  it('should show warning if generateReport called with empty fields', () => {
    component.selectedReport = '';
    component.findings = '';
    component.generateReport();
    expect(messageServiceMock.add).toHaveBeenCalledWith(expect.objectContaining({
      severity: 'warn'
    }));
  });

  it('should generate report and update chatHistory', () => {
    const responseText = 'FINDINGS\nThere is a mass.';
    component.selectedReport = 'General';
    component.findings = 'Something abnormal';
    reportServiceMock.generateReport.mockReturnValue(of(responseText));

    component.generateReport();

    expect(reportServiceMock.generateReport).toHaveBeenCalled();
    expect(component.chatHistory).toContain('#### **Findings**');
  });

  it('should copy to clipboard if chatHistory is not empty', async () => {
    component.chatHistory = 'Some content';
    const writeTextMock = jest.fn().mockResolvedValue(true);
    Object.assign(navigator, {
      clipboard: { writeText: writeTextMock }
    });

    await component.copyToClipboard();

    expect(writeTextMock).toHaveBeenCalledWith('Some content');
    expect(messageServiceMock.add).toHaveBeenCalledWith(expect.objectContaining({
      severity: 'success'
    }));
  });

  it('should show error when copying with empty chatHistory', async () => {
    component.chatHistory = '';
    await component.copyToClipboard();
    expect(messageServiceMock.add).toHaveBeenCalledWith(expect.objectContaining({
      severity: 'error'
    }));
  });

  it('should save to history correctly', () => {
    component.chatHistory = 'Texto de ejemplo';
    component.saveToHistory();
    expect(component.history.length).toBe(1);
    expect(component.history[0]).toBe('Texto de ejemplo');
  });

  it('should go back in history', () => {
    component.history = ['A', 'B', 'C'];
    component.currentIndex = 2;
    component.goBack();
    expect(component.chatHistory).toBe('B');
  });

  it('should go forward in history', () => {
    component.history = ['A', 'B', 'C'];
    component.currentIndex = 1;
    component.goForward();
    expect(component.chatHistory).toBe('C');
  });

  it('should convert text to markdown', () => {
    const result = component.convertToMarkdown('FINDINGS\n- Item');
    expect(result).toContain('#### **Findings**');
    expect(result).toContain('- Item');
  });
});
