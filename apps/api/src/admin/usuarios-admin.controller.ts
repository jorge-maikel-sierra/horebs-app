import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { RolesGuard } from '../auth/roles.guard';
import type { UsuarioAutenticado } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UsuarioActual } from '../auth/usuario.decorator';
import { UuidPipe } from '../common/pipes/uuid.pipe';
import { ValidarBodyPipe } from '../common/pipes/validar-body.pipe';
import { ESQUEMA_ASIGNAR_ROL } from './esquemas';
import { UsuariosAdminService } from './usuarios-admin.service';
import type {
  AsignarRolInput,
  UsuarioStaffDto,
} from './usuarios-admin.service';

@Controller('admin')
@UseGuards(RolesGuard)
export class UsuariosAdminController {
  constructor(private readonly usuarios: UsuariosAdminService) {}

  @Get('perfil')
  @Roles('admin', 'empleado')
  obtenerPerfil(
    @UsuarioActual() usuario: UsuarioAutenticado,
  ): UsuarioAutenticado {
    return usuario;
  }

  @Get('usuarios')
  @Roles('admin')
  listar(): Promise<UsuarioStaffDto[]> {
    return this.usuarios.listarUsuarios();
  }

  @Post('usuarios')
  @Roles('admin')
  asignarRol(
    @Body(new ValidarBodyPipe(ESQUEMA_ASIGNAR_ROL))
    body: AsignarRolInput,
  ): Promise<UsuarioStaffDto> {
    return this.usuarios.asignarRol(body);
  }

  @Delete('usuarios/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('admin')
  quitarRol(@Param('id', UuidPipe) id: string): Promise<void> {
    return this.usuarios.quitarRol(id);
  }
}
