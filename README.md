Hours spent: ~13hrs

# Query and refine your job search

This tool features job search, with refinement, using natural language.

## How to use

todo

## How it works

The tool serves a REST API while managing "query sessions".

> After reading this README, I recommend you to also read `design.md`
> where you can find my thoughts while iterating through the implementation.

### Parsing user query (llm based)

The user's query in natural language is _parsed by an llm into a set of filters_,
which can be _hard_ or _soft_.

**Hard filters** are strict. If a job does not satisfy _one or more_ hard filters,
the job is filtered out. The filtering action is more direct, _an equality
or in/contains check_.

**Soft filters** are only used to _rank jobs in relevance_ (not implemented yet).

Example:

**User query**: "frontend roles using Angular. Remote is a must."

```
--
HardFilters: [
  job_title: Frontend, UI/UX developer...
  skills: Angular,
  workplace_type: Remote
]
```

As you can see, the job title is not parsed to a single option such as `Frontend`, the
llm will expand into different possible synonyms of the same relevance. That is done so that
we can more easily match with `data.jsonl`'s v7 job_title explicit and inferred values.

The LLM parsing will result in the following data structure:

```ts
export type Filters = {
  readonly hard: ReadonlyArray<HardFilter>;
  readonly soft: ReadonlyArray<SoftFilter>;
};

export type HardFilter =
  | { readonly kind: "job_title_any"; readonly values: ReadonlyArray<string> }
  | { readonly kind: "skills_any"; readonly values: ReadonlyArray<string> }
...
```

### Parsing and filtering jobs

I discovered earlier that loading all json data into memory is simply not the best option.
At least it seemed Node couldn't handle it, maybe other runtimes can.. but I still bet
holding possibly 100GiB (considering 10 times more jobs) is not a good idea.

So **it reads one json line at a time, apply all filters, and then store the job summary
if the job matched with the user's intent**. After having done this until `k` jobs are matched,
the query result is returned.

The job summary is only useful information that are relevant to the user and do not include
all the fields from the original json ofc such as embeddings and etc. It's lighter for memory too.

Given the parsing+filtering process is not optimized, the tool takes quite a while per query (e.g.:
7 seconds to iterate through 10.000 jobs).

Thus, there is a limit to the number of jobs that are returned for a given query. It's recommended to
range now from 10-50.

Only hard filters are applied for now.

### Refinement

As it was described in the example, refinement is simply a new query upon data already filtered.

```python
someJobs = query()
refinedResults <- refine(newQuery, someJobs)
```

**The tool manages queries sessions and stores a map from `session_id` to `jobs_ids`. Thus, relating
each session to the jobs that were already matched with previous queries.** That is from where the `someJobs`
are retrieved, from an in-memory session management (no! it doesn't store the whole job json element, just
IDs).

The refinement is particularly slow because it was implemented in a quite bad manner. It rescans
the json until finding again the `k` already filtered jobs, and just after that it applies the
new filters deriving from the refinement.

As a tradeoff, I decided also to have refinement as monotonic, meaning it can shrink the
number of already filtered jobs, it can not broaden with more options not already included.

**Ideally**, refinement implementation should be really faster as it would rely just on a bunch
of jobs (given the limit recommendation is 10-50), it would really take less than one second. But
it's not implemented well.

The **ideal implementation** involves creating a **map of job ids to byte offsets in the jsonl file**.
Either doing:

1. preprocessing the whole data and creating this map for every job when starting the tool daemon.
   It'll be saved to disk, so on restart, it's not needed to reprocess it.
2. do it as needed for each session's jobs.

IMO, 1. seems better. Then, if new jobs are added to the jsonl, we just append new rows to the byte offset
file/db.

#### Job id -> byte offset map

It's not only useful for refinement. It could be really useful to improve query performance.

We could map certain common filters to job ids on the preprocessing step, then all the subsequent
queries would be faster. Again, this has to be done only once and for newer data added.

Example:

```
workplace_type.remote = [job1, job12, job13213, job32142]
```

Having this metadata mapping, in this example, instead of scanning for the whole file, if the user
is only looking for remote jobs, we would just rely on this list already mapped on the preprocessing step.

Remember: having the job id, we can retrieve the json line based on the byte offset map.

> This is the ideal, it's not implemented.

### Ranking/Relevance

Ranking by relevance should be done with soft filters.

Unfortunately, I didn't have time to implement it. But my first idea was to play cosine similarity using
the embedding description, comparing it with the user's raw query in natural language.

There is also bm25 but honestly, I don't understand much about it. I think it may be helpful for indexing
on preprocssing but who knows.

### What queries work well

The queries that I would make myself. If the query is objective enough to fit into hard filters,
then my tool does great I think. However, if it involves things more subjective and not actually
structured on the data, such as "companies working to take care of the ocean", the tool built
would probably fail badly as it does not handle such subjective queries yet with soft intents.

### Other improvements

Besides improvements already mentioned, others would be:

1. Firstly, and UX-wise the most important, sort by date. The newer the job post, the easier
   to get an interview for it after applying.
2. Faster query results using the techniques that I mentioned but also other things like
   using batch workers to process the jobs after parsed...
3. Using a jsonl library instead of the manuality that I have in my tool for json handling.
