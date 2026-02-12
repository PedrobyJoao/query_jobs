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

#### v0.0: filtering

Some thoughts:

Types of filters:

- Hard filter: it's included in the structured data.
- Soft filter: it's not included in the structured data.

Note: Preferable: When iterating through the json data, we should apply all necessary filters for each job.

Missing policy: hard filters fail on missing data (precision‑first), soft filters ignore missing data (don’t penalize)

Note that One‑to‑one mapping works for most hard filters, but nested arrays (titles/skills),
range fields (salary), and derived logic (location radius, “remote” synonyms)
need custom handlers instead of raw path strings. - Default missing policy: hard filters fail
on missing data (precision‑first), soft filters ignore missin

#### v0.0: proposal

```python
def main():
    # process_query will prompt an llm to convert the user text input
    # into a list of filters categorized.
    filters = processQuery(query) :: [Filter]
    filteredJobs = []
    for job in jobs:
        # satisfies all filters will make the distinction
        # between hard and soft filters.
        # OR if necessary, we can use a `satisfies_hard_filters`
        # and use a `satisfies_soft_filters` for probabilities/scores
        if satisfies_filters(filters, job):
            filteredJobs.append(job)

    return filteredJobs
```

### v0.0. Requirements:

**Functional requirements**:

- Refine must be strictly narrowing (monotonic: it can only shrink results, not broaden them).

**Non-functional requirements**:

- Considering jobs are not indexed, the jobs list must be iterated at most once for each query.

### v0.0. Tradeoffs:

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

### 0.0. For the next iteration:

1. bm25, score analysis + indexing
