# Script 06 — dry-run (suffix-anchored embedded-city review)

**Database:** `qjglkywmqwqdoaboakao`  
**Generated:** 2026-06-10

## Approved buckets (apply now: 12 rows)

| Bucket | Count |
|--------|------:|
| Multiline | 6 |
| Single-line parse | 5 |
| Backup restore | 1 |

## Pending review: embedded-city (suffix-anchored)

| Metric | Value |
|--------|------:|
| Total embedded-city candidates | 87 |
| Flagged (short street or city×2+) | 2 |
| Idempotency: pass-1 changes | 99 |
| Idempotency: pass-2 changes | 0 |

### Mechanism

Removes **only** a trailing suffix matching `, {city}, {state} {zip}...` anchored at end.
Does **not** use substring search — e.g. `123 Danbury Rd, Danbury, CT 06811` → `123 Danbury Rd`.

### 15 review examples (flagged first)

### 597 — Expert Builders Construction ⚠️ city×2 in address

**Before**
- address: `2002 Hudson Road, Hudson, ME, 04449, U.S.A`
- city: Hudson | state: ME | zip: 04449

**After (suffix-anchored strip)**
- address: `2002 Hudson Road`

### 660 — Quality Exteriors Solution INC ⚠️ city×2 in address

**Before**
- address: `319 E Pittston Rd, Pittston, ME, 04345, United States`
- city: Pittston | state: ME | zip: 04345

**After (suffix-anchored strip)**
- address: `319 E Pittston Rd`

### 587 — Megaforce Restoration

**Before**
- address: `71 Bennett Avenue, Waterbury, CT, 06708, U.S.A`
- city: Waterbury | state: CT | zip: 06708

**After (suffix-anchored strip)**
- address: `71 Bennett Avenue`

### 589 — E&E Exterior LLC

**Before**
- address: `1410 Shinnston Pike, Clarksburg, WV, 26301, U.S.A`
- city: Clarksburg | state: WV | zip: 26301

**After (suffix-anchored strip)**
- address: `1410 Shinnston Pike`

### 590 — Gold Contractor LLC

**Before**
- address: `119 McWeeney Dr, Waterbury, CT, 06705, U.S.A`
- city: Waterbury | state: CT | zip: 06705

**After (suffix-anchored strip)**
- address: `119 McWeeney Dr`

### 592 — ALL State Construction INC

**Before**
- address: `9 West Park ST, Brockton, MA, 02301, U.S.A`
- city: Brockton | state: MA | zip: 02301

**After (suffix-anchored strip)**
- address: `9 West Park ST`

### 594 — Joshua Home Improvement LLC

**Before**
- address: `2565 Main St, Rocky Hill, CT, 06067, U.S.A`
- city: Rocky Hill | state: CT | zip: 06067

**After (suffix-anchored strip)**
- address: `2565 Main St`

### 599 — New England Contracting Corp

**Before**
- address: `172 Copeland St, Brockton, MA, 02301, U.S.A`
- city: Brockton | state: MA | zip: 02301

**After (suffix-anchored strip)**
- address: `172 Copeland St`

### 602 — TT&AA Construction INC

**Before**
- address: `3811 Kenilworth Ave, Berwyn, IL, 60402, U.S.A`
- city: Berwyn | state: IL | zip: 60402

**After (suffix-anchored strip)**
- address: `3811 Kenilworth Ave`

### 603 — Royal Homes Restoration

**Before**
- address: `950 Herrington Rd, Lawrenceville, GA, 30044, U.S.A`
- city: Lawrenceville | state: GA | zip: 30044

**After (suffix-anchored strip)**
- address: `950 Herrington Rd`

### 604 — Eloy Construction LLC

**Before**
- address: `41 E Hancock St, Lansdale, PA, 19446, U.S.A`
- city: Lansdale | state: PA | zip: 19446

**After (suffix-anchored strip)**
- address: `41 E Hancock St`

### 605 — Armando Landscaping Corp

**Before**
- address: `42 Cromwell hill Rd, Monroe, NY, 10950, U.S.A`
- city: Monroe | state: NY | zip: 10950

**After (suffix-anchored strip)**
- address: `42 Cromwell hill Rd`

### 607 — United Exteriors Group

**Before**
- address: `118 Norton Rd, Columbus, OH, 43228, U.S.A`
- city: Columbus | state: OH | zip: 43228

**After (suffix-anchored strip)**
- address: `118 Norton Rd`

### 609 — Skyline Roofing Contractor LLC

**Before**
- address: `202 Mason Ave, Waterbury, CT, 06708, U.S.A`
- city: Waterbury | state: CT | zip: 06708

**After (suffix-anchored strip)**
- address: `202 Mason Ave`

### 610 — Max Roofing 1 LLC

**Before**
- address: `750 Baldwin St, Waterbury, CT, 06706, U.S.A`
- city: Waterbury | state: CT | zip: 06706

**After (suffix-anchored strip)**
- address: `750 Baldwin St`


## Embedded-city flags summary

| ID | Name | Street len | City occurrences | Flag |
|----|------|----------:|-----------------:|------|
| 597 | Expert Builders Construction | 16 | 2 | dup-city |
| 660 | Quality Exteriors Solution INC | 17 | 2 | dup-city |

**Do not apply embedded-city bucket until approved.**
