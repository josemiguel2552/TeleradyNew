import { Component, AfterViewInit, HostListener, OnInit, ChangeDetectorRef } from '@angular/core';
import Chart from 'chart.js/auto';
import { TokenService } from '../../../service/token.service';
import { t } from '../../../shared/i18n/i18n';

@Component({
  selector: 'app-statistics',
  standalone: false,
  templateUrl: './statistic-pages.component.html',
  styleUrls: ['./statistic-pages.component.scss']
})
export class StatisticPageComponent implements AfterViewInit, OnInit {
  t=t;
  isMobile = window.innerWidth < 768;
  infoUser = { name: null, email: null, specialty: null };
  subspecialtyData: any[] = [];
  modalityData: any[] = [];
  unidadRadi= t('statistic.cardData.label4');

  @HostListener('window:resize', ['$event'])
  onResize(event: { target: { innerWidth: number; }; }) {
    this.isMobile = event.target.innerWidth < 768;
  }

  constructor(private tokenService: TokenService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.getUserInfo();
    this.initializeChartsData();
  }

  ngAfterViewInit() {
    this.createSubspecialtyChart();
    this.createModalityChart();
    this.createEvolutionChart();
  }

  statistics = [
    { label: t('statistic.cardData.label1'), value: 12, icon: "stash:user-group" },
    { label:  t('statistic.cardData.label2'), value:  t('statistic.cardData.value2'), icon: "flowbite:briefcase-outline" },
    { label:  t('statistic.cardData.label3'), value: "245 euros", icon: "la:check-circle-solid" },
    { label:  t('statistic.cardData.label4'), value: 18, icon: "iconoir:u-turn-arrow-right" }
  ];

  facturas = [
    {mes:  t('statistic.facturas.meses.enero')},
    {mes: t('statistic.facturas.meses.febrero')},
    {mes: t('statistic.facturas.meses.marzo')},
    {mes: t('statistic.facturas.meses.abril')},
    {mes: t('statistic.facturas.meses.mayo')},
  ];

  mesesDisponibles = [t('statistic.facturas.meses.enero'), 
    t('statistic.facturas.meses.febrero'), 
    t('statistic.facturas.meses.marzo'), 
    t('statistic.facturas.meses.abril'), 
    t('statistic.facturas.meses.mayo')];

  desde = t('statistic.facturas.meses.enero');
  hasta =t('statistic.facturas.meses.mayo');

  public getUserInfo(): void {
    const decoded: any = this.tokenService.decodeToken();
    if(decoded) {
      this.infoUser = {
        email: decoded.email ?? null,
        name: decoded.name ?? null,
        specialty: decoded.specialty ?? null
      };
    }
  }

  get facturasFiltradas() {
    const indiceDesde = this.mesesDisponibles.indexOf(this.desde);
    const indiceHasta = this.mesesDisponibles.indexOf(this.hasta);

    return this.facturas.filter((factura) => {
      const indiceMes = this.mesesDisponibles.indexOf(factura.mes);
      return indiceMes >= indiceDesde && indiceMes <= indiceHasta;
    });
  }

  createSubspecialtyChart() {
    new Chart('subspecialtyChart', { type: 'doughnut',
      data: { labels: this.subspecialtyData.map(d => d.label), datasets: [{ data: this.subspecialtyData.map(d => d.value), backgroundColor: this.subspecialtyData.map(d => d.color) }] },
      options: { responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { display: false } } }
    });
  }

  createModalityChart() {
    new Chart('modalityChart', {
      type: 'doughnut',
      data: { labels: this.modalityData.map(d => d.label), datasets: [{ data: this.modalityData.map(d => d.value), backgroundColor: this.modalityData.map(d => d.color) }] },
      options: { responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { display: false } } }
    });
  }

  createEvolutionChart() {
    new Chart('evolutionChart', {
      type: 'line',
      data: {
        labels: [t('statistic.EvolutionChart.labels.jan'), 
          t('statistic.EvolutionChart.labels.feb'),
          t('statistic.EvolutionChart.labels.mar'), 
          t('statistic.EvolutionChart.labels.apr'), 
          t('statistic.EvolutionChart.labels.may'), 
          t('statistic.EvolutionChart.labels.jun'), 
          t('statistic.EvolutionChart.labels.jul'), 
          t('statistic.EvolutionChart.labels.aug'), 
          t('statistic.EvolutionChart.labels.sep'), 
          t('statistic.EvolutionChart.labels.oct')],
        datasets: [{
          label: t('statistic.EvolutionChart.dataset.label'),
          data: [10, 20, 35, 50, 45, 55, 60, 70, 80, 90],
          borderColor: '#007bff',
          backgroundColor: 'rgba(0, 123, 255, 0.2)',
          pointRadius: 5,
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { beginAtZero: true },
          x: { display: true }
        }
      }
    });
  }

  initializeChartsData() {
    this.subspecialtyData = [
      { label: t('statistic.initializeCharts.label1'), value: 55, color: "#00BFFF" },
      { label: t('statistic.initializeCharts.label2'), value: 35, color: "#8A2BE2" },
      { label: t('statistic.initializeCharts.label3'), value: 10, color: "#FF69B4" }
    ];
    this.modalityData = [
      { label: "TC", value: 4, flag: "https://flagcdn.com/w40/dz.png", color: "#00BFFF"},
      { label: "RM", value: 56, flag: "https://flagcdn.com/w40/fr.png", color: "#8A2BE2" },
      { label: "RX", value: 45, flag: "https://flagcdn.com/w40/de.png", color: "#FF69B4" }
    ];
    this.cdr.detectChanges(); 
  }
}