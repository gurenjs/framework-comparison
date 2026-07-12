export class UserRegisteredEvent {
  static readonly eventName = 'user.registered';

  constructor(
    public readonly userId: number,
    public readonly name: string,
  ) {}
}
