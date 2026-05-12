export interface Study {
    study_desc: string | null;
    study_created_time: string;
    pat_name: string | null;
    pat_birthdate: string | null;
    sex: string | null;
    src_aet: string | null;
    institution: string;
    modalities: string[];
    study_iuid: string;
  }
  
export interface StudyResponse {
    studies: Study[];
    total: number;
}
  