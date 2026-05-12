import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { of } from 'rxjs';
import { StudiesPageComponent } from './studies-pages.component';
import { StudiesService } from '../../../service/studies.service';

const mockT = (key: string) => key;

const mockStudiesService = {
  getStudies: jest.fn().mockReturnValue(
    of({
      studies: [
        {
          study_desc: 'Ultrasound^Abdominal',
          last_serie_datetime: new Date(2024, 10, 12),
          pat_id: '12345',
          modalities: ['ecography']
        }
      ],
      total: 1
    })
  )
};

describe('StudiesPageComponent', () => {
  let component: StudiesPageComponent;
  let fixture: ComponentFixture<StudiesPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FormsModule],
      declarations:[StudiesPageComponent],
      providers: [{ provide: StudiesService, useValue: mockStudiesService }],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(StudiesPageComponent);
    component = fixture.componentInstance;

    // Inyectar mock de i18n manualmente
    component.t = mockT;
    component.translatedNo_urgent = 'urgency.non_urgent';
    component.translateStatusNew = 'status.new';
    component.translateStatusTo_Report = 'status.to_report';
    component.translateStatusInformed = 'status.informed';
    component.translatedUrgent = 'urgency.urgent';
    component.translatedPriority = 'urgency.priority';
    component.translatedInformed = 'urgency.informed';

    component.rowsPerPage = 2;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should filter studies based on search criteria', () => {
    component.searchNumber = '12345';
    component.searchStatus = 'status.new';
    component.searchDate = new Date(2024, 10, 12).toLocaleDateString().toLowerCase();
    component.searchModality = 'ecography';

    component.studies = [
      {
        study_desc: 'Test 12345',
        study_created_time: new Date(2024, 10, 12).toISOString(),
        pat_name: 'John Doe',
        pat_birthdate: '1990-01-01',
        sex: 'M',
        src_aet: 'SRC1',
        institution: 'Hospital A',
        modalities: ['Ecography'],
        study_iuid: '1.2.3.4.5',
        status: 'status.new',
        type: 'Test 12345',
        dueDate: new Date(2024, 10, 12).toLocaleDateString(),
        icon: 'body',
        modality: 'Ecography'
      }
    ];

    const filteredStudies = component.filterStudies();
    expect(filteredStudies.length).toBe(1);
  });

  it('should return the correct number of total pages', () => {
    expect(component.TotalPages).toBe(Math.ceil(component.filteredReports.length / component.rowsPerPage));
  });

  it('should paginate reports correctly', () => {
    component.currentPage = 1;
    const paginatedReports = component.paginatedReports;
    expect(paginatedReports.length).toBeLessThanOrEqual(component.rowsPerPage);
  });


  it('should not change to an invalid page', () => {
    component.currentPage = 2;
    component.changePage(-1);
    expect(component.currentPage).toBe(2);

    component.changePage(100);
    expect(component.currentPage).toBe(2);
  });

  it('should change rows per page and reset current page', () => {
    component.currentPage = 2;
    component.changeRowsPerPage();
    expect(component.currentPage).toBe(1);
  });

  it('should navigate to the next page', () => {
    // Añadir más estudios para que haya al menos 2 páginas
    component.studies = Array.from({ length: 5 }).map((_, i) => ({
      type: `Estudio ${i + 1}`,
      urgency: 'urgency.non_urgent',
      dueDate: new Date(2024, 10, 12).toLocaleDateString(),
      historyNumber: `HN${i + 1}`,
      modality: 'ecography',
      status: 'status.new',
      icon: 'body',
    }));
  
    component.rowsPerPage = 2;
    component.currentPage = 1;
  
    component.nextPage();
  
    expect(component.currentPage).toBe(2);  
  });
  
  it('should navigate to the previous page', () => {
    component.currentPage = 2;
    component.prevPage();
    expect(component.currentPage).toBe(1);
  });

  it('should return the correct pages array', () => {
    Object.defineProperty(component, 'filteredReports', {
      value: Array(10).fill({}), 
      writable: false
    });
    component.rowsPerPage = 2;
    component.currentPage = 2;
  
    const pages = component.pages.filter(p => typeof p === 'number');
    expect(pages).toContain(2);
  });
});
