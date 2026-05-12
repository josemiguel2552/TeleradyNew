import { Component, OnInit } from '@angular/core';
import { MessageService } from 'primeng/api';
import { marked } from 'marked';
import { t } from '../../../shared/i18n/i18n';

/**
 * Per-study report editor. AI integration removed in Sprint 0; the manual
 * editor remains until the Sprint 5 redesign.
 */
@Component({
  selector: 'app-report-pages',
  standalone: false,
  templateUrl: './study-report-pages.component.html',
  styleUrl: './study-report-pages.component.scss',
})
export class StudyReportPagesComponent implements OnInit {
  t = t;
  reportTypes: string[] = [];
  selectedReport: string = '';
  findings: string = '';
  chatHistory: string = '';
  isLoading: boolean = false;
  isEditing: boolean = false;
  reportLength: string = 'Medium';
  history: string[] = [];
  currentIndex: number = -1;
  selectedStudy: any;

  translateCopy = t('Editor.button.Copy');
  translateSave = t('Editor.button.translateSave');
  translateEdit = t('Editor.button.Edit');
  translateBack = t('Editor.button.Back');
  translateForward = t('Editor.button.Forward');
  translateBold = t('Editor.button.Bold');
  translatePrint = t('Editor.button.Print');

  constructor(private readonly messageService: MessageService) {}

  ngOnInit(): void {
    const state = history.state;
    if (state && state.study) {
      this.selectedStudy = state.study;
    }
  }

  setReportLength(length: string) {
    this.reportLength = length;
  }

  copyToClipboard() {
    if (this.chatHistory !== '') {
      navigator.clipboard.writeText(this.chatHistory).then(() => {
        this.messageService.add({
          severity: 'success',
          summary: t('report.copyBoard.summary'),
          detail: t('report.copyBoard.detail'),
          life: 3000,
        });
      });
    } else {
      this.messageService.add({
        severity: 'error',
        summary: t('report.copyBoard.error'),
        detail: t('report.copyBoard.errDetail'),
        life: 3000,
      });
    }
  }

  toggleEditMode() {
    this.isEditing = !this.isEditing;
    if (!this.isEditing) {
      const chatBox = document.querySelector('.editable-content') as HTMLElement;
      if (chatBox) {
        this.chatHistory = this.convertToMarkdown(chatBox.innerHTML);
        this.saveToHistory();
      }
    }
  }

  updateEditedMarkdown(event: Event) {
    const target = event.target as HTMLElement;
    this.chatHistory = this.extractMarkdown(target.innerHTML);
  }

  extractMarkdown(text: string): string {
    return this.convertToMarkdown(
      text
        .replace(/<b>(.*?)<\/b>/g, '**$1**')
        .replace(/<i>(.*?)<\/i>/g, '_$1_')
        .replace(/<h4>(.*?)<\/h4>/g, '#### **$1**')
        .replace(/<h5>(.*?)<\/h5>/g, '##### **$1**')
        .replace(/<ul>\s*(<li>.*?<\/li>\s*)+<\/ul>/g, (match) =>
          match.replace(/<li>(.*?)<\/li>/g, '- $1'),
        )
        .replace(/\s{2,}/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/\n/g, '  \n'),
    );
  }

  async printChatHistory() {
    const printWindow = window.open('', '', 'width=800,height=600');
    if (printWindow) {
      const parsedMarkdown = await marked.parse(this.chatHistory);
      printWindow.document.body.innerHTML = parsedMarkdown;
      printWindow.document.title = 'Generated Report';
      printWindow.print();
      printWindow.document.close();
    }
  }

  saveToHistory() {
    if (
      this.chatHistory.trim() !== '' &&
      (this.history.length === 0 || this.history[this.currentIndex] !== this.chatHistory)
    ) {
      this.history = this.history.slice(0, this.currentIndex + 1);
      this.history.push(this.chatHistory);
      this.currentIndex = this.history.length - 1;
    }
  }

  goBack() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.chatHistory = this.history[this.currentIndex];
    }
  }

  goForward() {
    if (this.currentIndex < this.history.length - 1) {
      this.currentIndex++;
      this.chatHistory = this.history[this.currentIndex];
    }
  }

  makeBold() {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const boldElement = document.createElement('strong');
      boldElement.appendChild(range.extractContents());
      range.insertNode(boldElement);
    }
  }

  generateReport() {
    this.messageService.add({
      severity: 'info',
      summary: 'AI draft disabled',
      detail:
        'The AI draft assistant has been temporarily disabled. The editor is back in Sprint 5 with the new signing flow.',
      life: 5000,
    });
  }

  convertToMarkdown(text: string): string {
    return text
      .replace(/^FINDINGS/gm, '#### **Findings**')
      .replace(/^CONCLUSION/gm, '#### **Conclusion**')
      .replace(/^([\w\s]+):\n/gm, '##### **$1**  \n')
      .replace(/^\s*-\s+(.*)$/gm, '- $1')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/\n/g, '  \n');
  }
}
