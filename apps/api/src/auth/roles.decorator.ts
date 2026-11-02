import { CustomDecorator, SetMetadata } from '@nestjs/common';

export type Rol = 'admin' | 'empleado';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Rol[]): CustomDecorator =>
  SetMetadata(ROLES_KEY, roles);
