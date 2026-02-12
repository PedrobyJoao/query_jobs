export type Root = Job[];

export interface Job {
  id: string;
  apply_url: string;
  job_information: JobInformation;
  v5_processed_company_data: V5ProcessedCompanyData;
  v7_processed_job_data: V7ProcessedJobData;
  _geoloc: Geoloc[];
}

export interface JobInformation {
  title: string;
  job_title_raw: string;
  description: string;
  stripped_description: string;
  company_info: CompanyInfo;
}

export interface CompanyInfo {
  name: string;
}

export interface V5ProcessedCompanyData {
  name: string;
  image_url: string;
  subsidiaries: string[];
  parent_company: any;
  website: string;
  linkedin_url: string;
  industries: string[];
  activities: string[];
  tagline: string;
  is_non_profit: boolean;
  is_public_company: boolean;
  is_dissolved: boolean;
  is_acquired: boolean;
  num_employees: number;
  year_founded: number;
  headquarters_country: string;
  total_funding_amount: any;
  total_funding_currency: any;
  latest_investment_amount: any;
  latest_investment_currency: any;
  latest_investment_year: any;
  latest_investment_series: any;
  investors: any[];
  stock_exchange: string;
  stock_symbol: string;
  latest_revenue: number;
  latest_revenue_currency: string;
  latest_revenue_year: number;
}

export interface V7ProcessedJobData {
  estimated_post_date: string;
  schedule_requirements: ScheduleRequirements;
  embedding_text_explicit: string;
  education: Education;
  work_arrangement: WorkArrangement;
  original_job_description_language: string;
  credentials: Credentials;
  diversity_hiring: DiversityHiring;
  embedding_inferred_vector: number[];
  geo_locations: any[];
  embedding_text_company: string;
  skills: Skills;
  company_profile: CompanyProfile;
  job_titles: JobTitles;
  embedding_company_vector: number[];
  compensation_and_benefits: CompensationAndBenefits;
  embedding_text_inferred: string;
  processed_at: string;
  embedding_explicit_vector: number[];
  experience_requirements: ExperienceRequirements;
}

export interface ScheduleRequirements {
  shifts: Shifts;
  travel: Travel;
}

export interface Shifts {
  on_call_requirement: string;
  holiday_availability_required: boolean;
  weekend_availability_required: boolean;
  overtime_required: boolean;
  shift_types_available: any[];
}

export interface Travel {
  land_travel_requirement: string;
  air_travel_requirement: string;
}

export interface Education {
  explicit: Explicit[];
  inferred: Inferred[];
}

export interface Explicit {
  fields_of_study: string[];
  degree_type: string;
  requirement: string;
}

export interface Inferred {
  fields_of_study: string[];
  degree_type: string;
}

export interface WorkArrangement {
  workplace_type: string;
  individual_contributor_or_people_manager: string;
  commitment: string[];
  workplace_locations: WorkplaceLocation[];
}

export interface WorkplaceLocation {
  continent: string;
  country_code: string;
  city: string;
  kind: string;
  county: string;
  geographic_coordinates: GeographicCoordinates;
  state: string;
}

export interface GeographicCoordinates {
  lon: number;
  lat: number;
}

export interface Credentials {
  explicit: any[];
  inferred: any[];
}

export interface DiversityHiring {
  military_veterans: boolean;
  fair_chance: boolean;
}

export interface Skills {
  explicit: Explicit2[];
  inferred: Inferred2[];
}

export interface Explicit2 {
  expanded_terms: string[];
  value: string;
}

export interface Inferred2 {
  expanded_terms: string[];
  value: string;
}

export interface CompanyProfile {
  website: string;
  activities: string[];
  name: string;
  organization_types: string[];
  tagline: string;
  industry: string;
}

export interface JobTitles {
  explicit: Explicit3;
  inferred: Inferred3[];
}

export interface Explicit3 {
  expanded_terms: string[];
  value: string;
}

export interface Inferred3 {
  expanded_terms: string[];
  value: string;
}

export interface CompensationAndBenefits {
  benefits: Benefits;
  salary: Salary;
}

export interface Benefits {
  tuition_reimbursement: boolean;
  retirement_plan: boolean;
  visa_sponsorship: boolean;
  relocation_assistance: boolean;
  generous_paid_time_off: boolean;
  generous_parental_leave: boolean;
  "401k_matching": boolean;
  four_day_work_week: boolean;
}

export interface Salary {
  high: number;
  low: number;
  currency: string;
  frequency: string;
}

export interface ExperienceRequirements {
  min_years_breakdown: MinYearsBreakdown;
  security_clearance: string;
  seniority_level: string;
  language_requirements: any[];
  is_driver_license_required: boolean;
  requirements_summary: string;
}

export interface MinYearsBreakdown {
  industry_and_role_yoe: number;
  management_and_leadership_yoe: number;
}

export interface Geoloc {
  lat: number;
  lon: number;
}
