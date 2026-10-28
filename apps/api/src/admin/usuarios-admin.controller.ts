import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { RolesGuard } from '../auth/roles.guard';
import type { UsuarioAutenticado } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type { Rol } from '../auth/roles.decorator';
import { UsuarioActual } from '../auth/usuario.decorator';
import { UuidPipe } from '../common/pipes/uuid.pipe';
import { ValidarBodyPipe } from '../common/pipes/validar-body.pipe';
import { ESQUEMA_ASIGNAR_ROL } from './esquemas';
import { UsuariosAdminService } from './usuarios-admin.service';

@Controller('admin')
@UseGuards(RolesGuard)
export class UsuariosAdminController {
  constructor(private readonly usuarios: UsuariosAdminService) {}

  @Get('perfil')
  @Roles('admin', 'empleado')
  obtenerPerfil(@UsuarioActual() usuario: UsuarioAutenticado) {
    return usuario;
  }

  @Get('usuarios')
  @Roles('admin')
  listar() {
    return this.usuarios.listarUsuarios();
  }

  @Post('usuarios')
  @Roles('admin')
  asignarRol(
    @Body(new ValidarBodyPipe(ESQUEMA_ASIGNAR_ROL))
    body: {
      email: string;
      rol: Rol;
      cedula?: string;
    },
  ) {
    return this.usuarios.asignarRol(body.email, body.rol, body.cedula);
  }

  @Delete('usuarios/:id')
  @HttpCode(204)
  @Roles('admin')
  quitarRol(@Param('id', UuidPipe) id: string) {
    return this.usuarios.quitarRol(id);
  }
}
