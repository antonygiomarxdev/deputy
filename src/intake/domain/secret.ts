export class Secret {
  readonly #value: string;

  constructor(value: string) {
    this.#value = value;
  }

  reveal(): string {
    return this.#value;
  }

  toString(): string {
    return "[secret]";
  }

  toJSON(): string {
    return "[secret]";
  }

  [Symbol.for("nodejs.util.inspect.custom")](): string {
    return "[secret]";
  }
}
