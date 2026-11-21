import {
  ForbiddenException,
  HttpException,
  UnauthorizedException,
} from '@nestjs/common';

export function expectHttpExceptionStatus(action: () => unknown, status: number): void {
  let thrown: unknown;

  try {
    action();
  } catch (error) {
    thrown = error;
  }

  const ExpectedException = status === 403
    ? ForbiddenException
    : status === 401
      ? UnauthorizedException
      : HttpException;
  expect(thrown).toBeInstanceOf(ExpectedException);
  expect((thrown as HttpException).getStatus()).toBe(status);
}
