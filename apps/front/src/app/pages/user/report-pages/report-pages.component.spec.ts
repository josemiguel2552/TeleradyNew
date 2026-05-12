import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReportPagesComponent } from './report-pages.component';
import { MessageService } from 'primeng/api';
import { MarkdownModule } from 'ngx-markdown';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

jest.mock('../../../shared/i18n/i18n', () => ({
  t: (key: string) => key,
}));

const messageServiceMock = { add: jest.fn() };

describe('ReportPagesComponent', () => {
  let component: ReportPagesComponent;
  let fixture: ComponentFixture<ReportPagesComponent>;

  beforeEach(async () => {
    jest.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [MarkdownModule.forRoot(), CommonModule, FormsModule],
      declarations: [ReportPagesComponent],
      providers: [{ provide: MessageService, useValue: messageServiceMock }],
    }).compileComponents();

    fixture = TestBed.createComponent(ReportPagesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('creates the component', () => {
    expect(component).toBeTruthy();
  });

  it('notifies that the AI draft is disabled', () => {
    component.generateReport();
    expect(messageServiceMock.add).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'info', summary: 'AI draft disabled' }),
    );
  });

  it('copies to clipboard when content is present', async () => {
    component.chatHistory = 'Some content';
    const writeTextMock = jest.fn().mockResolvedValue(true);
    Object.assign(navigator, { clipboard: { writeText: writeTextMock } });

    await component.copyToClipboard();

    expect(writeTextMock).toHaveBeenCalledWith('Some content');
    expect(messageServiceMock.add).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'success' }),
    );
  });

  it('warns when copying with empty content', async () => {
    component.chatHistory = '';
    await component.copyToClipboard();
    expect(messageServiceMock.add).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error' }),
    );
  });

  it('walks the history backwards and forwards', () => {
    component.history = ['A', 'B', 'C'];
    component.currentIndex = 2;
    component.goBack();
    expect(component.chatHistory).toBe('B');
    component.goForward();
    expect(component.chatHistory).toBe('C');
  });

  it('converts text to markdown', () => {
    const result = component.convertToMarkdown('FINDINGS\n- Item');
    expect(result).toContain('#### **Findings**');
    expect(result).toContain('- Item');
  });
});
