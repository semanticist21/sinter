export class SinterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SinterError";
  }
}

export class SinterValidationError extends SinterError {
  constructor(message: string) {
    super(message);
    this.name = "SinterValidationError";
  }
}

export class SinterCodecError extends SinterError {
  constructor(message: string) {
    super(message);
    this.name = "SinterCodecError";
  }
}
