# Go Memory & OOM Guard (go-memory-oom-guard)

This skill provides expert detection and prevention strategies for memory leaks, unbounded cache growth, and Out-Of-Memory (OOM) crashes in Go applications.

---

## 📖 1. Authoritative Reference Maps

*   **Official Go GC Guide:** [Go Garbage Collector Guide](https://go.dev/doc/gc-guide) (the authoritative guide on heap optimization, `GOGC`, and `GOMEMLIMIT`)
*   **Go Diagnostics Guide:** [Go Diagnostics](https://go.dev/doc/diagnostics) (covering profiling, tracing, and debugging memory leaks)
*   **Profiling Go Programs:** [Go Tool Pprof Documentation](https://github.com/google/pprof/blob/main/doc/README.md)

---

## 🛑 2. High-Severity OOM & Leak Patterns in Go

### A. The Unbounded Map Leak (A Go-Specific Behavioral Trap)
*   **The Mechanism:** Go maps are composed of buckets (fixed-size arrays of 8 elements). When you insert key-value pairs, Go dynamically allocates new buckets. When keys are deleted via `delete(map, key)`, **Go maps never shrink**. The underlying buckets remain in memory to avoid the performance overhead of resizing/re-allocations during future writes.
*   **The Trap:** If a map grows to 1,000,000 entries and you subsequently delete 999,999 of them, the map still consumes enough heap memory for 1,000,000 entries.
*   **The Remediation:**
  1. **Re-initialization:** For high-churn maps, periodically rebuild the map by allocating a new map and letting the garbage collector reclaim the old one:
     ```go
     m = make(map[K]V)
     ```
  2. **Bounded Caches:** Use size-bounded or LRU caches (e.g., `github.com/hashicorp/golang-lru`) that actively evict older keys and constrain maximum bucket counts.
  3. **Pointer Indirects:** Store pointers to large values rather than values themselves. This drastically limits the size of map buckets since the buckets will only store pointer addresses instead of large values.

### B. Goroutine Leaks
*   **The Trap:** Spawning goroutines that block indefinitely on unbuffered channel reads or writes, unclosed database/network connections, or missing timeouts. Leaked goroutines stay allocated indefinitely, pinning their call stack and heap variables.
*   **The Remediation:**
    *   Always supply a `context.Context` and ensure goroutines cleanly exit when `context.Done()` triggers.
    *   Never read/write on channels without a dedicated `select` timeout if there is any chance the remote end will hang.

### C. Unclosed Resources (Leaks and File Descriptor Exhaustion)
*   **The Trap:** Neglecting to close `io.ReadCloser` instances like `http.Response.Body`, database rows/connections, or file handles. The internal buffers are not reclaimed promptly, triggering rapid memory ballooning.
*   **The Remediation:**
    ```go
    resp, err := client.Do(req)
    if err != nil {
        return err
    }
    defer resp.Body.Close() // Always defer close immediately after error checking
    ```

### D. Slice Pinning (Sub-slice Memory Retention)
*   **The Trap:** Slicing a small portion of a massive array (`small := massive[:2]`) still holds references to the entire underlying array, preventing the garbage collector from reclaiming it.
*   **The Remediation:** Copy the desired element data to a new slice, allowing the massive parent array to be swept:
    ```go
    small := make([]byte, 2)
    copy(small, massive[:2])
    ```

---

## 🛠️ 3. Diagnostic & Optimization Playbook

### Profile Memory using Pprof
1. **Instrument the App:** Import the debug server `_ "net/http/pprof"` and run a HTTP listener in a background goroutine.
2. **Collect Heap Profiles:**
   ```bash
   go tool pprof http://localhost:6060/debug/pprof/heap
   ```
3. **Use Key Targets:**
   * **`inuse_space`**: Focus on this target to locate actual memory leaks (memory held by active allocations).
   * **`alloc_space`**: Focus on this to find high-churn allocation sites causing garbage collector pressure.
4. **Environment Controls:**
   * **`GOMEMLIMIT`**: Define a soft memory ceiling (e.g., `GOMEMLIMIT=1000MiB`) to automatically scale GC pressure under tight container memory boundaries, avoiding hard container-kill OOMs.
