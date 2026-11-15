import type { NotificationEventType } from '../../generated/prisma/client.js';

export interface TemplateResult {
  title: string;
  message: string;
}

type TemplateData = Record<string, string>;

export const notificationTemplates: Record<
  NotificationEventType,
  (d: TemplateData) => TemplateResult
> = {
  RESERVATION_CREATED: (d) => ({
    title: 'Nueva solicitud de reserva',
    message: `Se ha registrado una nueva reserva para tu bien "${d.propertyName}".`,
  }),
  PAYMENT_CONFIRMED: (d) => ({
    title: 'Pago de reserva confirmado',
    message: `El pago por la reserva del bien "${d.propertyName}" ha sido procesado exitosamente.`,
  }),
  RESERVATION_CANCELED_EXPIRED: (d) => ({
    title: 'Reserva cancelada',
    message: `La reserva del bien "${d.propertyName}" fue cancelada automáticamente por falta de pago dentro del tiempo límite.`,
  }),
  RESERVATION_FINISHED: (d) => ({
    title: 'Reserva finalizada',
    message: `La reserva del bien "${d.propertyName}" ha sido marcada como finalizada. ¡Gracias por usar el servicio!`,
  }),
  MESSAGE_NEW: (d) => ({
    title: 'Nuevo mensaje recibido',
    message: `Tienes un nuevo mensaje sobre el bien "${d.propertyName}".`,
  }),
  DEPOSIT_RETURNED: (d) => ({
    title: 'Depósito de garantía devuelto',
    message: `Se ha procesado el reembolso de tu depósito de garantía por $${d.amount}.`,
  }),
  DEPOSIT_RETURNED_AUTO: (d) => ({
    title: 'Depósito de garantía devuelto',
    message: `Se ha procesado la devolución automática de tu depósito de garantía por $${d.amount} tras vencer el plazo de 7 días.`,
  }),
  DEPOSIT_RETAINED: (d) => ({
    title: 'Depósito de garantía retenido',
    message: `Tu depósito de garantía por $${d.amount} ha sido retenido por reporte de daños.`,
  }),
  DOCUMENT_APPROVED: () => ({
    title: 'Documento aprobado',
    message: 'Tu documento de identidad ha sido verificado con éxito.',
  }),
  DOCUMENT_REJECTED: (d) => ({
    title: 'Documento rechazado',
    message: `Tu documento fue rechazado. Motivo: ${d.reason}.`,
  }),
};
