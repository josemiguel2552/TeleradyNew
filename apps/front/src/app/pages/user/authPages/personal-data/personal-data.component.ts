import { Component, ChangeDetectorRef } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { PersonalDataService } from '../../../../service/personal-data.service';
import { ParametersService } from '../../../../service/parameters.service';
import { Router } from '@angular/router';
import { Parameter } from '../../../../models/service/parameters.model';
import { t } from '../../../../shared/i18n/i18n';

@Component({
  selector: 'app-personal-data',
  templateUrl: './personal-data.component.html',
  styleUrl: './personal-data.component.scss',
  standalone: false
})
export class PersonalDataComponent {
  t = t;
  loading: boolean = false;
  isDropdownOpen: { [key: string]: boolean } = { fullName: false, phoneNumber: false, email: false, city: false, specialistTitle: false, studyType: false, };
  labelName: string = "";
  labelLastName: string = "";
  labelPhoneNumber: string = "";
  labelEmail: string = "";
  labelCity: string = "";
  labelSpecialistTitle: string = "";
  labelProfessionalLicense: string = "";
  labelSubSpecialistTitle: string = "";
  titleSpecialties: Parameter[] = [];
  subSpecialties: Parameter[] = [];
  signatureBase64: string = '';
  signatureFileName: string = '';

  formGroup = new FormGroup({
    name: new FormControl('', Validators.required),
    lastName: new FormControl('', Validators.required),
    phone: new FormControl('', Validators.required),
    email: new FormControl('', [Validators.required, Validators.email]),
    cityResidence: new FormControl('', Validators.required),
    professionalLicense: new FormControl('', Validators.required),
    titleStatusId: new FormControl('', Validators.required),
    subspecialties: new FormControl<string[]>([], Validators.required),
  });

  constructor(private messageService: MessageService,
    private personalDataService: PersonalDataService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private parametersService: ParametersService) { }

  ngOnInit(): void {
    this.loadTitleSpecialties();
    this.loadSubSpecialties();
    const savedEmail = localStorage.getItem('userEmail');
    if (savedEmail) {
      this.formGroup.patchValue({ email: savedEmail });
      this.labelEmail = savedEmail;
    }
  }

  private loadSubSpecialties(): void {
    this.personalDataService.getSubSpecialties().subscribe({
      next: (data) => {
        if (data.ok && data.response) {
          this.subSpecialties = data.response;
        } else {
          this.subSpecialties = [];
        }
      },
      error: (err) => console.error(t('personalData.error.errorSubspecialty'), err)
    });
  }

  private loadTitleSpecialties(): void {
    this.parametersService.getGetTitleSpecialty().subscribe({
      next: (data) => {
        if (data.ok && data.response) {
          this.titleSpecialties = data.response;
        } else {
          this.titleSpecialties = [];
        }
      },
      error: (err) => console.error(t('personalData.error.errorTitle'), err)
    });
  }

  handleSignatureUpload(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const extension = file.name.split('.').pop()?.toLowerCase();
    const isImage = ['jpg', 'jpeg', 'png'].includes(extension || '');
    if (!isImage) {
      this.messageService.add({ severity: 'info', summary: 'Info', detail: t('document.error.signatureError') });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      this.signatureBase64 = result.split(',')[1];
      this.signatureFileName = file.name;
    };
    reader.readAsDataURL(file);
  }

  toggleDropdown(fieldKey: string) {
    if (this.isDropdownOpen[fieldKey]) {
      this.isDropdownOpen[fieldKey] = false;
    } else {
      Object.keys(this.isDropdownOpen).forEach(key => {
        this.isDropdownOpen[key] = false;
      });
      this.isDropdownOpen[fieldKey] = !this.isDropdownOpen[fieldKey];
    }
  }

  selectOption(value: string, type: number): void {
    switch (type) {
      case 1:
        this.labelName = value;
        this.formGroup.controls['name'].setValue(value);
        break;
      case 2:
        this.labelLastName = value;
        this.formGroup.controls['lastName'].setValue(value);
        break;
      case 3:
        this.labelPhoneNumber = value;
        this.formGroup.controls['phone'].setValue(value);
        break;
      case 4:
        this.labelEmail = value;
        this.formGroup.controls['email'].setValue(value);
        break;
      case 5:
        this.labelCity = value;
        this.formGroup.controls['cityResidence'].setValue(value);
        break;
      case 6:
        const selectedSpecialty = this.titleSpecialties.find(s => s.id === Number(value));
        this.labelSpecialistTitle = selectedSpecialty?.name || '';
        this.formGroup.controls['titleStatusId'].setValue(selectedSpecialty ? selectedSpecialty.id.toString() : '');
        this.isDropdownOpen['titleStatusId'] = false;
        break;
      case 7:
        this.labelProfessionalLicense = value;
        this.formGroup.controls['professionalLicense'].setValue(value);
        break;
      case 8:
        const selectedSubSpecialty = this.subSpecialties.find(s => s.id === Number(value));

        if (selectedSubSpecialty) {
          let selectedValues: string[] = this.formGroup.controls['subspecialties'].value || [];
          let selectedNames: string[] = this.labelSubSpecialistTitle.split(', ').filter(name => name);

          if (!selectedValues.includes(selectedSubSpecialty.id.toString())) {
            selectedValues.push(selectedSubSpecialty.id.toString());
            selectedNames.push(selectedSubSpecialty.name);
          } else {
            selectedValues = selectedValues.filter(id => id !== selectedSubSpecialty.id.toString());
            selectedNames = selectedNames.filter(name => name !== selectedSubSpecialty.name);
          }
          this.labelSubSpecialistTitle = selectedNames.join(", ");
          this.formGroup.controls['subspecialties'].setValue([...selectedValues]);
        }
        this.isDropdownOpen['subspecialties'] = false;
        break;
    }
    this.cdr.detectChanges();
  }

  register(): void {
    this.formGroup.markAllAsTouched();

    if (this.formGroup.invalid) {
      this.messageService.add({ severity: 'warn', summary: t('personalData.message.summarywarn'), detail: t('personalData.message.detail1') });
      return;
    }
    const titleStatusId = Number(this.formGroup.value.titleStatusId);
    if (!titleStatusId || isNaN(titleStatusId) || titleStatusId <= 0) {
      this.messageService.add({ severity: 'error', summary: 'Error', detail:  t('personalData.message.detail2') });
      return;
    }
    this.loading = true;
    const otherDocuments = this.signatureBase64 && this.signatureFileName ? [
      {
        fileName: this.signatureFileName,
        fileBase64: this.signatureBase64,
        documentTypeId: 7
      }
    ] : [];

    const professionalData = {
      name: this.formGroup.value.name?.trim() || '',
      lastName: this.formGroup.value.lastName?.trim() || '',
      phone: this.formGroup.value.phone?.trim() || '',
      email: this.formGroup.value.email?.trim() || '',
      cityResidence: this.formGroup.value.cityResidence?.trim() || '',
      titleStatusId,
      professionalLicense: this.formGroup.value.professionalLicense?.trim() || '',
      subspecialties: this.formGroup.value.subspecialties?.filter(id => id)?.map(id => Number(id)) || undefined,
      otherDocuments
    };

    this.personalDataService.savePersonalData(professionalData).subscribe({
      next: (res) => {
        this.loading = false;
        if (res && res.ok) {
          this.messageService.add({ severity: 'success', summary: t('personalData.message.summarysuccess'), detail: res.message });
          this.router.navigateByUrl('/user/dashboard');
        } else {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: res.message || t('personalData.error.detail2') });
        }
      }
    });
  }
}
