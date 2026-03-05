export type DebouncedCallback<T> = {
  trigger: (value: T) => void;
  cancel: () => void;
};

export const createDebouncedCallback = <T>(
  delayMs: number,
  callback: (value: T) => void,
): DebouncedCallback<T> => {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const cancel = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const trigger = (value: T) => {
    cancel();
    timer = setTimeout(() => {
      timer = null;
      callback(value);
    }, delayMs);
  };

  return { trigger, cancel };
};
