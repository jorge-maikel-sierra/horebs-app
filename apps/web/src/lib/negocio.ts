export const NEGOCIO = {
  nombre: 'Pizzería Horebs',
  direccion: 'Carrera 7 # 17B - 66, Riohacha, La Guajira',
  horario: 'Lunes a domingo, 4:00pm – 11:00pm',
  whatsapp: '+57 315 786 1208',
  whatsappNumero: '573157861208',
  sitio: 'pizzeriahorebs.shop',
  facebook: 'https://www.facebook.com/Pizzeriahorebs/',
  instagram: 'https://www.instagram.com/pizzeria_horebs/',
  googleReviews: 'https://maps.app.goo.gl/PmwBm7nKNSZzJQVS8',
  mapaEmbedUrl:
    'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3909.1607260211836!2d-72.90701922494681!3d11.540325688658731!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x8e8b63a7f012a7bb%3A0xf3f4f7f37d7db7fd!2sPizzeria%20Horebs!5e0!3m2!1ses-419!2sco!4v1786170150699!5m2!1ses-419!2sco',
} as const;

export function whatsappUrl(mensaje: string) {
  return `https://wa.me/${NEGOCIO.whatsappNumero}?text=${encodeURIComponent(mensaje)}`;
}
