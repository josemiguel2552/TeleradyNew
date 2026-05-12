import { Component, OnInit  } from '@angular/core';
import { ReportService } from '../../../service/report.service';
import { HttpErrorResponse } from '@angular/common/http';
import { map, catchError, of } from 'rxjs';
import { MarkdownModule } from 'ngx-markdown';
import { t } from '../../../shared/i18n/i18n';
import { MessageService } from 'primeng/api';
import { marked } from 'marked';

@Component({
  selector: 'app-report-pages',
  standalone: false,
  templateUrl: './report-pages.component.html',
  styleUrl: './report-pages.component.scss'
})

export class ReportPagesComponent implements OnInit{
  t = t;
  reportTypes: string[] = [];
  selectedReport: string = '';
  findings: string = '';
  chatHistory: string = '';
  chatLines: string[] = [];
  isLoading: boolean = false;
  isEditing: boolean = false;
  reportLength: string = "Medium";
  history: string[] = [];
  currentIndex: number = -1;
  
  translateCopy= t('Editor.button.Copy');
  translateSave= t('Editor.button.translateSave');
  translateEdit= t('Editor.button.Edit');
  translateBack= t('Editor.button.Back');
  translateForward= t('Editor.button.Forward');
  translateBold= t('Editor.button.Bold');
  translatePrint= t('Editor.button.Print');
  
  constructor(private reportService: ReportService, private messageService: MessageService) { }

  ngOnInit(): void {
    this.getReportType();
  }

  setReportLength(length : string) {
    this.reportLength = length;
  }

  copyToClipboard() {
    if(this.chatHistory != ''){
      navigator.clipboard.writeText(this.chatHistory).then(() => {
        this.messageService.add({
          severity: 'success',
          summary: t('report.copyBoard.summary'),
          detail: t('report.copyBoard.detail'),
          life: 3000
        });
      });
    }else {
      this.messageService.add({
        severity: 'error',
        summary: t('report.copyBoard.error'),
        detail: t('report.copyBoard.errDetail'),
        life: 3000
      });
    }
  }

  toggleEditMode() {
    this.isEditing = !this.isEditing;
  
    if (!this.isEditing) {
      const chatBox = document.querySelector(".editable-content") as HTMLElement;
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
        .replace(/<ul>\s*(<li>.*?<\/li>\s*)+<\/ul>/g, (match) => {
          return match.replace(/<li>(.*?)<\/li>/g, '- $1'); 
        })
        .replace(/\s{2,}/g, ' ') 
        .replace(/\n{3,}/g, '\n\n') 
        .replace(/\n/g, '  \n')
    );
  }
    
  async printChatHistory() {
    const printWindow = window.open('', '', 'width=800,height=600');
  
    if (printWindow) {
      const parsedMarkdown = await marked.parse(this.chatHistory);
      printWindow.document.body.innerHTML = parsedMarkdown;
      printWindow.document.title = "Generated Report";
      printWindow.print();
      printWindow.document.close();
    }
  }
    
  saveToHistory() {
    if (this.chatHistory.trim() !== "" && (this.history.length === 0 || this.history[this.currentIndex] !== this.chatHistory)) {
      this.history = this.history.slice(0, this.currentIndex + 1);
      this.history.push(this.chatHistory);
      this.currentIndex = this.history.length - 1;
      console.log("Historial actualizado:", this.history);
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
      
  makeBold(){
    const selection = window.getSelection();
    if(selection && selection.rangeCount > 0){
      const range = selection.getRangeAt(0);
      const boldElement = document.createElement("strong");
      boldElement.appendChild(range.extractContents());
      range.insertNode(boldElement);
    }
  }

  getReportType() {
    this.reportService.getReports().pipe(
      map((data) => {
        console.log("Reportes recibidos:", data); 
        return data || [];
      }),
      catchError((error: HttpErrorResponse) => {
        this.messageService.add({ severity: 'warn', summary: t('report.getReportType.summary'),detail: t('report.getReportType.detail'),life: 3000});
        return of([]); 
      })
    ).subscribe((reportTypes) => {
      this.reportTypes = reportTypes;
      console.log("Reportes guardados:", this.reportTypes);
    });
  }
  

  generateReport() {
    if(!this.selectedReport || !this.findings ) {
      this.messageService.add({ severity: 'warn', summary: t('report.generateReport.summary'),detail:  t('report.generateReport.detail'),life: 3000});
      return;
    }

    this.isLoading = true;
    this.chatHistory = "";
    this.reportService.generateReport(this.findings, this.selectedReport).subscribe({
      next: (chunk: string) => {
        console.log("Reporte generado:", chunk);
        if (this.isLoading) {
          this.isLoading = false;
        }
  
        const formattedChunk = this.convertToMarkdown(chunk);
        this.chatHistory += `${formattedChunk}\n`;
        this.saveToHistory();
        const chatBox = document.getElementById("chat-history");
      },
      error: (error) => {
        console.error("Error al generar reporte:", error);
        this.chatHistory += `\n\n**Error:** ${error.message || "No response from server"}`;
        this.isLoading = false;
      },
      complete: () => {
        console.log("Reporte generado con éxito");
        const currentDate = new Date().toLocaleDateString();
        const currentTime = new Date().toLocaleTimeString();
        const userName = localStorage.getItem('userName') || 'Unknown User';
        const userLicense = localStorage.getItem('UserLicense') || 'No License';
        this.chatHistory += `\n---\n**Generated by:** ${userName} (${userLicense})  \n**Date:** ${currentDate} - ${currentTime}\n\n`;
        this.isLoading = false;
      }
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
