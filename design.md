## v0.0: Brainstorm

The tool must have two capabilities, search and refine.

Refine is basically a query with the knowledge base already filtered.

```hs
someJobsGivenQuery <- query
someJobsGivenRefinedQuery <- refine(newQuery, someJobsGivenQuery)
```

### v0.0: API

We can do this three different ways:

1. A REPL is the most obvious but it may not be the best tooling-wise.
   As this system will probably be consumed as an http API, not as a CLI app.
2. A statefull API with two endpoints `/search` and `/refine` in which `refine`
   alread has information of the filtered data.
3. A stateless API with two endpoints: `/search` and `/refine` in which we
   `refine` requires two params: `newQuery` and `filteredJobs` (and that is the problem
   of this option. `filteredJobs` may be GBs of data)
4. AI: any suggestion?

> Didn't decide yet on the type of API.

Conclusion: We'll use a REST API with one endpoint `/search`.

This endpoint has an optional param `session_id` in which case if it's set,
it means the user is refining a given previous query.

State is maintaned by the server for each session.

> In a production env, a garbage collector would be needed
> to remove stale sessions.

### v0.0: How to really filter the data?

#### v0.0: input

Let's try to work out based on the examples:

```hs
-- query 1: the query is `title/role` related
"data science jobs" -> ["data science", "ML engineer", "data analyst", ...]`

-- query 2: remote
"remote" : prev -- easy, high precision filter

-- query 3: at companies or non-profits that care about social good
... : "non-profit" : "social good" : prev
```

Now, how to encode the filter type is the question? It'll be only a string?

**Note that an LLM will be responsible for parsing the user's query into filters.**

Conclusion: we created a Filter type

#### v0.0: filtering

Some thoughts:

Types of filters:

- Hard filter: it's included in the structured data.
- Soft filter: it's not included in the structured data.

Note: Preferable: When iterating through the json data, we should apply all necessary filters for each job.

Missing policy: hard filters fail on missing data (precision‑first), soft filters ignore missing data (don’t penalize)

Note that One‑to‑one mapping works for most hard filters, but nested arrays (titles/skills),
range fields (salary), and derived logic (location radius, “remote” synonyms)
need custom handlers instead of raw path strings.

#### v0.0: proposal

```python
def main():
    # process_query will prompt an llm to convert the user text input
    # into a list of filters categorized.
    filters = processQuery(query) :: [Filter]
    filteredJobs = []
    for job in jobs:
        # satisfies all hard filters will make the distinction
        if satisfies_filters(filters, job):
            filteredJobs.append(job)

    return filteredJobs
```

### v0.0. Requirements:

**Functional requirements**:

- Server with REST API maintaining state for each session.
- Must apply only hard filters for now.

**Non-functional requirements**:

- Considering jobs are not indexed, the jobs list must be iterated at most once for each query.

### v0.0. Thoughts: Tradeoffs, decisions and challenges

**should refine be strictly narrowing (monotonic), or can it broaden results?**

Maybe a more complete tool should be able to broaden the results as users might change their minds
when refining and refining again, example:

```python
data science
remote
non-profit # they notice using non-profit removed 99% of results
profit # so they put it back
```

An undo feature would be enough here. I think it kinda of makes most sense to be monotonic at first.

**iterating all jobs at most once or preprocess it first?**

I wonder which has a greater time complexity:

1. preprocessing using bm25, indexing, and then filtering over top-k. Thus iterating twice,
   but the second with a shrinked list
2. iterating all jobs and applying all filters to each of them

```
n: initial number of all jobs
k: top-k results after bm25 (n > k)
f: time complexity of all filters being applied

1. n + (k * f)
2. f * n
```

**job title it's a hard filter but also kinda soft**

If we consider job title as a hard filter, the matching will rely
on the explicit and inferred job titles.

So suppose the user write `developer` and the parser does not generate
synonyms like `software engineer`, if it's not included in the explicity/inferred,
the user will miss some opportunities.

I don't think making it as a soft filter is a very good option
since there are not specific embeddings for job titles. So maybe only bm25 would
be a good option here (and I'm not even sure).

Instead, it's best to have our AI-parser to generate synonyms for job titles.

**loading all data at once**

It seems it's not a good idea to load all data at once. Nodejs can not handle it.
But I don't think the runtime is the one to blame.

Since we don't have indexing yet, let's simple consume one json element at a time.

> even for indexing, I don't think we need to load the entire data.

**v5 data**

ignore v5 data since it's legacy.

### v0.0. Done: what it can do, and what it's next

**v0.0** deliveries a functional tool that can **query non-big json payloads**
using **only hard filters**. It features a REST API and a session mechanism
for state reusage.

For the next iteration:

1. Support to big data payloads
2. refine
3. soft filters: cosine similarity with embedding
4. UX for testing: REPL using the REST API
5. bm25, score analysis + indexing

## v0.1: Deliverables

1. Support to big data payloads
2. refine

### v0.1: big data payloads

A `query` func will simply rely on an async iterator instead
of all data loaded at once.

### v0.1. Thoughts: Tradeoffs, decisions and challenges

**UX: returning full jobs info is quite messy**

when testing, I realized that returning the full Job info
was just messy. Then I decided to create a summary version of the
Job type, and use it to return to callers.

**taking too much time to iterate all jobs**

When a limit of 200 jobs is set on the query, it takes minutes to return the result.
Of course it scans almost all the 100k jobs

### v0.1. Done: what it can do, and what it's next

- query with asyncIterator instead of loading all data at once
- Result UX:
  - JobSummary UX instead of returning the whole job info
  - count number of jobs scanned
  - elapsed time of query
- refine: is naturally implemented with sessions. If you query using
  a live session ID, the query will rely only on the already filtered jobs.

**What is next:**

1. soft filters: cosine similarity with embedding
2. UX for testing: REPL using the REST API
3. sort by date
4. Faster query results
   3.0. refine is particularly slow: write a offset index since jsonl has one json elem per line,
   this index will map id -> json line, and then we can retrieve the specific json line given id.
   3.1. parser library instead of per-char parsing
   3.2. token normalization and rebuilding overhead?
   3.3. concurrent parsing or concurrent filtering
5. bm25, score analysis + indexing

## v0.2: Deliverables

Before continuing, I started to wonder if having soft "filtering" is indeed
higher, priority-wise, than having faster query results.

If you stop to think, soft "filters" will be generally used to sort data to
user in relevance, not really filter. It's just a ranking mechanism.

Although, **ranking through soft intent** is important, I'm pretty sure, at least personally speaking, that
having hard filters + fast query responses are what I would need the most.

Even more important than relevance ranking, is to have data sorted by date. When I'm applying to
jobs, I don't want to mess with jobs posted more than two weeks ago.

Anyway, the **What is next** order is changed to:

1. Faster query results
2. sort by date
3. soft filters: cosine similarity with embedding
4. bm25, score analysis + indexing
5. UX for testing: REPL using the REST API

**Deliverables:**

1. Faster query results
   1.0. parser library instead of per-char parsing
   1.1. refine is particularly slow: write a offset index since jsonl has one json elem per line,
   this index will map id -> json line, and then we can retrieve the specific json line given id.
   1.2. token normalization and rebuilding overhead?
   1.3. concurrent parsing or concurrent filtering
