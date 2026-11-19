/** Jobs run one at a time, in call order: each starts once the one before it has settled, failed or not. */
export function createSerializer(): <T>(job: () => Promise<T>) => Promise<T> {
  let tail: Promise<unknown> = Promise.resolve();
  return <T>(job: () => Promise<T>): Promise<T> => {
    const result = tail.then(job);
    tail = result.catch(() => undefined);
    return result;
  };
}
