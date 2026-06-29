# FE Tag Suggestion Test

## Scope

- Step 7: feedback API, `useTagSuggestion`, `TagSuggestionPanel`
- Step 8: `src/app/(main)/products/new/page.tsx` registration flow integration

## Preconditions

- User is logged in.
- Supabase `products` storage bucket accepts product image uploads.
- `OPENAI_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` are configured on the target environment.
- Data flywheel migrations `014_data_flywheel.sql` and `015_data_flywheel_rls.sql` are applied.
- `model_versions` has one active row.

## Manual Test Scenarios

### 0. Product Condition Enum Compatibility

Steps:
1. Open `/products/new`.
2. Select each condition option: `상`, `중`, `하`.
3. Submit a valid product.

Expected:
- Product registration does not fail with `invalid input value for enum product_condition_t`.
- If the target DB still uses the legacy enum, API maps `high -> like_new`, `medium -> good`, `low -> poor` as a temporary compatibility fallback.
- Long-term target remains migration `011_product_condition_three.sql`, where DB enum values are `high`, `medium`, `low`.

Status: Failed on Railway production before compatibility fallback.

### 1. Product Registration Without Image

Steps:
1. Open `/products/new`.
2. Fill title, price, condition, category, and description.
3. Do not upload an image.
4. Submit the form.

Expected:
- Product is created.
- User is redirected to `/products/{pid}`.
- Tag suggestion panel is not shown.
- No `tag_feedback_logs` row is created.

Status: Not run locally.

### 2. Product Registration With Image

Steps:
1. Open `/products/new`.
2. Upload one valid image.
3. Fill required product fields.
4. Submit the form.

Expected:
- Product is created.
- User stays on the registration page completion state.
- `TagSuggestionPanel` is shown using the created `pid` and first uploaded image URL.
- User can move to `/products/{pid}` via the detail button.

Status: Not run locally.

### 3. Tag Prediction Success

Steps:
1. Complete scenario 2.
2. Wait for AI tag suggestion.

Expected:
- Panel shows loading state while `/api/tags/predict` is pending.
- Suggested tags are rendered as editable chips.
- Tag count is at most 10 in the UI.

Status: Not run locally.

### 4. Tag Edit And Feedback Submit

Steps:
1. Complete scenario 3.
2. Remove at least one suggested tag.
3. Add at least one manual tag.
4. Click tag confirm.

Expected:
- Confirmed tags are shown below the panel.
- `/api/tags/feedback` receives `productId`, `predictedTags`, `finalTags`, `modelVersionId`, and `sessionDurationMs`.
- Server calculates `added_tags` and `removed_tags`.
- A row is inserted into `tag_feedback_logs`.
- Feedback save failure does not block product detail navigation.

Status: Not run locally.

### 5. Prediction Timeout Or Failure

Steps:
1. Force `/api/tags/predict` to fail or exceed 10 seconds.
2. Use the manual tag input.

Expected:
- User sees a non-blocking failure message.
- User can still manually add tags.
- Tag confirm remains usable.

Status: Not run locally.

### 6. Access Control

Steps:
1. Submit `/api/tags/feedback` for a product owned by another user.

Expected:
- API returns `403`.
- No feedback log is inserted.

Status: Not run locally.

## Local Verification

The following check passed:

```bash
git diff --check
```

The following check could not be run because local dependencies are not installed:

```bash
npm run type-check
```

Observed error:

```text
tsc: command not found
```

## Notes

- Current Step 8 implementation preserves the existing predict/feedback API requirement that `productId` is mandatory.
- Because `productId` is only available after product creation, tag suggestion runs after successful registration when at least one image exists.
- `전달사항.txt` is a local handoff file and is not part of this test scope.
