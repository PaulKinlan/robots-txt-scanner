# Active Context: Robots.txt Analyzer CLI

## Current Focus

- Verifying that the implemented backpressure mechanism resolves the "JavaScript heap out of memory" error during the `scan` command.

## Recent Changes (High-Level)

- **Implemented Backpressure in Scanner:**
  - Modified `scanner.js` to pause the `readline` file stream (`rl.pause()`) when the `p-queue` size exceeds `CONCURRENCY * 2`.
  - Added logic to resume the stream (`rl.resume()`) using the `queue.on('next', ...)` event when the queue size drops below the threshold.
  - **Rationale:** To prevent `readline` from adding tasks to the queue much faster than they can be processed, which previously caused heap exhaustion due to holding millions of pending task function objects in memory for large input lists.
- **Corrected Syntax Errors:** Fixed syntax issues introduced during the previous attempt to implement backpressure.
- **Updated Memory Bank (`techContext.md`, `progress.md`):** Reflected the backpressure fix. (Will update again now).

_(Note: Concurrency remains reduced to 10, which might be overly cautious now but is safer pending verification)._

_Previous Changes (leading up to memory issue):_

- Added `--max-rank` Option & Filtering
- Stored Rank in Database
- Updated URL Handling in Scanner (using origin for `robots.txt`)
- Added Basic DB Schema Migration (add `rank` column)
- Fixed Linter/Syntax Errors

## Next Steps

- Ask the user to retry the operation that previously caused the memory error to confirm if the backpressure fix is effective.
- If the issue persists, further investigation will be needed (though this backpressure issue is the most likely cause for large lists).
- Consider potentially increasing concurrency again later if the fix is confirmed and performance needs improvement.

## Active Decisions & Considerations

- Implementing backpressure between the input stream (`readline`) and the processing queue (`p-queue`) is the standard way to handle this type of memory issue when processing large datasets.
- The threshold (`CONCURRENCY * 2`) provides a buffer, preventing excessive pausing/resuming while keeping the queue size manageable.

## Important Patterns & Preferences

- Prioritizing stability fixes (like memory errors) over new features.
- Following the structure and purpose outlined for each Memory Bank file (`.clinerules`).
- Updating Memory Bank files after implementing significant changes or fixes.

## Learnings & Insights

- Uncontrolled queuing of tasks from a fast producer (like `readline`) to a slower consumer (like a rate-limited network queue) can lead to heap exhaustion due to the accumulation of pending task objects, even if individual tasks are small.
- Implementing backpressure (e.g., using `stream.pause()`/`resume()`) is essential for managing memory in stream-processing pipelines.

_(This file is the most dynamic. Update it frequently to reflect the current state of work, decisions, and immediate plans. It bridges the gap between the high-level context and the day-to-day progress.)_
