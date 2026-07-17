# Test fixture conventions

- Keep fixtures synthetic, deterministic, and free of production or personal data.
- Put immutable reusable values in this directory; use factory functions when a test needs mutation.
- Use explicit Arabic, bidirectional-text, boundary, concurrency, and failure examples where relevant.
- Unit fixtures must not access networks, filesystems, clocks, randomness, or process-global configuration.
- Integration tests must allocate disposable resources through the test-support helpers and clean them in `finally` blocks.
- Browser fixtures belong in `tests/e2e`; secrets, provider credentials, and copied production records are prohibited.
