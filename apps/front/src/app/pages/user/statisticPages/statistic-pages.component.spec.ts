import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StatisticPageComponent } from './statistic-pages.component';
import { TokenService } from '../../../service/token.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChangeDetectorRef } from '@angular/core';
import Chart from 'chart.js/auto';

jest.mock('chart.js/auto', () => {
  const actualChart = jest.requireActual('chart.js/auto');
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      destroy: jest.fn(),
      update: jest.fn(),
    })),
    ...actualChart,
  };
});

describe('StatisticPageComponent', () => {
  let component: StatisticPageComponent;
  let fixture: ComponentFixture<StatisticPageComponent>;
  let tokenServiceMock: any;
  let cdrMock: { detectChanges: jest.Mock };

  beforeEach(async () => {
    tokenServiceMock = {
      decodeToken: jest.fn().mockReturnValue({
        name: 'John Doe',
        email: 'john@example.com',
        specialty: 'Radiology'
      })
    };

    cdrMock = { detectChanges: jest.fn() };

    await TestBed.configureTestingModule({
      imports: [CommonModule, FormsModule],
      providers: [
        { provide: TokenService, useValue: tokenServiceMock },
        { provide: ChangeDetectorRef, useValue: cdrMock }
      ]
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(StatisticPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('Debe crearse el componente', () => {
    expect(component).toBeTruthy();
  });

  it('Debe obtener la información del usuario del TokenService', () => {
    component.getUserInfo();
    expect(component.infoUser.name).toBe('John Doe');
    expect(component.infoUser.email).toBe('john@example.com');
    expect(component.infoUser.specialty).toBe('Radiology');
  });

  it('Debe llamar a los métodos de creación de gráficos en ngAfterViewInit', () => {
    const createSubspecialtyChartSpy = jest.spyOn(component, 'createSubspecialtyChart');
    const createModalityChartSpy = jest.spyOn(component, 'createModalityChart');
    const createEvolutionChartSpy = jest.spyOn(component, 'createEvolutionChart');

    component.ngAfterViewInit();

    expect(createSubspecialtyChartSpy).toHaveBeenCalled();
    expect(createModalityChartSpy).toHaveBeenCalled();
    expect(createEvolutionChartSpy).toHaveBeenCalled();
  });

  it('Debe filtrar correctamente las facturas según el rango de meses', () => {
    component.mesesDisponibles = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo'];
  
    component.facturas = [
      { mes: 'Enero' },
      { mes: 'Febrero' },
      { mes: 'Marzo' },
      { mes: 'Abril' },
      { mes: 'Mayo' }
    ];
  
    component.desde = 'Febrero';
    component.hasta = 'Abril';
  
    const facturasFiltradas = component.facturasFiltradas;
    expect(facturasFiltradas.length).toBe(3);
    expect(facturasFiltradas).toEqual([
      { mes: 'Febrero' },
      { mes: 'Marzo' },
      { mes: 'Abril' }
    ]);
  });
  });