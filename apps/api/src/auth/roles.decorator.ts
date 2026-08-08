import { SetMetadata } from '@nestjs/common';

export type Rol = 'admin' | 'empleado';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Rol[]) => SetMetadata(ROLES_KEY, roles);
