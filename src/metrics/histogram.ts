export const LATENCY_BUCKET_UPPER_BOUNDS_MS = [
  5, 10, 25, 50, 100, 250, 500, 1_000, 2_500, 5_000, 10_000,
] as const;

const BUCKET_COUNT = LATENCY_BUCKET_UPPER_BOUNDS_MS.length + 1;

export interface HistogramSnapshot {
  readonly counts: readonly number[];
  readonly count: number;
  readonly maximum: number | null;
}

export class LatencyHistogram {
  readonly #counts = Array<number>(BUCKET_COUNT).fill(0);
  #count = 0;
  #maximum: number | null = null;

  record(milliseconds: number): void {
    if (!Number.isFinite(milliseconds) || milliseconds < 0) {
      throw new RangeError("latency must be a non-negative finite number");
    }

    const bucketIndex = this.#bucketIndex(milliseconds);
    this.#counts[bucketIndex] = (this.#counts[bucketIndex] ?? 0) + 1;
    this.#count += 1;
    this.#maximum = Math.max(this.#maximum ?? milliseconds, milliseconds);
  }

  percentile(quantile: number): number | null {
    if (!Number.isFinite(quantile) || quantile < 0 || quantile > 1) {
      throw new RangeError("quantile must be between 0 and 1 inclusive");
    }
    if (this.#count === 0) {
      return null;
    }

    const rank = quantile * this.#count;
    let cumulativeCount = 0;

    for (let index = 0; index < this.#counts.length; index += 1) {
      const countInBucket = this.#counts[index] ?? 0;
      const nextCumulativeCount = cumulativeCount + countInBucket;

      if (rank <= nextCumulativeCount && countInBucket > 0) {
        const lowerBound =
          index === 0 ? 0 : (LATENCY_BUCKET_UPPER_BOUNDS_MS[index - 1] ?? 0);
        const upperBound =
          LATENCY_BUCKET_UPPER_BOUNDS_MS[index] ?? this.#maximum ?? lowerBound;
        const positionInBucket = (rank - cumulativeCount) / countInBucket;

        return lowerBound + (upperBound - lowerBound) * positionInBucket;
      }

      cumulativeCount = nextCumulativeCount;
    }

    return this.#maximum;
  }

  snapshot(): HistogramSnapshot {
    return Object.freeze({
      counts: Object.freeze([...this.#counts]),
      count: this.#count,
      maximum: this.#maximum,
    });
  }

  #bucketIndex(milliseconds: number): number {
    const index = LATENCY_BUCKET_UPPER_BOUNDS_MS.findIndex(
      (upperBound) => milliseconds < upperBound,
    );
    return index === -1 ? BUCKET_COUNT - 1 : index;
  }
}
