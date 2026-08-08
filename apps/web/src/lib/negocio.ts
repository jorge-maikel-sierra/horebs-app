export const NEGOCIO = {
  nombre: 'Pizzería Horebs',
  direccion: 'Carrera 7 # 17B - 66, Riohacha, La Guajira',
  horario: 'Lunes a domingo, 4:00pm – 11:00pm',
  whatsapp: '+57 315 786 1208',
  whatsappNumero: '573157861208',
  sitio: 'pizzeriahorebs.shop',
} as const;

export function whatsappUrl(mensaje: string) {
  return `https://wa.me/${NEGOCIO.whatsappNumero}?text=${encodeURIComponent(mensaje)}`;
}
