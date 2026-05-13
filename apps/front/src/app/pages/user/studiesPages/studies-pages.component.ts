import { Component } from '@angular/core';
import { t } from '../../../shared/i18n/i18n';
import { StudiesService } from '../../../service/studies.service';
import { Router } from '@angular/router';
import { Study } from '../../../models/service/study.model';

@Component({
  selector: 'app-report-pages',
  standalone: false,
  templateUrl: './studies-pages.component.html',
  styleUrls: ['./studies-pages.component.scss']
})
export class StudiesPageComponent {
  t = t;
  searchNumber: string = '';
  searchStatus: string = '';
  searchDate: string = '';
  searchModality: string = '';
  currentPage: number = 1;
  rowsPerPage: number = 10;
  searchInstitution: string = '';
  translatedUrgent = t('urgency.urgent');
  translatedNo_urgent = t('urgency.non_urgent');
  translatedPriority = t('urgency.priority');
  translatedInformed = t('urgency.informed');
  translateStatusTo_Report = t('status.to_report');
  translateStatusNew = t('status.new');
  translateStatusInformed = t('status.informed');

  studies: any[] = [];
  totalItems: number = 0;

  constructor(private StudiesService: StudiesService, private router: Router) { }

  ngOnInit() {
    this.loadStudies();
    document.addEventListener('click', this.handleClickOutside);
  }

  ngonDestroy() {
    document.removeEventListener('click', this.handleClickOutside);
  }

  handleClickOutside = (event: MouseEvent) =>{
    const target = event.target as HTMLElement;
    const clickedInsideButton = target.closest('.btn-icon');
    const clickedInsideMenu = target.closest('.dropdown-menu-custom');
    if(!clickedInsideButton && !clickedInsideButton){
      this.studies.forEach(study => {
        study.showMenu = false;
      });
    }
  }

  loadStudies() {
    const params = {
      number: 25,
      page: this.currentPage
    };

    this.StudiesService.getStudies(params).subscribe({
      next: (res) => {
        this.studies = (res.studies || []).map((study: Study) => ({
          study_desc: study.study_desc ? study.study_desc.replace(/\^/g, ' ') : 'Sin descripción',
          urgency: this.translatedNo_urgent,
          dueDate: new Date(study.study_created_time).toLocaleDateString() || 'N/A',
          pat_name: study.pat_name ? study.pat_name.replace(/\^/g, ' ') : 'N/A',
          pat_birthdate: study.pat_birthdate || 'N/A',
          sex: study.sex || 'N/A',
          src_aet: study.src_aet || 'N/A',
          institution: study.institution? study.institution.replace(/\^/g, ' ') : 'Sin descripción',
          modalities: study.modalities?.[0] || 'N/A',
          status: this.translateStatusNew,
          icon: 'body',
          study_iuid: study.study_iuid
        }));
        this.totalItems = res.total || 0;
      },
      error: (err) => {
        console.error('Error al cargar estudios:', err);
      }
    })
  }

  filterStudies() {
    return this.studies.filter(study =>
      (this.searchNumber ? study.study_desc.toString().includes(this.searchNumber) : true) &&
      (this.searchStatus ? study.status.toLowerCase().includes(this.searchStatus.toLowerCase()) : true) &&
      (this.searchDate ? study.dueDate.toLowerCase().includes(this.searchDate.toLowerCase()) : true) &&
      (this.searchModality ? study.modality?.toLowerCase().includes(this.searchModality.toLowerCase()) : true)
    );
  }

  toggleMenu(study: any, event: MouseEvent) {
    if (study.showMenu) {
      study.showMenu = false;
      return;
    }
    this.studies.forEach(s => s.showMenu = false);
    const button = event.currentTarget as HTMLElement;
    const rect = button.getBoundingClientRect();
    const menuHeight = 80; 
    const offsetY = -15;     
    const offsetX = 12; 

    study.menuStyle = {
top: `${rect.top + window.scrollY + offsetY}px`,
      left: `${rect.right + window.scrollX + offsetX}px`
    };
    study.showMenu = true;
  }

  get filteredReports() {
    return this.filterStudies();
  }

  get TotalPages() {
    return Math.ceil(this.filteredReports.length / this.rowsPerPage);
  }

  get paginatedReports() {
    const startIndex = (this.currentPage - 1) * this.rowsPerPage;
    return this.filteredReports.slice(startIndex, startIndex + this.rowsPerPage);
  }

  changePage(page: number) {
    if (page < 1 || page > this.TotalPages) return;
    this.currentPage = page;
  }

  changeRowsPerPage() {
    this.currentPage = 1;
  }

  nextPage() {
    if (this.currentPage < this.TotalPages) {
      this.currentPage++;
    }
  }

  prevPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  get pages() {
    let pages: (number | string)[] = [];
    const totalPages = this.TotalPages;
    const pageStart = Math.max(this.currentPage - 2, 1);
    const pageEnd = Math.min(this.currentPage + 2, totalPages);

    for (let i = pageStart; i <= pageEnd; i++) {
      pages.push(i);
    }

    if (this.currentPage > 3) {
      pages.unshift('...');
    }

    if (this.currentPage < totalPages - 2) {
      pages.push('...');
    }

    return pages;
  }

  async viewStudy(studyUID: string): Promise<void> {
    const url = await this.StudiesService.getViewerUrl(studyUID);
    window.open(url, '_blank');
  }

  navigateToReportWithStudy(study: any) {
    this.router.navigate(['/user/study-report'], { state: { study } });
  }
}
