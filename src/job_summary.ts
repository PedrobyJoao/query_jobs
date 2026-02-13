import type { Job } from "./schema";

export type JobSummary = {
  readonly id: string;
  readonly apply_url: string;
  readonly title: string;
  readonly company_name: string;
  readonly estimated_post_date: string;
  readonly workplace_type: string;
  readonly skills_explicit: string;
  readonly salary_range: string;
  readonly seniority_level: string;
};

export const toJobSummary = (job: Job): JobSummary => ({
  id: job.id ?? "",
  apply_url: job.apply_url ?? "",
  title:
    job.job_information?.title ??
    job.job_information?.job_title_raw ??
    job.v7_processed_job_data?.job_titles?.explicit?.value ??
    "",
  company_name:
    job.job_information?.company_info?.name ??
    job.v5_processed_company_data?.name ??
    job.v7_processed_job_data?.company_profile?.name ??
    "",
  estimated_post_date: job.v7_processed_job_data?.estimated_post_date ?? "",
  workplace_type:
    job.v7_processed_job_data?.work_arrangement?.workplace_type ?? "",
  skills_explicit: formatExplicitSkills(job),
  salary_range: formatSalaryRange(job),
  seniority_level:
    job.v7_processed_job_data?.experience_requirements?.seniority_level ?? "",
});

const formatExplicitSkills = (job: Job): string => {
  const skills = job.v7_processed_job_data?.skills?.explicit ?? [];
  const values = skills
    .map((skill) => skill.value)
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  return Array.from(new Set(values)).join(", ");
};

const formatSalaryRange = (job: Job): string => {
  const salary = job.v7_processed_job_data?.compensation_and_benefits?.salary;
  if (!salary) {
    return "";
  }
  const low = salary.low;
  const high = salary.high;
  const currency = salary.currency?.trim();
  const frequency = salary.frequency?.trim();

  if (!Number.isFinite(low) && !Number.isFinite(high)) {
    return "";
  }

  const lowText = Number.isFinite(low) && low > 0 ? String(low) : "";
  const highText = Number.isFinite(high) && high > 0 ? String(high) : "";
  const range = [lowText, highText].filter((value) => value.length > 0).join(" - ");
  const suffixParts = [currency, frequency].filter(
    (value): value is string => Boolean(value && value.length > 0),
  );
  const suffix = suffixParts.length > 0 ? ` ${suffixParts.join("/")}` : "";

  return `${range}${suffix}`.trim();
};
