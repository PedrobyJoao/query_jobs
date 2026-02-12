import type { Job, WorkplaceLocation } from "./schema";

export type Filters = {
  readonly hard: ReadonlyArray<HardFilter>;
  readonly soft: ReadonlyArray<SoftFilter>;
};

export type WorkplaceType = "Remote" | "Hybrid" | "Onsite";

export type LocationToken = {
  readonly city?: string;
  readonly state?: string;
  readonly countryCode?: string;
  readonly continent?: string;
};

export type HardFilter =
  | { readonly kind: "job_title_any"; readonly values: ReadonlyArray<string> }
  | { readonly kind: "skills_any"; readonly values: ReadonlyArray<string> }
  | { readonly kind: "workplace_type"; readonly value: WorkplaceType }
  | { readonly kind: "commitment_any"; readonly values: ReadonlyArray<string> }
  | { readonly kind: "seniority_any"; readonly values: ReadonlyArray<string> }
  | {
      readonly kind: "location_any";
      readonly values: ReadonlyArray<LocationToken>;
    }
  | { readonly kind: "company_non_profit"; readonly value: boolean };

export type SoftFilter =
  | {
      readonly kind: "company_mission_any";
      readonly values: ReadonlyArray<string>;
    }
  | {
      readonly kind: "description_any";
      readonly values: ReadonlyArray<string>;
    };

type HardHandlerMap = {
  [K in HardFilter["kind"]]: (
    job: Job,
    filter: Extract<HardFilter, { kind: K }>,
  ) => boolean;
};

export const query = (data: ReadonlyArray<Job>, plan: Filters): Job[] =>
  data.filter(matchesHardFilters(plan.hard));

const matchesHardFilters = (filters: ReadonlyArray<HardFilter>) => (job: Job) =>
  filters.every((filter) => applyHardFilter(job, filter));

const applyHardFilter = (job: Job, filter: HardFilter): boolean => {
  const handler = hardHandlers[filter.kind] as (
    job: Job,
    filter: HardFilter,
  ) => boolean;
  return handler(job, filter);
};

const hardHandlers: HardHandlerMap = {
  job_title_any: (job, filter) => hasAny(titleTokens(job), filter.values),
  skills_any: (job, filter) => hasAny(skillTokens(job), filter.values),
  workplace_type: (job, filter) =>
    workplaceTypeToken(job) === normalize(filter.value),
  commitment_any: (job, filter) => hasAny(commitmentTokens(job), filter.values),
  seniority_any: (job, filter) => hasAny(seniorityTokens(job), filter.values),
  location_any: (job, filter) => matchesLocationAny(job, filter.values),
  company_non_profit: (job, filter) =>
    job.v5_processed_company_data.is_non_profit === filter.value,
};

const titleTokens = (job: Job): string[] => {
  const titles = job.v7_processed_job_data.job_titles;
  const explicit = compactStrings([
    titles.explicit.value,
    ...titles.explicit.expanded_terms,
  ]);
  const inferred = titles.inferred.flatMap((item) =>
    compactStrings([item.value, ...item.expanded_terms]),
  );
  return uniq([...explicit, ...inferred]);
};

const skillTokens = (job: Job): string[] => {
  const skills = job.v7_processed_job_data.skills;
  const explicit = skills.explicit.flatMap((item) =>
    compactStrings([item.value, ...item.expanded_terms]),
  );
  const inferred = skills.inferred.flatMap((item) =>
    compactStrings([item.value, ...item.expanded_terms]),
  );
  return uniq([...explicit, ...inferred]);
};

const commitmentTokens = (job: Job): string[] => {
  const commitment = job.v7_processed_job_data.work_arrangement.commitment;
  return uniq(normalizeList(commitment));
};

const seniorityTokens = (job: Job): string[] => {
  const seniority =
    job.v7_processed_job_data.experience_requirements.seniority_level;
  return uniq(compactStrings([seniority]));
};

const workplaceTypeToken = (job: Job): string =>
  normalize(job.v7_processed_job_data.work_arrangement.workplace_type);

const matchesLocationAny = (job: Job, values: ReadonlyArray<LocationToken>) => {
  const locations =
    job.v7_processed_job_data.work_arrangement.workplace_locations;
  const tokens = values.filter(hasLocationFields);
  if (locations.length === 0 || tokens.length === 0) {
    return false;
  }
  return tokens.some((token) =>
    locations.some((location) => matchesLocationToken(location, token)),
  );
};

const matchesLocationToken = (
  location: WorkplaceLocation,
  token: LocationToken,
): boolean => {
  const matchesField = (
    value: string | undefined,
    expected: string | undefined,
  ): boolean =>
    expected === undefined
      ? true
      : normalize(value ?? "") === normalize(expected);

  return (
    matchesField(location.city, token.city) &&
    matchesField(location.state, token.state) &&
    matchesField(location.country_code, token.countryCode) &&
    matchesField(location.continent, token.continent)
  );
};

const hasLocationFields = (token: LocationToken): boolean =>
  Boolean(token.city || token.state || token.countryCode || token.continent);

const hasAny = (
  tokens: ReadonlyArray<string>,
  values: ReadonlyArray<string>,
): boolean => {
  if (tokens.length === 0 || values.length === 0) {
    return false;
  }
  const tokenSet = new Set(tokens);
  return normalizeList(values).some((value) => tokenSet.has(value));
};

const normalizeList = (values: ReadonlyArray<string>): string[] =>
  compactStrings(values);

const compactStrings = (
  values: ReadonlyArray<string | null | undefined>,
): string[] =>
  values
    .filter((value): value is string => typeof value === "string")
    .map(normalize)
    .filter((value) => value.length > 0);

const uniq = (values: ReadonlyArray<string>): string[] =>
  Array.from(new Set(values));

const normalize = (value: string): string => value.trim().toLowerCase();
