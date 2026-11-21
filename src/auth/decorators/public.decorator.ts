import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marca una ruta que no requiere el access token JWT.
 *
 * El guard de JWT está registrado globalmente (todo cerrado por defecto), así
 * que login, registro, refresh y logout tienen que abrirse explícitamente.
 * Esto no significa que todas sean anónimas: refresh y logout validan el
 * refresh token recibido en el cuerpo. Olvidarse de este decorador deja la
 * ruta protegida por access token.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
