export interface PersonalData {
    id?: string;
    name: string;
    lastName: string;
    phone: string;
    email: string;
    cityResidence: string;
    titleStatusId: number;
    professionalLicense: string;
    subspecialties?: number[];
    signatureBase64?: string;
    signatureFileName?: string;
  
}
